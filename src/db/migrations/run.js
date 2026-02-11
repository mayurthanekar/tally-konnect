// src/db/migrations/run.js
// Run: node src/db/migrations/run.js [up|down]
require('dotenv').config();
const migration = require('./001_initial_schema');
const logger = require('../../utils/logger');

const direction = process.argv[2] || 'up';

(async () => {
  try {
    if (direction === 'down') {
      await migration.down();
    } else {
      await migration.up();
    }
    logger.info(`Migration ${direction} completed`);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, `Migration ${direction} failed`);
    process.exit(1);
  }
})();
