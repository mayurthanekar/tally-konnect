// src/services/sync.engine.js
// Orchestrates the full sync flow for each module: Fynd API <-> Tally Prime
const { db } = require('../db');
const TallyXmlClient = require('./tally.client');
const FyndApiClient = require('./fynd.client');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const VOUCHER_TYPE_MAP = {
  closing_stock: { direction: 'outbound', tallyReport: 'Stock Summary' },
  sales_order: { direction: 'inbound', voucherType: 'Sales Order' },
  return_sales_order: { direction: 'inbound', voucherType: 'Credit Note' },
  sales_voucher: { direction: 'inbound', voucherType: 'Sales' },
  return_sales_voucher: { direction: 'inbound', voucherType: 'Credit Note' },
};

class SyncEngine {
  /**
   * Execute sync for a specific module
   * @param {string} moduleId
   * @param {string} triggerType - 'manual' | 'scheduled'
   */
  static async run(moduleId, triggerType = 'manual') {
    const logId = await SyncEngine.createLog(moduleId, triggerType);
    const startTime = Date.now();

    try {
      // Load configs
      const apiConfig = await db('api_configs').where({ module_id: moduleId }).first();
      if (!apiConfig || !apiConfig.enabled) {
        await SyncEngine.updateLog(logId, 'failed', 0, 0, 'Module is not enabled');
        return { success: false, error: 'Module not enabled' };
      }

      const tallyConn = await db('tally_connection').first();
      if (!tallyConn || tallyConn.status !== 'connected') {
        await SyncEngine.updateLog(logId, 'failed', 0, 0, 'Tally not connected');
        return { success: false, error: 'Tally not connected' };
      }

      const mappings = await db('field_mappings').orderBy('sort_order');
      const moduleInfo = VOUCHER_TYPE_MAP[moduleId];

      const tally = new TallyXmlClient(tallyConn.host, tallyConn.port);
      const fynd = new FyndApiClient(apiConfig);

      let result;

      if (moduleInfo.direction === 'inbound') {
        // Fynd -> Tally: Fetch from Fynd API, transform, push to Tally
        result = await SyncEngine.runInbound(fynd, tally, mappings, moduleInfo.voucherType);
      } else {
        // Tally -> Fynd: Export from Tally, transform, push to Fynd API
        result = await SyncEngine.runOutbound(fynd, tally, mappings, apiConfig);
      }

      const duration = Date.now() - startTime;
      await SyncEngine.updateLog(logId, result.failed > 0 ? 'failed' : 'success',
        result.success, result.failed, result.errors?.join('; ') || '', result.rawResponse);

      logger.info({ moduleId, duration, success: result.success, failed: result.failed }, 'Sync completed');

      return { success: true, ...result, duration };
    } catch (err) {
      await SyncEngine.updateLog(logId, 'failed', 0, 0, err.message);
      logger.error({ moduleId, err }, 'Sync failed');
      return { success: false, error: err.message };
    }
  }

  /**
   * INBOUND: Fynd -> Tally
   */
  static async runInbound(fynd, tally, mappings, voucherType) {
    // 1. Fetch data from Fynd
    const fyndData = await fynd.fetchAll(fynd.config.endpoint);
    logger.info({ records: fyndData.length }, 'Fetched from Fynd API');

    if (fyndData.length === 0) {
      return { success: 0, failed: 0, errors: ['No data returned from Fynd API'] };
    }

    // 2. Import vouchers into Tally
    const result = await tally.importVouchers(fyndData, voucherType, mappings);
    return result;
  }

  /**
   * OUTBOUND: Tally -> Fynd (Closing Stock)
   */
  static async runOutbound(fynd, tally, mappings, apiConfig) {
    // 1. Export from Tally
    const stockItems = await tally.exportClosingStock();
    logger.info({ items: stockItems.length }, 'Exported from Tally');

    if (stockItems.length === 0) {
      return { success: 0, failed: 0, errors: ['No stock items returned from Tally'] };
    }

    // 2. Transform using mappings (reverse: Tally field -> API field)
    const transformed = stockItems.map(item => {
      const row = {};
      for (const m of mappings) {
        const tallyVal = item[m.tally_field] || item[m.tally_xml_key] || '';
        row[m.api_field] = tallyVal;
      }
      // Include raw stock data
      row.stockItemName = item.name;
      row.closingBalance = item.closingBalance;
      row.closingQuantity = item.closingQuantity;
      return row;
    });

    // 3. Push to Fynd API
    let success = 0;
    let failed = 0;
    const errors = [];

    try {
      await fynd.request('POST', apiConfig.endpoint, { items: transformed });
      success = transformed.length;
    } catch (err) {
      failed = transformed.length;
      errors.push(err.message);
    }

    return { success, failed, errors };
  }

  /**
   * Run all active modules
   */
  static async runAll() {
    const configs = await db('api_configs').where({ enabled: true });
    const results = {};

    for (const cfg of configs) {
      results[cfg.module_id] = await SyncEngine.run(cfg.module_id, 'manual');
    }

    return results;
  }

  // --- Logging helpers ---

  static async createLog(moduleId, triggerType) {
    const [log] = await db('sync_logs').insert({
      module_id: moduleId,
      trigger_type: triggerType,
      status: 'running',
      started_at: new Date(),
    }).returning('id');
    return log.id || log;
  }

  static async updateLog(logId, status, sent, failed, errorMsg, tallyResponse = '') {
    await db('sync_logs').where({ id: logId }).update({
      status,
      records_sent: sent,
      records_failed: failed,
      error_message: errorMsg || '',
      tally_response: (tallyResponse || '').substring(0, 10000),
      finished_at: new Date(),
    });
  }
}

module.exports = SyncEngine;
