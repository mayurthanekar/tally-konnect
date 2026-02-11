/**
 * Build Tally Import Data XML for vouchers.
 * Format: ENVELOPE > BODY > IMPORTDATA > REQUESTDATA > TALLYMESSAGE > VOUCHER
 * Date format: YYYYMMDD. Amount: positive = debit, negative = credit (for LEDGERENTRIES).
 */

function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date for Tally (YYYYMMDD).
 */
function tallyDate(isoOrYmd) {
  if (!isoOrYmd) return '';
  const s = String(isoOrYmd).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + m[2] + m[3];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.replace(/-/g, '');
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${mo}${day}`;
}

/**
 * Build a single Receipt or Payment voucher XML.
 * Receipt: money in -> Debit Konnect ledger, Credit Cash/Party
 * Payment: money out -> Debit Cash/Party, Credit Konnect ledger
 */
function buildVoucherXml(voucher, options = {}) {
  const {
    konnectLedger = 'Konnect Bank',
    defaultCreditLedger = 'Cash',
    voucherTypeReceipt = 'Receipt',
    voucherTypePayment = 'Payment',
  } = options;

  const date = tallyDate(voucher.date);
  const amount = Math.abs(Number(voucher.amount) || 0);
  const narration = (voucher.description || voucher.id || 'Konnect import').slice(0, 255);
  const isCredit = String(voucher.type || '').toLowerCase() === 'credit';

  const vchType = isCredit ? voucherTypeReceipt : voucherTypePayment;
  // Receipt: Debit Konnect (ISDEEMEDPOSITIVE Yes), Credit Cash (ISDEEMEDPOSITIVE No, negative amount)
  // Payment: Debit Cash (Yes), Credit Konnect (No, negative)
  const ledger1 = isCredit ? konnectLedger : defaultCreditLedger;
  const ledger2 = isCredit ? defaultCreditLedger : konnectLedger;
  const amt1 = amount;
  const amt2 = -amount;

  return `
<TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER Action="Create">
  <DATE>${escapeXml(date)}</DATE>
  <VOUCHERTYPENAME>${escapeXml(vchType)}</VOUCHERTYPENAME>
  <NARRATION>${escapeXml(narration)}</NARRATION>
  <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
  <ISINVOICE>No</ISINVOICE>
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>${escapeXml(ledger1)}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>${amt1}</AMOUNT>
  </LEDGERENTRIES.LIST>
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>${escapeXml(ledger2)}</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>${amt2}</AMOUNT>
  </LEDGERENTRIES.LIST>
</VOUCHER>
</TALLYMESSAGE>`;
}

/**
 * Build full ENVELOPE for Import Data with multiple vouchers.
 */
function buildImportEnvelope(vouchers, options = {}) {
  const tallyMessages = vouchers
    .map((v) => buildVoucherXml(v, options))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
${tallyMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

module.exports = {
  escapeXml,
  tallyDate,
  buildVoucherXml,
  buildImportEnvelope,
};
