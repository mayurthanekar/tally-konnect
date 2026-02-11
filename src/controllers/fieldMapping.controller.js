// src/controllers/fieldMapping.controller.js
const { db } = require('../db');
const FileParser = require('../services/file.parser');
const fs = require('fs');
const logger = require('../utils/logger');

const SAMPLE_MAPPING = [
  { apiField: 'order_date', tallyXml: 'DATE', tallyField: 'date', required: true },
  { apiField: 'buyer_name', tallyXml: 'PARTYNAME', tallyField: 'party_name', required: true },
  { apiField: 'sku_name', tallyXml: 'STOCKITEMNAME', tallyField: 'item_name', required: true },
  { apiField: 'qty', tallyXml: 'BILLEDQTY', tallyField: 'quantity', required: true },
  { apiField: 'selling_price', tallyXml: 'RATE', tallyField: 'rate', required: true },
  { apiField: 'total', tallyXml: 'AMOUNT', tallyField: 'amount', required: false },
  { apiField: 'discount_amount', tallyXml: 'DISCOUNT', tallyField: 'discount', required: false },
  { apiField: 'tax_percent', tallyXml: 'TAXRATE', tallyField: 'tax_rate', required: false },
  { apiField: 'cgst_amount', tallyXml: 'CGST', tallyField: 'cgst', required: false },
  { apiField: 'sgst_amount', tallyXml: 'SGST', tallyField: 'sgst', required: false },
  { apiField: 'igst_amount', tallyXml: 'IGST', tallyField: 'igst', required: false },
  { apiField: 'hsn', tallyXml: 'HSNCODE', tallyField: 'hsn_code', required: false },
  { apiField: 'order_id', tallyXml: 'REFERENCE', tallyField: 'reference_no', required: false },
  { apiField: 'buyer_gstin', tallyXml: 'PARTYGSTIN', tallyField: 'buyer_gstin', required: false },
  { apiField: 'buyer_address', tallyXml: 'ADDRESS', tallyField: 'buyer_address', required: false },
  { apiField: 'buyer_state', tallyXml: 'STATENAME', tallyField: 'buyer_state', required: false },
  { apiField: 'narration', tallyXml: 'NARRATION', tallyField: 'narration', required: false },
];

// GET /api/mappings
async function getAll(req, res, next) {
  try {
    const rows = await db('field_mappings').orderBy('sort_order');
    const mappings = rows.map(r => ({
      apiField: r.api_field,
      tallyXml: r.tally_xml_key,
      tallyField: r.tally_field,
      required: r.is_required,
    }));
    res.json({ success: true, data: mappings });
  } catch (err) { next(err); }
}

// POST /api/mappings  (Save mapping config)
async function save(req, res, next) {
  try {
    const { mappings } = req.body;

    // Replace all mappings (delete + insert)
    await db('field_mappings').del();

    if (mappings && mappings.length > 0) {
      const rows = mappings.map((m, idx) => ({
        sort_order: idx,
        api_field: m.apiField || '',
        tally_xml_key: m.tallyXml || '',
        tally_field: m.tallyField || '',
        is_required: m.required || false,
      }));
      await db('field_mappings').insert(rows);
    }

    res.json({ success: true, message: `Saved ${mappings?.length || 0} mappings` });
  } catch (err) { next(err); }
}

// POST /api/mappings/upload  (Upload mapping file)
async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const parsed = await FileParser.parse(req.file.path, req.file.originalname);

    // Convert parsed rows to mapping format
    let mappings;
    if (parsed.fileType === 'json-mapping') {
      mappings = parsed.rows;
    } else {
      // For Excel/CSV, assume columns map to: apiField, tallyXml, tallyField, required
      mappings = parsed.rows.map(row => ({
        apiField: row.apiField || row.api_field || row['API Field'] || Object.values(row)[0] || '',
        tallyXml: row.tallyXml || row.tally_xml || row['Tally XML'] || Object.values(row)[1] || '',
        tallyField: row.tallyField || row.tally_field || row['Tally Field'] || Object.values(row)[2] || '',
        required: row.required || row.is_required || false,
      }));
    }

    // Save to DB
    await db('field_mappings').del();
    if (mappings.length > 0) {
      await db('field_mappings').insert(mappings.map((m, idx) => ({
        sort_order: idx,
        api_field: m.apiField || '',
        tally_xml_key: m.tallyXml || '',
        tally_field: m.tallyField || '',
        is_required: Boolean(m.required),
      })));
    }

    // Cleanup temp file
    fs.unlink(req.file.path, () => {});

    res.json({ success: true, data: { mappings, count: mappings.length } });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

// GET /api/mappings/export  (Download as JSON)
async function exportMapping(req, res, next) {
  try {
    const rows = await db('field_mappings').orderBy('sort_order');
    const mappings = rows.map(r => ({
      apiField: r.api_field,
      tallyXml: r.tally_xml_key,
      tallyField: r.tally_field,
      required: r.is_required,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="tally-konnect-mapping.json"');
    res.json({ mappings });
  } catch (err) { next(err); }
}

// GET /api/mappings/json  (Copy as JSON)
async function getJson(req, res, next) {
  try {
    const rows = await db('field_mappings').orderBy('sort_order');
    const mappings = rows.map(r => ({
      apiField: r.api_field,
      tallyXml: r.tally_xml_key,
      tallyField: r.tally_field,
      required: r.is_required,
    }));
    res.json({ success: true, data: mappings });
  } catch (err) { next(err); }
}

// POST /api/mappings/sample  (Load sample mapping)
async function loadSample(req, res, next) {
  try {
    await db('field_mappings').del();
    await db('field_mappings').insert(SAMPLE_MAPPING.map((m, idx) => ({
      sort_order: idx,
      api_field: m.apiField,
      tally_xml_key: m.tallyXml,
      tally_field: m.tallyField,
      is_required: m.required,
    })));
    res.json({ success: true, data: SAMPLE_MAPPING });
  } catch (err) { next(err); }
}

// GET /api/mappings/validate  (Validate all mappings)
async function validate(req, res, next) {
  try {
    const rows = await db('field_mappings').orderBy('sort_order');
    const REQUIRED_TALLY_FIELDS = ['date', 'party_name', 'item_name', 'quantity', 'rate'];
    const mappedFields = rows.filter(r => r.tally_field).map(r => r.tally_field);

    const missing = REQUIRED_TALLY_FIELDS.filter(f => !mappedFields.includes(f));
    const valid = missing.length === 0;

    res.json({
      success: true,
      data: {
        valid,
        totalMappings: rows.length,
        mappedFields: mappedFields.length,
        requiredMapped: REQUIRED_TALLY_FIELDS.length - missing.length,
        requiredTotal: REQUIRED_TALLY_FIELDS.length,
        missingRequired: missing,
      },
    });
  } catch (err) { next(err); }
}

module.exports = { getAll, save, upload, exportMapping, getJson, loadSample, validate };
