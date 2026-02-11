// src/db/seeds/run.js
// Seeds default tally_connection, api_configs (5 modules), schedules (5), b2b_settings
require('dotenv').config();
const { db } = require('../index');
const logger = require('../../utils/logger');

const MODULES = [
  'closing_stock', 'sales_order', 'return_sales_order',
  'sales_voucher', 'return_sales_voucher',
];

async function seed() {
  logger.info('Seeding database...');

  // 1. Tally Connection (singleton)
  const existingConn = await db('tally_connection').first();
  if (!existingConn) {
    await db('tally_connection').insert({
      host: 'http://localhost',
      port: '9000',
      platform: 'windows',
      status: 'disconnected',
    });
    logger.info('Seeded tally_connection');
  }

  // 2. API Configs (5 modules)
  for (const moduleId of MODULES) {
    const exists = await db('api_configs').where({ module_id: moduleId }).first();
    if (!exists) {
      await db('api_configs').insert({
        module_id: moduleId,
        enabled: false,
        endpoint: '',
        method: 'POST',
        timeout_ms: 30000,
        headers_json: '{"Content-Type":"application/json"}',
        auth_type: 'bearer',
      });
    }
  }
  logger.info('Seeded api_configs');

  // 3. Schedules (5 modules)
  for (const moduleId of MODULES) {
    const exists = await db('schedules').where({ module_id: moduleId }).first();
    if (!exists) {
      await db('schedules').insert({
        module_id: moduleId,
        enabled: false,
        preset: 'hourly',
        cron_expression: '0 * * * *',
        run_hour: 0,
        run_weekday: 0,
      });
    }
  }
  logger.info('Seeded schedules');

  // 4. B2B Settings (singleton)
  const existingB2b = await db('b2b_settings').first();
  if (!existingB2b) {
    await db('b2b_settings').insert({
      auto_create_party: true,
      validate_gstin: true,
      skip_duplicate_gstin: true,
      party_group: 'Sundry Debtors',
      gst_reg_type: 'Regular',
      default_state: 'Maharashtra',
      party_name_col: 'buyer_name',
      gstin_col: 'buyer_gstin',
      address_col: 'buyer_address',
      state_col: 'buyer_state',
      pincode_col: 'buyer_pincode',
      contact_col: '',
    });
    logger.info('Seeded b2b_settings');
  }

  logger.info('Database seeding completed');
}

(async () => {
  try {
    await seed();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  }
})();
