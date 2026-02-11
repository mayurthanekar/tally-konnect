// src/controllers/dataImport.controller.js
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const FileParser = require('../services/file.parser');
const TallyXmlClient = require('../services/tally.client');
const fs = require('fs');
const logger = require('../utils/logger');

const SAMPLE_IMPORT_DATA = [
  { order_date: '2025-06-07', buyer_name: 'Reliance Retail', sku_name: 'Blue T-Shirt XL', qty: 10, selling_price: 599, total: 5990, cgst_amount: 269.55, sgst_amount: 269.55, hsn: '6109', buyer_gstin: '27AABCR1234F1Z5', order_id: 'FY-ORD-10234' },
  { order_date: '2025-06-07', buyer_name: 'DMart', sku_name: 'Red Polo M', qty: 5, selling_price: 799, total: 3995, cgst_amount: 179.78, sgst_amount: 179.78, hsn: '6105', buyer_gstin: '27AAXYZ9876P1ZQ', order_id: 'FY-ORD-10235' },
  { order_date: '2025-06-08', buyer_name: 'Shoppers Stop', sku_name: 'Black Jeans 32', qty: 8, selling_price: 1299, total: 10392, igst_amount: 935.28, hsn: '6204', buyer_gstin: '06AADCS1234H1Z8', order_id: 'FY-ORD-10236' },
];

// POST /api/import/upload
async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const parsed = await FileParser.parse(req.file.path, req.file.originalname);
    const batchId = uuidv4();

    // Store rows in DB
    const dbRows = parsed.rows.map((row, idx) => ({
      batch_id: batchId,
      file_name: req.file.originalname,
      row_index: idx,
      row_data: JSON.stringify(row),
    }));

    // Insert in batches of 100
    for (let i = 0; i < dbRows.length; i += 100) {
      await db('import_data').insert(dbRows.slice(i, i + 100));
    }

    // Cleanup temp file
    fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      data: {
        batchId,
        fileName: req.file.originalname,
        rows: parsed.rows,
        columns: parsed.columns,
        rowCount: parsed.rows.length,
        columnCount: parsed.columns.length,
      },
    });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

// GET /api/import/data/:batchId
async function getData(req, res, next) {
  try {
    const { batchId } = req.params;
    const rows = await db('import_data')
      .where({ batch_id: batchId })
      .orderBy('row_index');

    if (rows.length === 0) {
      return res.json({ success: true, data: { rows: [], columns: [], fileName: '' } });
    }

    const parsedRows = rows.map(r => r.row_data);
    const columns = Object.keys(parsedRows[0] || {});

    res.json({
      success: true,
      data: {
        batchId,
        fileName: rows[0].file_name,
        rows: parsedRows,
        columns,
        rowCount: parsedRows.length,
      },
    });
  } catch (err) { next(err); }
}

// DELETE /api/import/data/:batchId
async function clearData(req, res, next) {
  try {
    const { batchId } = req.params;
    const deleted = await db('import_data').where({ batch_id: batchId }).del();
    res.json({ success: true, message: `Deleted ${deleted} rows` });
  } catch (err) { next(err); }
}

// POST /api/import/generate-xml
async function generateXml(req, res, next) {
  try {
    const { batchId } = req.body;

    const importRows = await db('import_data')
      .where({ batch_id: batchId })
      .orderBy('row_index');

    if (importRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NO_DATA', message: 'No import data found for this batch' } });
    }

    const rows = importRows.map(r => r.row_data);
    const mappings = await db('field_mappings').orderBy('sort_order');

    const tally = new TallyXmlClient();
    // GSTIN flows directly from data - no validation/filtering
    const xml = tally.generateFullVoucherXml(rows, mappings, 'Sales');

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="tally-vouchers.xml"');
    res.send(xml);
  } catch (err) { next(err); }
}

// POST /api/import/party-masters-xml
async function generatePartyXml(req, res, next) {
  try {
    const { batchId } = req.body;

    const importRows = await db('import_data')
      .where({ batch_id: batchId })
      .orderBy('row_index');

    if (importRows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NO_DATA', message: 'No import data found' } });
    }

    const rows = importRows.map(r => r.row_data);
    const b2bSettings = await db('b2b_settings').first() || {};

    const tally = new TallyXmlClient();
    // GSTIN flows directly from buyer data to Tally - no server-side validation
    const xml = tally.generatePartyMastersXml(
      rows, b2bSettings,
      b2bSettings.party_name_col || 'buyer_name',
      b2bSettings.gstin_col || 'buyer_gstin'
    );

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="tally-party-masters.xml"');
    res.send(xml);
  } catch (err) { next(err); }
}

// POST /api/import/sample
async function loadSample(req, res, next) {
  try {
    const batchId = uuidv4();

    const dbRows = SAMPLE_IMPORT_DATA.map((row, idx) => ({
      batch_id: batchId,
      file_name: 'sample_sales_data.xlsx',
      row_index: idx,
      row_data: JSON.stringify(row),
    }));

    await db('import_data').insert(dbRows);

    res.json({
      success: true,
      data: {
        batchId,
        fileName: 'sample_sales_data.xlsx',
        rows: SAMPLE_IMPORT_DATA,
        columns: Object.keys(SAMPLE_IMPORT_DATA[0]),
        rowCount: SAMPLE_IMPORT_DATA.length,
      },
    });
  } catch (err) { next(err); }
}

module.exports = { uploadFile, getData, clearData, generateXml, generatePartyXml, loadSample };
