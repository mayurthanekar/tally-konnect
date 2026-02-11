// src/routes/index.js
// All 28+ API routes mapped to controllers
const { Router } = require('express');
const { validate, upload, testConnectionLimiter, auditLog } = require('../middleware');
const v = require('../utils/validators');

const tallyConn = require('../controllers/tallyConnection.controller');
const dashboard = require('../controllers/dashboard.controller');
const apiConfig = require('../controllers/apiConfig.controller');
const mapping = require('../controllers/fieldMapping.controller');
const dataImport = require('../controllers/dataImport.controller');
const b2b = require('../controllers/b2bSettings.controller');
const scheduler = require('../controllers/scheduler.controller');
const global = require('../controllers/global.controller');

const router = Router();

// =============================================
// HEALTH CHECK
// =============================================
router.get('/health', global.health);

// =============================================
// TALLY CONNECTION (Dashboard)
// =============================================
router.get('/tally-connection', tallyConn.get);
router.put('/tally-connection', validate(v.tallyConnectionUpdate), auditLog('tally-connection-update'), tallyConn.update);
router.post('/tally-connection/test', testConnectionLimiter, validate(v.tallyConnectionTest), tallyConn.test);

// =============================================
// DASHBOARD
// =============================================
router.get('/dashboard/stats', dashboard.getStats);
router.post('/sync/run-all', auditLog('sync-run-all'), dashboard.runAll);

// =============================================
// API CONFIGURATION
// =============================================
router.get('/configs', apiConfig.getAll);
router.put('/configs/:moduleId', validate(v.apiConfigUpdate), auditLog('config-save'), apiConfig.save);
router.patch('/configs/:moduleId/toggle', auditLog('config-toggle'), apiConfig.toggle);
router.post('/configs/:moduleId/test', testConnectionLimiter, apiConfig.testConnection);

// =============================================
// FIELD MAPPING
// =============================================
router.get('/mappings', mapping.getAll);
router.post('/mappings', validate(v.fieldMappingSave), auditLog('mapping-save'), mapping.save);
router.post('/mappings/upload', upload.single('file'), mapping.upload);
router.get('/mappings/export', mapping.exportMapping);
router.get('/mappings/json', mapping.getJson);
router.post('/mappings/sample', auditLog('mapping-load-sample'), mapping.loadSample);
router.get('/mappings/validate', mapping.validate);

// =============================================
// DATA IMPORT
// =============================================
router.post('/import/upload', upload.single('file'), dataImport.uploadFile);
router.get('/import/data/:batchId', dataImport.getData);
router.delete('/import/data/:batchId', dataImport.clearData);
router.post('/import/generate-xml', validate(v.generateXmlRequest), dataImport.generateXml);
router.post('/import/party-masters-xml', validate(v.generateXmlRequest), dataImport.generatePartyXml);
router.post('/import/sample', dataImport.loadSample);

// =============================================
// B2B SETTINGS
// =============================================
router.get('/b2b-settings', b2b.get);
router.put('/b2b-settings', validate(v.b2bSettingsUpdate), auditLog('b2b-settings-update'), b2b.update);
router.get('/b2b-settings/parties', b2b.getParties);

// =============================================
// SCHEDULER
// =============================================
router.get('/schedules', scheduler.getAll);
router.put('/schedules/:moduleId', validate(v.scheduleUpdate), auditLog('schedule-update'), scheduler.save);
router.patch('/schedules/:moduleId/toggle', auditLog('schedule-toggle'), scheduler.toggle);
router.post('/schedules/:moduleId/run', auditLog('schedule-run-now'), scheduler.runNow);
router.get('/schedules/:moduleId/logs', scheduler.getLogs);

// =============================================
// GLOBAL
// =============================================
router.post('/save-all', auditLog('save-all'), global.saveAll);

module.exports = router;
