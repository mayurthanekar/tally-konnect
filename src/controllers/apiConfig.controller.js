// src/controllers/apiConfig.controller.js
const { db } = require('../db');
const { encrypt, decrypt, mask } = require('../utils/encryption');
const FyndApiClient = require('../services/fynd.client');
const logger = require('../utils/logger');

const SECRET_FIELDS = [
  ['bearerToken', 'bearer_token_enc'],
  ['apiKey', 'api_key_enc'],
  ['username', 'username_enc'],
  ['password', 'password_enc'],
  ['clientId', 'client_id_enc'],
  ['clientSecret', 'client_secret_enc'],
];

// GET /api/configs
async function getAll(req, res, next) {
  try {
    const configs = await db('api_configs').orderBy('module_id');
    // Build response keyed by module_id, mask secrets
    const result = {};
    for (const cfg of configs) {
      result[cfg.module_id] = {
        enabled: cfg.enabled,
        endpoint: cfg.endpoint,
        method: cfg.method,
        timeout: String(cfg.timeout_ms),
        headers: cfg.headers_json,
        authType: cfg.auth_type,
        bearerToken: cfg.bearer_token_enc ? mask(decrypt(cfg.bearer_token_enc)) : '',
        apiKey: cfg.api_key_enc ? mask(decrypt(cfg.api_key_enc)) : '',
        apiKeyHeader: cfg.api_key_header,
        username: cfg.username_enc ? mask(decrypt(cfg.username_enc)) : '',
        password: cfg.password_enc ? '****' : '',
        clientId: cfg.client_id_enc ? mask(decrypt(cfg.client_id_enc)) : '',
        clientSecret: cfg.client_secret_enc ? '****' : '',
        tokenUrl: cfg.token_url,
        scope: cfg.scope,
      };
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// PUT /api/configs/:moduleId
async function save(req, res, next) {
  try {
    const { moduleId } = req.params;
    const body = req.body;

    const updateData = {
      enabled: body.enabled,
      endpoint: body.endpoint || '',
      method: body.method || 'POST',
      timeout_ms: parseInt(body.timeout, 10) || 30000,
      headers_json: body.headers || '{}',
      auth_type: body.authType || 'bearer',
      api_key_header: body.apiKeyHeader || 'x-api-key',
      token_url: body.tokenUrl || '',
      scope: body.scope || '',
      updated_at: new Date(),
    };

    // Only encrypt non-masked values (don't re-encrypt "****")
    for (const [inputKey, dbKey] of SECRET_FIELDS) {
      const val = body[inputKey];
      if (val && !val.includes('****')) {
        updateData[dbKey] = encrypt(val);
      }
      // If value is empty string, clear it
      if (val === '') {
        updateData[dbKey] = '';
      }
    }

    await db('api_configs').where({ module_id: moduleId }).update(updateData);
    res.json({ success: true, message: `Config saved for ${moduleId}` });
  } catch (err) { next(err); }
}

// PATCH /api/configs/:moduleId/toggle
async function toggle(req, res, next) {
  try {
    const { moduleId } = req.params;
    const cfg = await db('api_configs').where({ module_id: moduleId }).first();
    if (!cfg) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Module not found' } });

    await db('api_configs').where({ module_id: moduleId }).update({
      enabled: !cfg.enabled, updated_at: new Date(),
    });

    res.json({ success: true, data: { enabled: !cfg.enabled } });
  } catch (err) { next(err); }
}

// POST /api/configs/:moduleId/test
async function testConnection(req, res, next) {
  try {
    const { moduleId } = req.params;
    const cfg = await db('api_configs').where({ module_id: moduleId }).first();
    if (!cfg) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Module not found' } });

    if (!cfg.endpoint) {
      return res.json({ success: true, data: { success: false, message: 'No endpoint URL configured' } });
    }

    const client = new FyndApiClient(cfg);
    const result = await client.testConnection();
    res.json({ success: true, data: result });
  } catch (err) {
    res.json({ success: true, data: { success: false, message: err.message } });
  }
}

module.exports = { getAll, save, toggle, testConnection };
