// src/db/migrations/002_users.js
const { db } = require('../index');
const logger = require('../../utils/logger');

async function up() {
    logger.info('Running migration 002_users...');

    const exists = await db.schema.hasTable('users');
    if (!exists) {
        await db.schema.createTable('users', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            t.string('email', 255).unique().notNullable();
            t.string('password_hash', 255).notNullable();
            t.string('name', 255).defaultTo('');
            t.enu('role', ['admin', 'user']).notNullable().defaultTo('user');
            t.boolean('is_active').notNullable().defaultTo(true);
            t.timestamps(true, true);
            t.index('email');
        });
        logger.info('Created users table');
    }

    logger.info('Migration 002_users completed');
}

async function down() {
    await db.schema.dropTableIfExists('users');
    logger.info('Migration 002 rolled back');
}

module.exports = { up, down };
