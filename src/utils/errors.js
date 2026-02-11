// src/utils/errors.js
// Structured error classes for consistent API error responses

class AppError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// --- Tally Errors ---
class TallyConnectionError extends AppError {
  constructor(host, port, details) {
    super('TALLY_CONNECTION_FAILED', `Could not reach Tally at ${host}:${port}`, 502, details);
  }
}

class TallyCompanyNotOpenError extends AppError {
  constructor() {
    super('TALLY_COMPANY_NOT_OPEN', 'Tally is running but no company is currently open', 502);
  }
}

class TallyImportError extends AppError {
  constructor(details) {
    super('TALLY_IMPORT_ERROR', 'Tally voucher import returned errors', 422, details);
  }
}

// --- Fynd Errors ---
class FyndAuthError extends AppError {
  constructor(details) {
    super('FYND_AUTH_FAILED', 'Fynd API authentication failed or expired', 401, details);
  }
}

class FyndApiError extends AppError {
  constructor(details) {
    super('FYND_API_ERROR', 'Fynd API returned an error', 502, details);
  }
}

// --- Validation Errors ---
class InvalidFileFormatError extends AppError {
  constructor(details) {
    super('INVALID_FILE_FORMAT', 'Uploaded file could not be parsed', 400, details);
  }
}

class InvalidCronError extends AppError {
  constructor(expression) {
    super('INVALID_CRON', `Invalid cron expression: ${expression}`, 400);
  }
}

class ConfigValidationError extends AppError {
  constructor(details) {
    super('CONFIG_VALIDATION_ERROR', 'Configuration validation failed', 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super('NOT_FOUND', `${resource} not found: ${id}`, 404);
  }
}

class EncryptionError extends AppError {
  constructor(details) {
    super('ENCRYPTION_ERROR', 'Failed to encrypt/decrypt sensitive data', 500, details);
  }
}

module.exports = {
  AppError,
  TallyConnectionError,
  TallyCompanyNotOpenError,
  TallyImportError,
  FyndAuthError,
  FyndApiError,
  InvalidFileFormatError,
  InvalidCronError,
  ConfigValidationError,
  NotFoundError,
  EncryptionError,
};
