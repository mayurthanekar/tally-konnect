// src/controllers/tallyConnection.controller.js
const { db } = require('../db');
const TallyXmlClient = require('../services/tally.client');
const { validateTallyUrl } = require('../middleware');
const logger = require('../utils/logger');
const wsRelay = require('../services/ws-relay.service');

// GET /api/tally-connection
async function get(req, res, next) {
  try {
    let conn = await db('tally_connection').first();
    if (!conn) {
      // Auto-seed if missing
      [conn] = await db('tally_connection').insert({
        host: 'http://localhost', port: '9000', platform: 'windows', status: 'disconnected',
      }).returning('*');
    }
    res.json({ success: true, data: conn });
  } catch (err) { next(err); }
}

// PUT /api/tally-connection
async function update(req, res, next) {
  try {
    let { host, port, platform } = req.body;

    // Handle full URL in host field
    if (host && host.includes('://')) {
      try {
        const url = new URL(host);
        const newPort = url.port || (url.protocol === 'https:' ? '443' : '80');
        host = `${url.protocol}//${url.hostname}`;
        port = newPort;
      } catch (err) { /* fallback to original values */ }
    }

    if (!validateTallyUrl(host)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid Tally host URL' } });
    }

    let conn = await db('tally_connection').first();
    if (conn) {
      await db('tally_connection').where({ id: conn.id }).update({
        host, port, platform, status: 'disconnected', updated_at: new Date(),
      });
    } else {
      await db('tally_connection').insert({ host, port, platform, status: 'disconnected' });
    }

    const updated = await db('tally_connection').first();
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

// POST /api/tally-connection/test
async function test(req, res, next) {
  try {
    let { host, port } = req.body;

    // Handle full URL in host field
    if (host && host.includes('://')) {
      try {
        const url = new URL(host);
        const newPort = url.port || (url.protocol === 'https:' ? '443' : '80');
        host = `${url.protocol}//${url.hostname}`;
        port = newPort;
      } catch (err) { /* fallback to original values */ }
    }

    if (!validateTallyUrl(host)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid Tally host URL' } });
    }

    // Update status to checking
    const conn = await db('tally_connection').first();
    if (conn) {
      await db('tally_connection').where({ id: conn.id }).update({ status: 'checking' });
    }

    const client = new TallyXmlClient(host, port);
    const result = await client.testConnection();

    // Save result
    const updateData = {
      host, port,
      status: result.connected ? 'connected' : 'error',
      tally_version: result.tallyVersion || '',
      company_name: result.companyName || '',
      last_checked_at: new Date(),
      updated_at: new Date(),
    };

    if (conn) {
      await db('tally_connection').where({ id: conn.id }).update(updateData);
    }

    res.json({
      success: true,
      data: {
        status: updateData.status,
        host, port,
        tallyVersion: result.tallyVersion,
        companyName: result.companyName,
        lastChecked: new Date().toLocaleTimeString(),
      },
    });
  } catch (err) {
    // Connection failed - save error status
    try {
      const conn = await db('tally_connection').first();
      if (conn) {
        await db('tally_connection').where({ id: conn.id }).update({
          status: 'error', last_checked_at: new Date(), updated_at: new Date(),
        });
      }
    } catch (_) { /* ignore */ }

    res.json({
      success: true,
      data: {
        status: 'error',
        host: req.body.host,
        port: req.body.port,
        tallyVersion: '',
        companyName: '',
        lastChecked: new Date().toLocaleTimeString(),
        error: err.message,
      },
    });
  }
}

// GET /api/tally-connection/relay-status
async function relayStatus(req, res, next) {
  try {
    const connected = wsRelay.isConnected();
    res.json({ success: true, data: { bridgeConnected: connected } });
  } catch (err) { next(err); }
}

module.exports = { get, update, test, relayStatus };
