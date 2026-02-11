// src/controllers/dashboard.controller.js
const { db } = require('../db');
const SyncEngine = require('../services/sync.engine');

// GET /api/dashboard/stats
async function getStats(req, res, next) {
  try {
    const [configs, schedules, mappings, tallyConn] = await Promise.all([
      db('api_configs').select('module_id', 'enabled'),
      db('schedules').select('module_id', 'enabled'),
      db('field_mappings').select('id', 'tally_field'),
      db('tally_connection').first(),
    ]);

    // Count B2B parties from most recent import batch
    const latestBatch = await db('import_data')
      .select('batch_id')
      .orderBy('created_at', 'desc')
      .first();

    let partyCount = 0;
    if (latestBatch) {
      const rows = await db('import_data')
        .where({ batch_id: latestBatch.batch_id })
        .select(db.raw("DISTINCT row_data->>'buyer_name' as name"));
      partyCount = rows.filter(r => r.name).length;
    }

    res.json({
      success: true,
      data: {
        activeApis: configs.filter(c => c.enabled).length,
        totalApis: configs.length,
        activeSchedules: schedules.filter(s => s.enabled).length,
        totalSchedules: schedules.length,
        mappedFields: mappings.filter(m => m.tally_field).length,
        totalMappings: mappings.length,
        b2bParties: partyCount,
        tallyConnection: tallyConn || { status: 'disconnected' },
      },
    });
  } catch (err) { next(err); }
}

// POST /api/sync/run-all
async function runAll(req, res, next) {
  try {
    const results = await SyncEngine.runAll();
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
}

module.exports = { getStats, runAll };
