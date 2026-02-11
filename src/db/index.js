// src/db/index.js
// PostgreSQL connection via Knex query builder
const knex = require('knex');
const config = require('../config');
const logger = require('../utils/logger');

// Build connection config
let connectionConfig;

if (config.db.connectionString) {
  // Use DATABASE_URL (Render, Neon, Supabase, etc.)
  connectionConfig = {
    connectionString: config.db.connectionString,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  };
} else {
  // Use individual connection parameters
  connectionConfig = {
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  };
}

const db = knex({
  client: 'pg',
  connection: connectionConfig,
  pool: config.db.pool,
  acquireConnectionTimeout: 10000,
});

// Test connection on startup
async function testConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connected successfully');
    return true;
  } catch (err) {
    logger.error({ err: err.message }, 'Database connection failed');
    return false;
  }
}

module.exports = { db, testConnection };
