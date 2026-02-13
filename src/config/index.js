// src/config/index.js
// Centralised configuration - reads from env vars with sensible defaults
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  host: process.env.HOST || '0.0.0.0',

  // Database — supports both DATABASE_URL (Render/Neon) and individual vars
  db: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'tally_konnect',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' || !!process.env.DATABASE_URL,  // Auto-enable SSL for DATABASE_URL
    pool: {
      min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
    },
  },

  // Security
  runMigrations: process.env.RUN_MIGRATIONS === 'true' || true,
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
    corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://tally-konnect.onrender.com' : '*'),
    masterPassword: process.env.MASTER_PASSWORD || '', // Human login
    bridgeApiKey: process.env.BRIDGE_API_KEY || '',     // Tally Bridge Agent
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
    testConnectionMax: parseInt(process.env.RATE_LIMIT_TEST_MAX, 10) || 10,
  },

  // File uploads
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
    tempDir: process.env.UPLOAD_TEMP_DIR || '/tmp/tally-konnect-uploads',
  },

  // Tally defaults
  tally: {
    defaultHost: process.env.TALLY_DEFAULT_HOST || 'http://localhost',
    defaultPort: process.env.TALLY_DEFAULT_PORT || '9000',
    timeout: parseInt(process.env.TALLY_TIMEOUT_MS, 10) || 30000,
    retries: parseInt(process.env.TALLY_RETRIES, 10) || 2,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty'),
  },
};

module.exports = config;
