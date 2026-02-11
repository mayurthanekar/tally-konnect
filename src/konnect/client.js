/**
 * Konnect History API client.
 * Fetches transactions for a date range. Adapt KONNECT_BASE_URL and
 * KONNECT_HISTORY_PATH to match your Konnect provider's actual History API.
 */

const fetch = (...args) => require('node-fetch')(...args);
const config = require('../config');

/**
 * Fetch transaction history from Konnect API for the given date range.
 * @param {string} fromDate - ISO 8601 date or YYYY-MM-DD
 * @param {string} toDate - ISO 8601 date or YYYY-MM-DD
 * @returns {Promise<Array>} Array of transaction objects
 */
async function fetchHistory(fromDate, toDate) {
  const base = config.konnect.baseUrl.replace(/\/$/, '');
  const path = config.konnect.historyPath.replace(/^\//, '');
  const url = new URL(path, base + '/');

  // Append date filter (common patterns: fromDate/toDate, startDate/endDate, from/to)
  url.searchParams.set('fromDate', normalizeDate(fromDate));
  url.searchParams.set('toDate', normalizeDate(toDate));

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (config.konnect.apiKey) {
    headers.Authorization = `Bearer ${config.konnect.apiKey}`;
  }

  const res = await fetch(url.toString(), { method: 'GET', headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Konnect API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return normalizeResponse(data);
}

/**
 * Normalize API response to a standard shape: { transactions: [ { id, date, amount, type, description } ] }
 * Adapt this if your Konnect API returns a different structure.
 */
function normalizeResponse(data) {
  if (Array.isArray(data)) return data;
  if (data.transactions && Array.isArray(data.transactions)) return data.transactions;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.payments && Array.isArray(data.payments)) {
    return data.payments.map((p) => ({
      id: p.id,
      date: p.createdAt || p.date || p.expirationDate,
      amount: p.amount ?? p.reachedAmount ?? p.convertedAmount,
      type: (p.reachedAmount > 0 || p.status === 'completed') ? 'credit' : 'debit',
      description: p.details || p.orderId || p.shortId || p.id,
      currency: p.token || 'INR',
    }));
  }
  return [];
}

function normalizeDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return s;
  return date.toISOString().slice(0, 10);
}

module.exports = { fetchHistory, normalizeResponse, normalizeDate };
