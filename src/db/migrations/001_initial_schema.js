// src/db/migrations/001_initial_schema.js
// Creates all 8 tables for Tally Konnect
// Run: node src/db/migrations/run.js

const { db } = require('../index');
const logger = require('../../utils/logger');

async function up() {
  logger.info('Running migration 001_initial_schema...');

  // 1. tally_connection
  await db.schema.createTableIfNotExists('tally_connection', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.string('host', 500).notNullable().defaultTo('http://localhost');
    t.string('port', 10).notNullable().defaultTo('9000');
    t.enu('platform', ['windows', 'linux', 'cloud']).notNullable().defaultTo('windows');
    t.enu('status', ['disconnected', 'checking', 'connected', 'error']).notNullable().defaultTo('disconnected');
    t.string('tally_version', 100).defaultTo('');
    t.string('company_name', 300).defaultTo('');
    t.timestamp('last_checked_at').nullable();
    t.timestamps(true, true);
  });

  // 2. api_configs
  await db.schema.createTableIfNotExists('api_configs', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.string('module_id', 50).unique().notNullable();
    t.boolean('enabled').notNullable().defaultTo(false);
    t.string('endpoint', 1000).defaultTo('');
    t.string('method', 10).notNullable().defaultTo('POST');
    t.integer('timeout_ms').notNullable().defaultTo(30000);
    t.text('headers_json').defaultTo('{"Content-Type":"application/json"}');
    t.enu('auth_type', ['bearer', 'api_key', 'basic', 'oauth2']).notNullable().defaultTo('bearer');
    // Encrypted columns (stored as hex-encoded ciphertext)
    t.text('bearer_token_enc').defaultTo('');
    t.text('api_key_enc').defaultTo('');
    t.string('api_key_header', 200).defaultTo('x-api-key');
    t.text('username_enc').defaultTo('');
    t.text('password_enc').defaultTo('');
    t.text('client_id_enc').defaultTo('');
    t.text('client_secret_enc').defaultTo('');
    t.string('token_url', 1000).defaultTo('');
    t.string('scope', 500).defaultTo('');
    t.timestamps(true, true);
    t.index('module_id');
  });

  // 3. field_mappings
  await db.schema.createTableIfNotExists('field_mappings', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.integer('sort_order').notNullable().defaultTo(0);
    t.string('api_field', 200).notNullable().defaultTo('');
    t.string('tally_xml_key', 200).notNullable().defaultTo('');
    t.string('tally_field', 100).notNullable().defaultTo('');
    t.boolean('is_required').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index('sort_order');
  });

  // 4. schedules
  await db.schema.createTableIfNotExists('schedules', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.string('module_id', 50).unique().notNullable();
    t.boolean('enabled').notNullable().defaultTo(false);
    t.string('preset', 20).defaultTo('hourly');
    t.string('cron_expression', 100).defaultTo('0 * * * *');
    t.integer('run_hour').defaultTo(0);
    t.integer('run_weekday').defaultTo(0);
    t.timestamp('last_run_at').nullable();
    t.timestamp('next_run_at').nullable();
    t.timestamps(true, true);
    t.index('module_id');
  });

  // 5. b2b_settings (singleton row)
  await db.schema.createTableIfNotExists('b2b_settings', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.boolean('auto_create_party').notNullable().defaultTo(true);
    t.boolean('validate_gstin').notNullable().defaultTo(true);
    t.boolean('skip_duplicate_gstin').notNullable().defaultTo(true);
    t.string('party_group', 200).defaultTo('Sundry Debtors');
    t.string('gst_reg_type', 100).defaultTo('Regular');
    t.string('default_state', 100).defaultTo('Maharashtra');
    t.string('party_name_col', 100).defaultTo('buyer_name');
    t.string('gstin_col', 100).defaultTo('buyer_gstin');
    t.string('address_col', 100).defaultTo('buyer_address');
    t.string('state_col', 100).defaultTo('buyer_state');
    t.string('pincode_col', 100).defaultTo('buyer_pincode');
    t.string('contact_col', 100).defaultTo('');
    t.timestamp('updated_at').defaultTo(db.fn.now());
  });

  // 6. import_data
  await db.schema.createTableIfNotExists('import_data', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.uuid('batch_id').notNullable();
    t.string('file_name', 500).defaultTo('');
    t.integer('row_index').notNullable().defaultTo(0);
    t.jsonb('row_data').notNullable();
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.index('batch_id');
    t.index('created_at');
  });

  // 7. sync_logs
  await db.schema.createTableIfNotExists('sync_logs', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.string('module_id', 50).notNullable();
    t.enu('trigger_type', ['manual', 'scheduled']).notNullable().defaultTo('manual');
    t.enu('status', ['running', 'success', 'failed']).notNullable().defaultTo('running');
    t.timestamp('started_at').defaultTo(db.fn.now());
    t.timestamp('finished_at').nullable();
    t.integer('records_sent').defaultTo(0);
    t.integer('records_failed').defaultTo(0);
    t.text('error_message').defaultTo('');
    t.text('tally_response').defaultTo('');
    t.index('module_id');
    t.index('started_at');
    t.index('status');
  });

  // 8. party_masters
  await db.schema.createTableIfNotExists('party_masters', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.string('party_name', 500).notNullable();
    t.string('gstin', 15).defaultTo('');
    t.text('address').defaultTo('');
    t.string('state', 100).defaultTo('');
    t.string('pincode', 10).defaultTo('');
    t.string('contact', 200).defaultTo('');
    t.string('gst_reg_type', 50).defaultTo('Regular');
    t.string('party_group', 200).defaultTo('Sundry Debtors');
    t.boolean('synced_to_tally').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(db.fn.now());
    t.index('gstin');
    t.index('party_name');
  });

  logger.info('Migration 001_initial_schema completed');
}

async function down() {
  const tables = [
    'party_masters', 'sync_logs', 'import_data', 'b2b_settings',
    'schedules', 'field_mappings', 'api_configs', 'tally_connection',
  ];
  for (const table of tables) {
    await db.schema.dropTableIfExists(table);
  }
  logger.info('Migration 001 rolled back');
}

module.exports = { up, down };
