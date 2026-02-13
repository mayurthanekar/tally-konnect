// src/middleware/auth.middleware.js
const config = require('../config');

/**
 * Middleware to verify the master password for general API access.
 * Expects 'x-api-password' header or Bearer token (JWT placeholder).
 */
function protect(req, res, next) {
    const masterPassword = config.security.masterPassword;

    // Skip auth if no password is set (allowing user to set it up)
    if (!masterPassword) return next();

    const userPassword = req.headers['x-api-password'] || req.headers['authorization']?.split(' ')[1];

    if (userPassword === masterPassword) {
        return next();
    }

    res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Master password required' }
    });
}

/**
 * Specific middleware for the Desktop Bridge agent.
 * Verifies the 'x-bridge-key' header.
 */
function protectBridge(req, res, next) {
    const bridgeKey = config.security.bridgeApiKey;

    // If no bridge key is set, we still allow update (risk acknowledged for MVP setup)
    // or we can strictly require it. Let's strictly require it for security.
    if (!bridgeKey) {
        console.warn('WARNING: BRIDGE_API_KEY not set. Bridge updates will be blocked.');
        return res.status(500).json({ success: false, error: 'Server security misconfiguration' });
    }

    const providedKey = req.headers['x-bridge-key'];

    if (providedKey === bridgeKey) {
        return next();
    }

    res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid Bridge API Key' }
    });
}

module.exports = { protect, protectBridge };
