// src/api.js  -  Frontend API Bridge
// Every function here maps to a backend endpoint
// Used by App.jsx to replace all setTimeout / fake actions

const BASE = process.env.REACT_APP_API_URL || '/api';

async function request(method, path, body = null) {
  const pwd = localStorage.getItem('tally_konnect_pwd');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-password': pwd || ''
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function downloadBlob(method, path, body, filename) {
  const pwd = localStorage.getItem('tally_konnect_pwd');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-password': pwd || ''
    }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${BASE}${path}`, opts).then(r => r.blob()).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

const api = {
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
    const pwd = localStorage.getItem('tally_konnect_pwd');
    return fetch(`${BASE}/mappings/upload`, { method: 'POST', body: fd, headers: { 'x-api-password': pwd || '' } }).then(r => r.json());
  },
  exportMapping: () => downloadBlob('GET', '/mappings/export', null, 'tally-konnect-mapping.json'),
  getMappingsJson: () => request('GET', '/mappings/json'),
  loadSampleMapping: () => request('POST', '/mappings/sample'),
  validateMappings: () => request('GET', '/mappings/validate'),

  // Data Import
  uploadImportFile: (file) => {
    const fd = new FormData(); fd.append('file', file);
    const pwd = localStorage.getItem('tally_konnect_pwd');
    return fetch(`${BASE}/import/upload`, { method: 'POST', body: fd, headers: { 'x-api-password': pwd || '' } }).then(r => r.json());
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

  // Auth
  setPassword: (pwd) => { localStorage.setItem('tally_konnect_pwd', pwd); },
  clearPassword: () => { localStorage.removeItem('tally_konnect_pwd'); },
  isLoggedIn: () => !!localStorage.getItem('tally_konnect_pwd'),
};

export default api;
