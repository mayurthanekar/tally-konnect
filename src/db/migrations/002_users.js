// src/db/migrations/002_users.js
// Creates users table with raw SQL for maximum reliability
const { db } = require('../index');
const logger = require('../../utils/logger');
const bcrypt = require('bcryptjs');

async function up() {
    logger.info('Running migration 002_users...');

    // Use raw SQL with IF NOT EXISTS for idempotent, reliable execution
    await db.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

    // Create index if not exists
    await db.raw(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    // Seed admin user if table is empty
    const result = await db.raw(`SELECT COUNT(*) as count FROM users`);
    const count = parseInt(result.rows[0].count);

    if (count === 0) {
        const hash = await bcrypt.hash('Swami@2026', 12);
        await db('users').insert({
            email: 'mayurt@gofynd.com',
            password_hash: hash,
            name: 'Mayur Thanekar',
            role: 'admin',
        });
        logger.info('Admin user seeded: mayurt@gofynd.com');
    }

    logger.info('Migration 002_users completed');
}

async function down() {
    await db.raw('DROP TABLE IF EXISTS users CASCADE');
    logger.info('Migration 002 rolled back');
}

module.exports = { up, down };
