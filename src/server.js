/**
 * Tally Konnect Import Addon - MVP server.
 * Serves a simple UI to set date range, fetch from Konnect History API, and import into Tally.
 */

const express = require('express');
const path = require('path');
const { fetchHistory } = require('./konnect/client');
const { importVouchers, testConnection } = require('./tally/client');
const { konnectToTallyVouchers } = require('./mapper');
const config = require('./config');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3333;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/** Default connection options for the UI (On-Prem URL, Cloud URL from env) */
app.get('/api/connection-defaults', (req, res) => {
  res.json({
    onPremUrl: config.tally.url || 'http://localhost:9000',
    cloudUrl: config.tally.cloudUrl || '',
  });
});

/** Test Tally connection (On-Prem or Cloud). Body: { connectionType, tallyUrl?, cloudUrl?, cloudApiKey? } */
app.post('/api/test-connection', async (req, res) => {
  const { connectionType, tallyUrl, cloudUrl, cloudApiKey } = req.body || {};
  const url = connectionType === 'cloud' ? (cloudUrl || config.tally.cloudUrl) : (tallyUrl || config.tally.url);
  if (!url || !url.trim()) {
    return res.status(400).json({ ok: false, message: 'Please enter Tally URL (On-Prem) or Cloud ERP URL.' });
  }
  const headers = {};
  if (connectionType === 'cloud' && cloudApiKey) {
    headers.Authorization = `Bearer ${cloudApiKey}`;
  }
  try {
    const result = await testConnection({ url: url.trim(), headers });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || 'Connection test failed' });
  }
});

app.post('/api/import', async (req, res) => {
  const fromDate = req.body.fromDate || req.query.fromDate;
  const toDate = req.body.toDate || req.query.toDate;
  const connectionType = req.body.connectionType || 'onprem';
  const tallyUrl = req.body.tallyUrl;
  const cloudUrl = req.body.cloudUrl;
  const cloudApiKey = req.body.cloudApiKey;

  if (!fromDate || !toDate) {
    return res.status(400).json({
      success: false,
      error: 'Missing fromDate or toDate (use YYYY-MM-DD)',
    });
  }

  const effectiveUrl = connectionType === 'cloud' ? (cloudUrl || config.tally.cloudUrl) : (tallyUrl || config.tally.url);
  const tallyOptions = {};
  if (effectiveUrl) tallyOptions.url = effectiveUrl.trim();
  if (connectionType === 'cloud' && cloudApiKey) tallyOptions.headers = { Authorization: `Bearer ${cloudApiKey}` };

  try {
    const transactions = await fetchHistory(fromDate, toDate);
    const vouchers = konnectToTallyVouchers(transactions);
    const result = await importVouchers(vouchers, tallyOptions);

    res.json({
      success: result.success,
      konnectFetched: transactions.length,
      tallyCreated: result.created,
      tallyAltered: result.altered,
      tallyErrors: result.errors,
      message: result.message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message || 'Import failed',
    });
  }
});

app.get('/api/preview', async (req, res) => {
  const fromDate = req.query.fromDate;
  const toDate = req.query.toDate;
  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'Missing fromDate or toDate' });
  }
  try {
    const transactions = await fetchHistory(fromDate, toDate);
    const vouchers = konnectToTallyVouchers(transactions);
    res.json({ count: vouchers.length, transactions, vouchers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** Health check for uptime monitoring and Render health checks */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Tally Konnect Import running at http://${HOST}:${PORT}`);
  console.log('Use On-Prem TallyERP or Cloud ERP from any OS (Linux/Windows).');
});
