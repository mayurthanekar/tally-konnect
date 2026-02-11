// src/controllers/b2bSettings.controller.js
const { db } = require('../db');

// GET /api/b2b-settings
async function get(req, res, next) {
  try {
    let settings = await db('b2b_settings').first();
    if (!settings) {
      [settings] = await db('b2b_settings').insert({
        auto_create_party: true, validate_gstin: true, skip_duplicate_gstin: true,
        party_group: 'Sundry Debtors', gst_reg_type: 'Regular', default_state: 'Maharashtra',
        party_name_col: 'buyer_name', gstin_col: 'buyer_gstin', address_col: 'buyer_address',
        state_col: 'buyer_state', pincode_col: 'buyer_pincode', contact_col: '',
      }).returning('*');
    }

    // Map DB snake_case to frontend camelCase
    res.json({
      success: true,
      data: {
        autoCreateParty: settings.auto_create_party,
        validateGstin: settings.validate_gstin,
        skipDuplicateGstin: settings.skip_duplicate_gstin,
        partyGroup: settings.party_group,
        gstRegType: settings.gst_reg_type,
        defaultState: settings.default_state,
        partyNameCol: settings.party_name_col,
        gstinCol: settings.gstin_col,
        addressCol: settings.address_col,
        stateCol: settings.state_col,
        pincodeCol: settings.pincode_col,
        contactCol: settings.contact_col,
      },
    });
  } catch (err) { next(err); }
}

// PUT /api/b2b-settings
async function update(req, res, next) {
  try {
    const body = req.body;
    const updateData = {
      auto_create_party: body.autoCreateParty,
      validate_gstin: body.validateGstin,
      skip_duplicate_gstin: body.skipDuplicateGstin,
      party_group: body.partyGroup,
      gst_reg_type: body.gstRegType,
      default_state: body.defaultState,
      party_name_col: body.partyNameCol,
      gstin_col: body.gstinCol,
      address_col: body.addressCol,
      state_col: body.stateCol,
      pincode_col: body.pincodeCol,
      contact_col: body.contactCol,
      updated_at: new Date(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

    const existing = await db('b2b_settings').first();
    if (existing) {
      await db('b2b_settings').where({ id: existing.id }).update(updateData);
    } else {
      await db('b2b_settings').insert(updateData);
    }

    res.json({ success: true, message: 'B2B settings updated' });
  } catch (err) { next(err); }
}

// GET /api/b2b-settings/parties  (detected parties from import data)
async function getParties(req, res, next) {
  try {
    const b2b = await db('b2b_settings').first();
    const nameCol = b2b?.party_name_col || 'buyer_name';
    const gstinCol = b2b?.gstin_col || 'buyer_gstin';

    // Get latest batch
    const latestBatch = await db('import_data').select('batch_id').orderBy('created_at', 'desc').first();
    if (!latestBatch) {
      return res.json({ success: true, data: [] });
    }

    const rows = await db('import_data').where({ batch_id: latestBatch.batch_id }).orderBy('row_index');
    const seen = new Set();
    const parties = [];

    for (const row of rows) {
      const data = row.row_data;
      const name = data[nameCol];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      // GSTIN flows as-is from data
      parties.push({
        buyer_name: name,
        buyer_gstin: data[gstinCol] || '',
        buyer_address: data[b2b?.address_col] || '',
        buyer_state: data[b2b?.state_col] || '',
        buyer_pincode: data[b2b?.pincode_col] || '',
      });
    }

    res.json({ success: true, data: parties });
  } catch (err) { next(err); }
}

module.exports = { get, update, getParties };
