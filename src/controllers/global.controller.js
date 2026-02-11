// src/controllers/global.controller.js
const { db, testConnection: testDb } = require('../db');
const { encrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

// POST /api/save-all  (Sidebar "Save All Config" button)
async function saveAll(req, res, next) {
  try {
    const { configs, schedules, mappings, b2bSettings, tallyConn } = req.body;

    // Save tally connection
    if (tallyConn) {
      const conn = await db('tally_connection').first();
      if (conn) {
        await db('tally_connection').where({ id: conn.id }).update({
          host: tallyConn.host, port: tallyConn.port, platform: tallyConn.platform, updated_at: new Date(),
        });
      }
    }

    // Save API configs
    if (configs) {
      for (const [moduleId, cfg] of Object.entries(configs)) {
        const updateData = {
          enabled: cfg.enabled,
          endpoint: cfg.endpoint || '',
          method: cfg.method || 'POST',
          timeout_ms: parseInt(cfg.timeout, 10) || 30000,
          headers_json: cfg.headers || '{}',
          auth_type: cfg.authType || 'bearer',
          api_key_header: cfg.apiKeyHeader || 'x-api-key',
          token_url: cfg.tokenUrl || '',
          scope: cfg.scope || '',
          updated_at: new Date(),
        };

        // Encrypt secrets (skip masked values)
        const secretPairs = [
          ['bearerToken', 'bearer_token_enc'],
          ['apiKey', 'api_key_enc'],
          ['username', 'username_enc'],
          ['password', 'password_enc'],
          ['clientId', 'client_id_enc'],
          ['clientSecret', 'client_secret_enc'],
        ];
        for (const [key, dbCol] of secretPairs) {
          const val = cfg[key];
          if (val && !val.includes('****')) {
            updateData[dbCol] = encrypt(val);
          } else if (val === '') {
            updateData[dbCol] = '';
          }
        }

        await db('api_configs').where({ module_id: moduleId }).update(updateData);
      }
    }

    // Save schedules
    if (schedules) {
      for (const [moduleId, s] of Object.entries(schedules)) {
        await db('schedules').where({ module_id: moduleId }).update({
          enabled: s.enabled,
          preset: s.preset,
          cron_expression: s.cron,
          run_hour: parseInt(s.hour, 10) || 0,
          run_weekday: parseInt(s.weekday, 10) || 0,
          updated_at: new Date(),
        });
      }
    }

    // Save mappings
    if (mappings && Array.isArray(mappings)) {
      await db('field_mappings').del();
      if (mappings.length > 0) {
        await db('field_mappings').insert(mappings.map((m, idx) => ({
          sort_order: idx,
          api_field: m.apiField || '',
          tally_xml_key: m.tallyXml || '',
          tally_field: m.tallyField || '',
          is_required: m.required || false,
        })));
      }
    }

    // Save B2B settings
    if (b2bSettings) {
      const existing = await db('b2b_settings').first();
      const b2bData = {
        auto_create_party: b2bSettings.autoCreateParty,
        validate_gstin: b2bSettings.validateGstin,
        skip_duplicate_gstin: b2bSettings.skipDuplicateGstin,
        party_group: b2bSettings.partyGroup,
        gst_reg_type: b2bSettings.gstRegType,
        default_state: b2bSettings.defaultState,
        party_name_col: b2bSettings.partyNameCol,
        gstin_col: b2bSettings.gstinCol,
        address_col: b2bSettings.addressCol,
        state_col: b2bSettings.stateCol,
        pincode_col: b2bSettings.pincodeCol,
        contact_col: b2bSettings.contactCol,
        updated_at: new Date(),
      };
      Object.keys(b2bData).forEach(k => b2bData[k] === undefined && delete b2bData[k]);

      if (existing) {
        await db('b2b_settings').where({ id: existing.id }).update(b2bData);
      }
    }

    res.json({ success: true, message: 'All configurations saved' });
  } catch (err) { next(err); }
}

// GET /api/health
async function health(req, res) {
  const dbOk = await testDb();

  res.status(dbOk ? 200 : 503).json({
    success: dbOk,
    data: {
      status: dbOk ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'connected' : 'disconnected',
        scheduler: 'running',
      },
    },
  });
}

module.exports = { saveAll, health };
