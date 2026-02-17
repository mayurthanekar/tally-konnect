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

const { protect, protectBridge } = require('../middleware/auth.middleware');
const auth = require('../controllers/auth.controller');

const router = Router();

// =============================================
// HEALTH CHECK (Public)
// =============================================
router.get('/health', global.health);

// =============================================
// AUTHENTICATION — Public routes
// =============================================
// Auth provider availability
router.get('/auth/config', auth.getAuthConfig);

// Google OAuth
router.get('/auth/google', auth.googleRedirect);
router.get('/auth/google/callback', auth.googleCallback);

// Microsoft OAuth
router.get('/auth/microsoft', auth.microsoftRedirect);
router.get('/auth/microsoft/callback', auth.microsoftCallback);

// Email OTP
router.post('/auth/otp/send-email', auth.sendEmailOtpHandler);
router.post('/auth/otp/test-email', protect, auth.testEmailOtpHandler);

// Mobile OTP
router.post('/auth/otp/send-mobile', auth.sendMobileOtpHandler);

// OTP verification (both email and mobile)
router.post('/auth/otp/verify', auth.verifyOtp);

// Protected auth routes
router.get('/auth/me', protect, auth.me);
router.get('/auth/users', protect, auth.listUsers);
router.patch('/auth/users/:id', protect, auth.updateUser);
router.delete('/auth/users/:id', protect, auth.deleteUser);

// =============================================
// PROTECT ALL SUBSEQUENT ROUTES
// =============================================
// router.use(protect); // We can't use router.use because tally-connection needs dual auth

// =============================================
// TALLY CONNECTION (Dashboard + Bridge)
// =============================================
router.get('/tally-connection', protect, tallyConn.get);

// Allow either standard auth OR bridge auth for updates
router.put('/tally-connection',
    (req, res, next) => {
        // If it's the bridge, it uses x-bridge-key
        if (req.headers['x-bridge-key']) return protectBridge(req, res, next);
        // Otherwise it's the dashboard UI
        return protect(req, res, next);
    },
    validate(v.tallyConnectionUpdate),
    auditLog('tally-connection-update'),
    tallyConn.update
);

router.post('/tally-connection/test', protect, testConnectionLimiter, validate(v.tallyConnectionTest), tallyConn.test);

// Apply protect middleware to all remaining routes
const protectedRouter = Router();
protectedRouter.use(protect);

// Re-map other routes through the protected router or just add protect to each
router.get('/dashboard/stats', protect, dashboard.getStats);
router.post('/sync/run-all', protect, auditLog('sync-run-all'), dashboard.runAll);

router.get('/configs', protect, apiConfig.getAll);
router.put('/configs/:moduleId', protect, validate(v.apiConfigUpdate), auditLog('config-save'), apiConfig.save);
router.patch('/configs/:moduleId/toggle', protect, auditLog('config-toggle'), apiConfig.toggle);
router.post('/configs/:moduleId/test', protect, testConnectionLimiter, apiConfig.testConnection);

router.get('/mappings', protect, mapping.getAll);
router.post('/mappings', protect, validate(v.fieldMappingSave), auditLog('mapping-save'), mapping.save);
router.post('/mappings/upload', protect, upload.single('file'), mapping.upload);
router.get('/mappings/export', protect, mapping.exportMapping);
router.get('/mappings/json', protect, mapping.getJson);
router.post('/mappings/sample', protect, auditLog('mapping-load-sample'), mapping.loadSample);
router.get('/mappings/validate', protect, mapping.validate);

router.post('/import/upload', protect, upload.single('file'), dataImport.uploadFile);
router.get('/import/data/:batchId', protect, dataImport.getData);
router.delete('/import/data/:batchId', protect, dataImport.clearData);
router.post('/import/generate-xml', protect, validate(v.generateXmlRequest), dataImport.generateXml);
router.post('/import/party-masters-xml', protect, validate(v.generateXmlRequest), dataImport.generatePartyXml);
router.post('/import/sample', protect, dataImport.loadSample);

router.get('/b2b-settings', protect, b2b.get);
router.put('/b2b-settings', protect, validate(v.b2bSettingsUpdate), auditLog('b2b-settings-update'), b2b.update);
router.get('/b2b-settings/parties', protect, b2b.getParties);

router.get('/schedules', protect, scheduler.getAll);
router.put('/schedules/:moduleId', protect, validate(v.scheduleUpdate), auditLog('schedule-update'), scheduler.save);
router.patch('/schedules/:moduleId/toggle', protect, auditLog('schedule-toggle'), scheduler.toggle);
router.post('/schedules/:moduleId/run', protect, auditLog('schedule-run-now'), scheduler.runNow);
router.get('/schedules/:moduleId/logs', protect, scheduler.getLogs);

router.post('/save-all', protect, auditLog('save-all'), global.saveAll);

module.exports = router;
