// src/api.js  -  Frontend API Bridge
// Every function here maps to a backend endpoint
// Uses JWT Bearer token for authentication

const BASE = process.env.REACT_APP_API_URL || '/api';

function getToken() {
  return localStorage.getItem('tally_konnect_token') || '';
}

function getHeaders(includeContentType = true) {
  const h = {};
  if (includeContentType) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body = null) {
  const opts = { method, headers: getHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);

  // Auto-logout on 401 (expired JWT)
  if (res.status === 401 && getToken()) {
    api.clearToken();
    window.location.reload();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Request failed: ${res.status}`;
    const error = new Error(msg);
    error.status = res.status;
    error.code = err.error?.code;
    throw error;
  }
  return res.json();
}

function downloadBlob(method, path, body, filename) {
  const opts = { method, headers: getHeaders() };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${BASE}${path}`, opts).then(r => {
    if (!r.ok) throw new Error(`Download failed: ${r.status}`);
    return r.blob();
  }).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });
}

const api = {
  // Auth — SSO + OTP
  getAuthConfig: () => request('GET', '/auth/config'),
  sendEmailOtp: (email) => request('POST', '/auth/otp/send-email', { email }),
  sendMobileOtp: (phone) => request('POST', '/auth/otp/send-mobile', { phone }),
  verifyOtp: (identifier, otp, type = 'email') => request('POST', '/auth/otp/verify', { identifier, otp, type }),
  getMe: () => request('GET', '/auth/me'),
  getUsers: () => request('GET', '/auth/users'),
  updateUser: (id, data) => request('PATCH', `/auth/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/auth/users/${id}`),

  // Google OAuth (server-side — full page redirect)
  googleLogin: () => { window.location.href = `${BASE}/auth/google`; },
  // Microsoft OAuth (server-side — full page redirect)
  microsoftLogin: () => { window.location.href = `${BASE}/auth/microsoft`; },

  // Token management
  setToken: (token) => { localStorage.setItem('tally_konnect_token', token); },
  clearToken: () => { localStorage.removeItem('tally_konnect_token'); localStorage.removeItem('tally_konnect_user'); },
  getStoredUser: () => { try { return JSON.parse(localStorage.getItem('tally_konnect_user')); } catch { return null; } },
  setStoredUser: (user) => { localStorage.setItem('tally_konnect_user', JSON.stringify(user)); },
  isLoggedIn: () => !!localStorage.getItem('tally_konnect_token'),

  // Tally Connection
  getTallyConnection: () => request('GET', '/tally-connection'),
  updateTallyConnection: (data) => request('PUT', '/tally-connection', data),
  testTallyConnection: (host, port) => request('POST', '/tally-connection/test', { host, port }),

  // Dashboard
  getDashboardStats: () => request('GET', '/dashboard/stats'),
  runAllSyncs: () => request('POST', '/sync/run-all'),

  // API Configs
  getConfigs: () => request('GET', '/configs'),
  saveConfig: (id, data) => request('PUT', `/configs/${id}`, data),
  toggleConfig: (id) => request('PATCH', `/configs/${id}/toggle`),
  testModuleConnection: (id) => request('POST', `/configs/${id}/test`),

  // Field Mapping
  getMappings: () => request('GET', '/mappings'),
  saveMappings: (mappings) => request('POST', '/mappings', { mappings }),
  uploadMapping: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return fetch(`${BASE}/mappings/upload`, { method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${getToken()}` } }).then(r => r.json());
  },
  exportMapping: () => downloadBlob('GET', '/mappings/export', null, 'tally-konnect-mapping.json'),
  getMappingsJson: () => request('GET', '/mappings/json'),
  loadSampleMapping: () => request('POST', '/mappings/sample'),
  validateMappings: () => request('GET', '/mappings/validate'),

  // Data Import
  uploadImportFile: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return fetch(`${BASE}/import/upload`, { method: 'POST', body: fd, headers: { 'Authorization': `Bearer ${getToken()}` } }).then(r => r.json());
  },
  getImportData: (batchId) => request('GET', `/import/data/${batchId}`),
  clearImportData: (batchId) => request('DELETE', `/import/data/${batchId}`),
  generateXml: (batchId) => downloadBlob('POST', '/import/generate-xml', { batchId }, 'tally-vouchers.xml'),
  generatePartyXml: (batchId) => downloadBlob('POST', '/import/party-masters-xml', { batchId }, 'tally-party-masters.xml'),
  loadSampleImport: () => request('POST', '/import/sample'),

  // B2B Settings
  getB2bSettings: () => request('GET', '/b2b-settings'),
  saveB2bSettings: (data) => request('PUT', '/b2b-settings', data),
  getDetectedParties: () => request('GET', '/b2b-settings/parties'),

  // Scheduler
  getSchedules: () => request('GET', '/schedules'),
  saveSchedule: (id, data) => request('PUT', `/schedules/${id}`, data),
  toggleSchedule: (id) => request('PATCH', `/schedules/${id}/toggle`),
  runNow: (id) => request('POST', `/schedules/${id}/run`),
  getScheduleLogs: (id, page = 1) => request('GET', `/schedules/${id}/logs?page=${page}`),

  // Global
  saveAll: (data) => request('POST', '/save-all', data),
  health: () => request('GET', '/health'),
};

export default api;
