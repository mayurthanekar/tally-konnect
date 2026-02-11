/**
 * Tally (TallyPrime / Tally ERP) client: send Import Data XML to Tally.
 * Supports On-Prem (localhost or LAN URL) and Cloud ERP (HTTPS URL).
 */

const fetch = (...args) => require('node-fetch')(...args);
const config = require('../config');
const { buildImportEnvelope } = require('./xmlBuilder');

/**
 * Import vouchers into Tally Live Company.
 * @param {Array<object>} vouchers - Array of { date, amount, type, description, id }
 * @param {object} [options] - { url?, headers? } Override Tally URL and request headers (for Cloud ERP).
 * @returns {Promise<{ success: boolean, created?: number, altered?: number, errors?: number, raw?: string }>}
 */
async function importVouchers(vouchers, options = {}) {
  if (!vouchers || vouchers.length === 0) {
    return { success: true, created: 0, altered: 0, errors: 0 };
  }

  const xml = buildImportEnvelope(vouchers, {
    konnectLedger: config.tally.konnectLedger,
    defaultCreditLedger: config.tally.defaultCreditLedger,
  });

  const baseUrl = (options.url || config.tally.url || 'http://localhost:9000').replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/xml',
    Accept: 'application/xml',
    ...(options.headers || {}),
  };

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: xml,
  });

  const raw = await res.text();

  if (!res.ok) {
    return {
      success: false,
      errors: 1,
      raw,
      message: `Tally returned ${res.status}: ${raw.slice(0, 500)}`,
    };
  }

  const created = parseInt((raw.match(/<CREATED>(\d+)<\/CREATED>/) || [])[1], 10) || 0;
  const altered = parseInt((raw.match(/<ALTERED>(\d+)<\/ALTERED>/) || [])[1], 10) || 0;
  const errors = parseInt((raw.match(/<ERRORS>(\d+)<\/ERRORS>/) || [])[1], 10) || 0;

  return {
    success: errors === 0,
    created,
    altered,
    errors,
    raw,
  };
}

/** Minimal Tally export XML to verify connection and get company info */
const TEST_CONNECTION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Company Info</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION Name="CompanyInfo">
            <TYPE>Company</TYPE>
            <FETCH>Name,Address</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;

/**
 * Test connection to Tally (On-Prem or Cloud). Returns { ok, message, companyName? }.
 * @param {object} [options] - { url?, headers? }
 */
async function testConnection(options = {}) {
  const baseUrl = (options.url || config.tally.url || 'http://localhost:9000').replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/xml',
    Accept: 'application/xml',
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: TEST_CONNECTION_XML,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const nameMatch = text.match(/<NAME[^>]*>([^<]+)<\/NAME>/);
    const companyName = nameMatch ? nameMatch[1].trim() : null;
    return { ok: true, message: 'Connected', companyName };
  } catch (err) {
    return { ok: false, message: err.message || 'Connection failed' };
  }
}

module.exports = { importVouchers, testConnection };
