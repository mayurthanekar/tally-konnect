// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_SECRET = config.security.jwtSecret;

/**
 * Middleware to verify JWT token for authenticated access.
 * Expects 'Authorization: Bearer <token>' header.
 */
function protect(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email, role, name }
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: { code: 'TOKEN_EXPIRED', message: 'Session expired. Please log in again.' }
        });
    }
}

/**
 * Specific middleware for the Desktop Bridge agent.
 * Verifies the 'x-bridge-key' header.
 */
function protectBridge(req, res, next) {
    const bridgeKey = config.security.bridgeApiKey;

    if (!bridgeKey) {
        console.warn('WARNING: BRIDGE_API_KEY not set. Bridge updates will be blocked.');
        return res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR', message: 'Server security misconfiguration' } });
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
