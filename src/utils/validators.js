// src/utils/validators.js
// Zod schemas for request validation across all endpoints
const { z } = require('zod');

// --- Shared ---
const moduleIdSchema = z.enum([
  'closing_stock', 'sales_order', 'return_sales_order',
  'sales_voucher', 'return_sales_voucher',
]);

const safeUrlSchema = z.string().url().refine(
  (url) => {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  },
  { message: 'Only http:// and https:// URLs are allowed' }
);

// --- Tally Connection ---
const tallyConnectionUpdate = z.object({
  host: z.string().min(1).max(500),
  port: z.string().regex(/^\d{1,5}$/, 'Port must be 1-5 digits'),
  platform: z.enum(['windows', 'linux', 'cloud']),
});

const tallyConnectionTest = z.object({
  host: z.string().min(1).max(500),
  port: z.string().regex(/^\d{1,5}$/, 'Port must be 1-5 digits'),
});

// --- API Config ---
const apiConfigUpdate = z.object({
  enabled: z.boolean().optional(),
  endpoint: z.string().max(1000).optional().default(''),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('POST'),
  timeout: z.string().optional().default('30000'),
  headers: z.string().optional().default('{}'),
  authType: z.enum(['bearer', 'api_key', 'basic', 'oauth2']).optional().default('bearer'),
  bearerToken: z.string().optional().default(''),
  apiKey: z.string().optional().default(''),
  apiKeyHeader: z.string().optional().default('x-api-key'),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  clientId: z.string().optional().default(''),
  clientSecret: z.string().optional().default(''),
  tokenUrl: z.string().optional().default(''),
  scope: z.string().optional().default(''),
});

// --- Field Mapping ---
const fieldMappingRow = z.object({
  apiField: z.string().max(200),
  tallyXml: z.string().max(200),
  tallyField: z.string().max(100),
  required: z.boolean().default(false),
});

const fieldMappingSave = z.object({
  mappings: z.array(fieldMappingRow).max(200),
});

// --- Schedule ---
const scheduleUpdate = z.object({
  enabled: z.boolean().optional(),
  preset: z.string().max(20).optional(),
  cron: z.string().max(100).optional(),
  hour: z.string().optional(),
  weekday: z.string().optional(),
});

// --- B2B Settings ---
const b2bSettingsUpdate = z.object({
  autoCreateParty: z.boolean().optional(),
  validateGstin: z.boolean().optional(),
  skipDuplicateGstin: z.boolean().optional(),
  partyGroup: z.string().max(200).optional(),
  gstRegType: z.string().max(100).optional(),
  defaultState: z.string().max(100).optional(),
  partyNameCol: z.string().max(100).optional(),
  gstinCol: z.string().max(100).optional(),
  addressCol: z.string().max(100).optional(),
  stateCol: z.string().max(100).optional(),
  pincodeCol: z.string().max(100).optional(),
  contactCol: z.string().max(100).optional(),
});

// --- Import ---
const generateXmlRequest = z.object({
  batchId: z.string().uuid(),
});

// --- Cron Validation ---
function isValidCron(expression) {
  if (!expression) return false;
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const ranges = [
    { min: 0, max: 59 },   // minute
    { min: 0, max: 23 },   // hour
    { min: 1, max: 31 },   // day of month
    { min: 1, max: 12 },   // month
    { min: 0, max: 7 },    // day of week (0 and 7 = Sunday)
  ];
  for (let i = 0; i < 5; i++) {
    const part = parts[i];
    if (part === '*') continue;
    if (/^\*\/\d+$/.test(part)) {
      const step = parseInt(part.split('/')[1], 10);
      if (step < 1 || step > ranges[i].max) return false;
      continue;
    }
    if (/^\d+$/.test(part)) {
      const val = parseInt(part, 10);
      if (val < ranges[i].min || val > ranges[i].max) return false;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [lo, hi] = part.split('-').map(Number);
      if (lo < ranges[i].min || hi > ranges[i].max || lo > hi) return false;
      continue;
    }
    // Comma-separated
    if (/^[\d,]+$/.test(part)) {
      const vals = part.split(',').map(Number);
      if (vals.some(v => v < ranges[i].min || v > ranges[i].max)) return false;
      continue;
    }
    return false; // unrecognized
  }
  return true;
}

module.exports = {
  moduleIdSchema,
  safeUrlSchema,
  tallyConnectionUpdate,
  tallyConnectionTest,
  apiConfigUpdate,
  fieldMappingRow,
  fieldMappingSave,
  scheduleUpdate,
  b2bSettingsUpdate,
  generateXmlRequest,
  isValidCron,
};
