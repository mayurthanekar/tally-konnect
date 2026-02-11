// src/middleware/index.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

// ===========================================
// ERROR HANDLER
// ===========================================
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, path: req.path }, err.message);
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${config.upload.maxFileSizeMB}MB limit` },
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_UPLOAD', message: 'Unexpected file field' },
    });
  }

  // Unexpected errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

// ===========================================
// REQUEST VALIDATION (Zod)
// ===========================================
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
      const result = schema.parse(data);
      if (source === 'body') req.body = result;
      else if (source === 'params') req.params = { ...req.params, ...result };
      else req.query = result;
      next();
    } catch (err) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: err.errors || err.message,
        },
      });
    }
  };
}

// ===========================================
// FILE UPLOAD (Multer)
// ===========================================
const uploadDir = config.upload.tempDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.xlsx', '.xls', '.csv', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('INVALID_FILE_TYPE', `File type ${ext} not allowed. Accepted: ${allowedExts.join(', ')}`, 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSizeMB * 1024 * 1024 },
});

// ===========================================
// RATE LIMITERS
// ===========================================
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});

const testConnectionLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.testConnectionMax,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many test connection requests' } },
});

// ===========================================
// SSRF PROTECTION - validate Tally host URL
// ===========================================
function validateTallyUrl(host) {
  try {
    const url = new URL(host);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    // Block file://, javascript://, data:// etc.
    return true;
  } catch {
    return false;
  }
}

// ===========================================
// AUDIT LOGGER
// ===========================================
function auditLog(action) {
  return (req, res, next) => {
    const original = res.json.bind(res);
    res.json = (body) => {
      logger.info({
        action,
        method: req.method,
        path: req.path,
        params: req.params,
        ip: req.ip,
        success: body?.success !== false,
      }, `AUDIT: ${action}`);
      return original(body);
    };
    next();
  };
}

module.exports = {
  errorHandler,
  validate,
  upload,
  generalLimiter,
  testConnectionLimiter,
  validateTallyUrl,
  auditLog,
};
