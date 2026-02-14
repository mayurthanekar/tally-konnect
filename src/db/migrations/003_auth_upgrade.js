// src/db/migrations/003_auth_upgrade.js
// Upgrades auth system: removes password requirement, adds OTP table, adds SSO fields
const { db } = require('../index');
const logger = require('../../utils/logger');

const SUPER_ADMINS = ['mayurt@gofynd.com', 'mayur.thanekar@gmail.com'];

async function up() {
    logger.info('Running migration 003_auth_upgrade...');

    // 1. Make password_hash nullable (SSO/OTP users don't have passwords)
    await db.raw(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

    // 2. Add new columns for SSO/OTP support
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'password'`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
    await db.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);

    // 3. Create OTP codes table
    await db.raw(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'email',
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      attempts INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

    // 4. Index for quick OTP lookups
    await db.raw(`CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_codes(identifier, type)`);

    // 5. Auto-cleanup: delete expired OTPs older than 1 hour
    await db.raw(`DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`);

    // 6. Ensure super admins exist and have admin role
    for (const email of SUPER_ADMINS) {
        const user = await db('users').where({ email }).first();
        if (user) {
            if (user.role !== 'admin') {
                await db('users').where({ email }).update({ role: 'admin' });
                logger.info(`Super admin promoted: ${email}`);
            }
        } else {
            await db('users').insert({
                email,
                password_hash: null,
                name: email === 'mayurt@gofynd.com' ? 'Mayur Thanekar' : 'Mayur',
                role: 'admin',
                auth_provider: 'email_otp',
            });
            logger.info(`Super admin created: ${email}`);
        }
    }

    logger.info('Migration 003_auth_upgrade completed');
}

async function down() {
    await db.raw('DROP TABLE IF EXISTS otp_codes CASCADE');
    await db.raw(`ALTER TABLE users DROP COLUMN IF EXISTS auth_provider`);
    await db.raw(`ALTER TABLE users DROP COLUMN IF EXISTS phone`);
    await db.raw(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`);
    logger.info('Migration 003 rolled back');
}

module.exports = { up, down };
