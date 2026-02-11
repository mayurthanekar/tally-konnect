/**
 * Map Konnect History API transaction list to Tally voucher list.
 * Input: array of { id, date, amount, type, description, currency?, ... }
 * Output: array of { date, amount, type, description, id } for Tally XML.
 */

function konnectToTallyVouchers(transactions) {
  if (!Array.isArray(transactions)) return [];
  return transactions
    .filter((t) => t && (t.amount != null && Number(t.amount) !== 0))
    .map((t) => ({
      id: t.id || t.paymentId || t.transactionId,
      date: t.date || t.createdAt || t.transactionDate || new Date().toISOString().slice(0, 10),
      amount: Number(t.amount) || 0,
      type: normalizeType(t.type, t.amount),
      description: t.description || t.details || t.narration || t.orderId || t.shortId || t.id || 'Konnect',
      currency: t.currency || 'INR',
    }));
}

function normalizeType(type, amount) {
  const s = String(type || '').toLowerCase();
  if (s === 'credit' || s === 'cr' || s === 'in') return 'credit';
  if (s === 'debit' || s === 'dr' || s === 'out') return 'debit';
  if (amount != null && Number(amount) > 0) return 'credit';
  return 'debit';
}

module.exports = { konnectToTallyVouchers };
