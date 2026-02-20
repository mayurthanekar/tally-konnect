// src/services/tally.client.js
// Core Tally Prime XML communication engine
// Handles: connection testing, voucher import, ledger creation, stock export
const axios = require('axios');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { create } = require('xmlbuilder2');
const config = require('../config');
const logger = require('../utils/logger');
const { TallyConnectionError, TallyCompanyNotOpenError, TallyImportError } = require('../utils/errors');
const wsRelay = require('./ws-relay.service');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
});

class TallyXmlClient {
  constructor(host, port) {
    this.host = host || config.tally.defaultHost;
    this.port = port || config.tally.defaultPort;
    this.baseUrl = `${this.host}:${this.port}`;
    this.timeout = config.tally.requestTimeoutMs;
    this.maxRetries = config.tally.maxRetries;
  }

  /**
   * Send raw XML to Tally and parse response
   */
  async sendRequest(xmlPayload, retries = 0) {
    // ── Route via relay if bridge is connected ────────────────────────────────
    if (wsRelay.isConnected()) {
      return this.sendRequestViaRelay(xmlPayload);
    }

    // ── Direct HTTP (local dev or same-network) ───────────────────────────────
    try {
      const response = await axios.post(this.baseUrl, xmlPayload, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        timeout: this.timeout,
        responseType: 'text',
        validateStatus: () => true,
      });

      if (response.status !== 200) {
        throw new TallyConnectionError(this.host, this.port, `HTTP ${response.status}`);
      }

      const parsed = xmlParser.parse(response.data);
      return { raw: response.data, parsed, status: response.status };
    } catch (err) {
      if (err instanceof TallyConnectionError) throw err;

      if (retries < this.maxRetries && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
        const delay = Math.pow(2, retries) * 1000;
        logger.warn({ retry: retries + 1, delay }, 'Retrying Tally connection...');
        await new Promise(r => setTimeout(r, delay));
        return this.sendRequest(xmlPayload, retries + 1);
      }

      throw new TallyConnectionError(this.host, this.port, err.message || err.code);
    }
  }

  /**
   * Send XML to Tally via the WS relay bridge.
   * The raw XML string goes to the bridge's local axios call; response XML comes back.
   */
  async sendRequestViaRelay(xmlPayload) {
    try {
      logger.info('[Relay] Proxying Tally request via WebSocket bridge');
      const rawXml = await wsRelay.proxyRequest(xmlPayload, this.timeout + 5000);
      const parsed = xmlParser.parse(rawXml);
      return { raw: rawXml, parsed, status: 200 };
    } catch (err) {
      throw new TallyConnectionError('relay', 'ws', err.message);
    }
  }

  // =============================================
  // CONNECTION TEST
  // =============================================

  /**
   * Test connection by requesting company list
   * Returns: { connected, tallyVersion, companyName }
   */
  async testConnection() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const result = await this.sendRequest(xml);

    // Parse company list from response
    let companyName = '';
    let tallyVersion = '';

    try {
      const envelope = result.parsed?.ENVELOPE || result.parsed?.envelope;
      if (envelope) {
        // Extract company name
        const body = envelope.BODY || envelope.body;
        if (body) {
          const data = body.DATA || body.data;
          if (data) {
            const collection = data.COLLECTION || data.collection;
            if (collection) {
              const companies = collection.COMPANY || collection.company;
              if (Array.isArray(companies)) {
                companyName = companies[0]?.['@_NAME'] || companies[0]?.['#text'] || companies[0] || '';
              } else if (companies) {
                companyName = companies['@_NAME'] || companies['#text'] || String(companies);
              }
            }
          }
        }
        // Try to get Tally version from header
        const header = envelope.HEADER || envelope.header;
        if (header) {
          tallyVersion = header.TALLYVERSION || header.VERSION || '';
        }
      }
    } catch (parseErr) {
      logger.warn({ parseErr }, 'Could not parse Tally response details');
    }

    if (!companyName) {
      // Tally responded but no company open - try a simpler check
      if (result.raw && result.raw.includes('ENVELOPE')) {
        // Tally is running, just no company
        return {
          connected: true,
          tallyVersion: tallyVersion || 'Tally Prime',
          companyName: '(No company open)',
        };
      }
    }

    return {
      connected: true,
      tallyVersion: tallyVersion || 'Tally Prime',
      companyName: companyName || '(Could not detect)',
    };
  }

  // =============================================
  // VOUCHER IMPORT (Fynd -> Tally)
  // =============================================

  /**
   * Import vouchers into Tally
   * @param {Array} vouchers - Array of voucher objects
   * @param {string} voucherType - e.g. 'Sales', 'Credit Note', 'Sales Order'
   * @param {Array} fieldMappings - Array of { apiField, tallyXml, tallyField }
   * @returns {{ success: number, failed: number, errors: Array }}
   */
  async importVouchers(vouchers, voucherType, fieldMappings) {
    const xmlVouchers = vouchers.map((v, idx) =>
      this.buildVoucherXml(v, voucherType, fieldMappings, idx)
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>##SVCURRENTCOMPANY</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${xmlVouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const result = await this.sendRequest(xml);
    return this.parseImportResponse(result);
  }

  /**
   * Build a single Tally VOUCHER XML from a data row + field mappings
   */
  buildVoucherXml(row, voucherType, mappings, index) {
    // Helper to get mapped value
    const getVal = (tallyXmlKey) => {
      const mapping = mappings.find(m => m.tallyXml === tallyXmlKey || m.tally_xml_key === tallyXmlKey);
      if (!mapping) return '';
      const apiField = mapping.apiField || mapping.api_field;
      return row[apiField] != null ? this.escapeXml(String(row[apiField])) : '';
    };

    const date = (getVal('DATE') || '').replace(/-/g, '');
    const partyName = getVal('PARTYNAME') || getVal('PARTYLEDGERNAME') || '';
    const narration = getVal('NARRATION') || `Fynd Order: ${getVal('REFERENCE') || index}`;
    const reference = getVal('REFERENCE') || '';
    const stockItem = getVal('STOCKITEMNAME') || '';
    const qty = getVal('BILLEDQTY') || '0';
    const rate = getVal('RATE') || '0';
    const amount = getVal('AMOUNT') || String(parseFloat(qty) * parseFloat(rate));
    const hsnCode = getVal('HSNCODE') || '';
    const cgst = getVal('CGST') || '';
    const sgst = getVal('SGST') || '';
    const igst = getVal('IGST') || '';

    let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER VCHTYPE="${voucherType}" ACTION="Create" OBJVIEW="Invoice Voucher View">
  <DATE>${date}</DATE>
  <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
  <PARTYNAME>${partyName}</PARTYNAME>
  <NARRATION>${narration}</NARRATION>
  <REFERENCE>${reference}</REFERENCE>
  <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
  <BASICBUYERADDRESS.LIST>
    <BASICBUYERADDRESS>${getVal('ADDRESS') || ''}</BASICBUYERADDRESS>
  </BASICBUYERADDRESS.LIST>
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>${partyName}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-${amount}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>
  <ALLINVENTORYENTRIES.LIST>
    <STOCKITEMNAME>${stockItem}</STOCKITEMNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <BILLEDQTY>${qty}</BILLEDQTY>
    <RATE>${rate}</RATE>
    <AMOUNT>${amount}</AMOUNT>
    ${hsnCode ? `<HSNCODE>${hsnCode}</HSNCODE>` : ''}
  </ALLINVENTORYENTRIES.LIST>`;

    // Tax ledger entries - GSTIN flows directly from data
    if (cgst && parseFloat(cgst) > 0) {
      xml += `
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>CGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>${cgst}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>`;
    }
    if (sgst && parseFloat(sgst) > 0) {
      xml += `
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>SGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>${sgst}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>`;
    }
    if (igst && parseFloat(igst) > 0) {
      xml += `
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>IGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>${igst}</AMOUNT>
  </ALLLEDGERENTRIES.LIST>`;
    }

    xml += `
</VOUCHER>
</TALLYMESSAGE>`;

    return xml;
  }

  // =============================================
  // PARTY / LEDGER CREATION
  // =============================================

  /**
   * Create party master ledgers in Tally
   * @param {Array} parties - [{ party_name, gstin, address, state, pincode, gst_reg_type, party_group }]
   */
  async createPartyMasters(parties, b2bSettings) {
    const xmlLedgers = parties.map(p => {
      const name = this.escapeXml(p.party_name || p.buyer_name || '');
      const gstin = p.gstin || p.buyer_gstin || '';
      const address = this.escapeXml(p.address || p.buyer_address || '');
      const state = this.escapeXml(p.state || p.buyer_state || b2bSettings.default_state || 'Maharashtra');
      const pincode = p.pincode || p.buyer_pincode || '';
      const group = this.escapeXml(b2bSettings.party_group || 'Sundry Debtors');
      const regType = this.escapeXml(b2bSettings.gst_reg_type || 'Regular');

      return `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<LEDGER NAME="${name}" ACTION="Create">
  <NAME>${name}</NAME>
  <PARENT>${group}</PARENT>
  <GSTIN>${gstin}</GSTIN>
  <GSTREGISTRATIONTYPE>${regType}</GSTREGISTRATIONTYPE>
  <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
  <LEDSTATENAME>${state}</LEDSTATENAME>
  <PINCODE>${pincode}</PINCODE>
  <ADDRESS.LIST>
    <ADDRESS>${address}</ADDRESS>
  </ADDRESS.LIST>
</LEDGER>
</TALLYMESSAGE>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
${xmlLedgers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const result = await this.sendRequest(xml);
    return this.parseImportResponse(result);
  }

  // =============================================
  // STOCK EXPORT (Tally -> Fynd)
  // =============================================

  /**
   * Export closing stock from Tally
   */
  async exportClosingStock() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Summary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const result = await this.sendRequest(xml);
    return this.parseStockResponse(result);
  }

  /**
   * Export sales register / day book from Tally
   * @param {string} reportName - 'Sales Register', 'Day Book', etc.
   * @param {string} fromDate - YYYYMMDD
   * @param {string} toDate - YYYYMMDD
   */
  async exportReport(reportName, fromDate, toDate) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>${this.escapeXml(reportName)}</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE>${fromDate}</SVFROMDATE>
        <SVTODATE>${toDate}</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const result = await this.sendRequest(xml);
    return result;
  }

  // =============================================
  // RESPONSE PARSERS
  // =============================================

  parseImportResponse(result) {
    let success = 0;
    let failed = 0;
    const errors = [];

    try {
      const envelope = result.parsed?.ENVELOPE || result.parsed?.envelope || {};
      const body = envelope.BODY || envelope.body || {};
      const importResult = body.DATA || body.data || body.IMPORTRESULT || {};

      // Tally returns CREATED, ALTERED, COMBINED, CANCELLED, etc.
      if (importResult.CREATED !== undefined) success = parseInt(importResult.CREATED, 10) || 0;
      if (importResult.ALTERED !== undefined) success += parseInt(importResult.ALTERED, 10) || 0;

      // Check for line errors
      const lineErrors = importResult.LINEERROR || importResult.ERRORS || '';
      if (lineErrors) {
        const errLines = typeof lineErrors === 'string' ? lineErrors.split('\n').filter(Boolean) : [String(lineErrors)];
        failed = errLines.length;
        errors.push(...errLines);
      }

      // If no success count detected, try raw text
      if (success === 0 && failed === 0 && result.raw) {
        const createdMatch = result.raw.match(/CREATED[^<]*?(\d+)/i);
        if (createdMatch) success = parseInt(createdMatch[1], 10);
        const errorMatch = result.raw.match(/LINEERROR[^<]*?([^<]+)/i);
        if (errorMatch) {
          errors.push(errorMatch[1]);
          failed = 1;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Error parsing Tally import response');
      errors.push('Could not parse Tally response');
    }

    return { success, failed, errors, rawResponse: result.raw };
  }

  parseStockResponse(result) {
    const items = [];
    try {
      const envelope = result.parsed?.ENVELOPE || {};
      const body = envelope.BODY || {};
      const data = body.DATA || {};
      const collection = data.COLLECTION || {};
      const stockItems = collection.STOCKITEM || [];
      const list = Array.isArray(stockItems) ? stockItems : [stockItems];

      for (const item of list) {
        if (!item) continue;
        items.push({
          name: item['@_NAME'] || item.NAME || '',
          closingBalance: item.CLOSINGBALANCE || item.CLOSINGVALUE || 0,
          closingRate: item.CLOSINGRATE || 0,
          closingQuantity: item.CLOSINGQTY || 0,
          group: item.PARENT || item.STOCKGROUP || '',
          unit: item.BASEUNITS || '',
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Error parsing stock response');
    }
    return items;
  }

  // =============================================
  // FULL XML GENERATION (for download)
  // =============================================

  /**
   * Generate complete Tally import XML from import_data rows
   * GSTIN flows directly from data - no validation/filtering
   */
  generateFullVoucherXml(rows, fieldMappings, voucherType = 'Sales') {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER>\n<TALLYREQUEST>Import Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<IMPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>Vouchers</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n';

    for (let i = 0; i < rows.length; i++) {
      xml += this.buildVoucherXml(rows[i], voucherType, fieldMappings, i);
      xml += '\n';
    }

    xml += '</REQUESTDATA>\n</IMPORTDATA>\n</BODY>\n</ENVELOPE>';
    return xml;
  }

  /**
   * Generate party masters XML from unique parties in import data
   * GSTIN flows directly as-is from data input to Tally
   */
  generatePartyMastersXml(rows, b2bSettings, partyNameCol, gstinCol) {
    const seen = new Set();
    const uniqueParties = [];

    for (const row of rows) {
      const name = row[partyNameCol || 'buyer_name'];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      uniqueParties.push(row);
    }

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER>\n<TALLYREQUEST>Import Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<IMPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>All Masters</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n';

    for (const row of uniqueParties) {
      const name = this.escapeXml(row[partyNameCol || 'buyer_name'] || '');
      // GSTIN flows directly from data - no validation
      const gstin = row[gstinCol || 'buyer_gstin'] || '';
      const address = this.escapeXml(row[b2bSettings.address_col || 'buyer_address'] || '');
      const state = this.escapeXml(row[b2bSettings.state_col || 'buyer_state'] || b2bSettings.default_state || '');
      const pincode = row[b2bSettings.pincode_col || 'buyer_pincode'] || '';
      const group = this.escapeXml(b2bSettings.party_group || 'Sundry Debtors');
      const regType = this.escapeXml(b2bSettings.gst_reg_type || 'Regular');

      xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF">
<LEDGER NAME="${name}" ACTION="Create">
  <NAME>${name}</NAME>
  <PARENT>${group}</PARENT>
  <GSTIN>${gstin}</GSTIN>
  <GSTREGISTRATIONTYPE>${regType}</GSTREGISTRATIONTYPE>
  <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
  <LEDSTATENAME>${state}</LEDSTATENAME>
  <PINCODE>${pincode}</PINCODE>
  <ADDRESS.LIST>
    <ADDRESS>${address}</ADDRESS>
  </ADDRESS.LIST>
</LEDGER>
</TALLYMESSAGE>\n`;
    }

    xml += '</REQUESTDATA>\n</IMPORTDATA>\n</BODY>\n</ENVELOPE>';
    return xml;
  }

  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = TallyXmlClient;
