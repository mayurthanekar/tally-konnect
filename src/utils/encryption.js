// src/utils/encryption.js
// AES-256-GCM encryption for storing API keys, tokens, passwords in DB
const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING = 'hex';

let _keyBuffer = null;

function getKey() {
  if (_keyBuffer) return _keyBuffer;

  const key = config.security.encryptionKey;
  if (!key || key.length < 64) {
    // Auto-generate a key for development/first-run
    // In production, ENCRYPTION_KEY should be set via environment variable
    const generated = crypto.randomBytes(32).toString('hex');
    console.warn('WARNING: ENCRYPTION_KEY not set or too short. Using auto-generated key.');
    console.warn('Set ENCRYPTION_KEY env var with: ' + generated);
    _keyBuffer = Buffer.from(generated, 'hex');
    return _keyBuffer;
  }
  _keyBuffer = Buffer.from(key, 'hex');
  return _keyBuffer;
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext
 * @returns {string} hex-encoded "iv:encrypted:tag"
 */
function encrypt(plaintext) {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);
  const tag = cipher.getAuthTag();
  return `${iv.toString(ENCODING)}:${encrypted}:${tag.toString(ENCODING)}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText  hex-encoded "iv:encrypted:tag"
 * @returns {string} plaintext
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const key = getKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return '';  // Gracefully handle invalid data

    const iv = Buffer.from(parts[0], ENCODING);
    const encrypted = parts[1];
    const tag = Buffer.from(parts[2], ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails (key changed, corrupted data), return empty string
    console.warn('Decryption failed — encryption key may have changed:', err.message);
    return '';
  }
}

/**
 * Mask a secret for safe display (e.g. "sk-abc...xyz")
 * @param {string} value
 * @param {number} showChars - how many chars to show at start/end
 * @returns {string}
 */
function mask(value, showChars = 4) {
  if (!value || value.length <= showChars * 2) return '****';
  return value.slice(0, showChars) + '****' + value.slice(-showChars);
}

module.exports = { encrypt, decrypt, mask };
