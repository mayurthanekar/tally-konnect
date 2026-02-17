// src/controllers/auth.controller.js
// Handles Google SSO, Microsoft SSO, Email OTP, Mobile OTP
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const { db } = require('../db');
const logger = require('../utils/logger');
const { sendOtpEmail, verifySmtpConnection } = require('../utils/mailer');

const JWT_SECRET = config.security.jwtSecret;
const JWT_EXPIRY = '7d';
const OTP_EXPIRY_MINS = 10;

// These emails are ALWAYS super-admin, regardless of DB state
const SUPER_ADMINS = ['mayurt@gofynd.com', 'mayur.thanekar@gmail.com'];

// ============================================================
// HELPER: Find/create user and issue JWT
// ============================================================
async function findOrCreateUser({ email, name, avatar_url, auth_provider, phone }) {
    if (!email && !phone) throw new Error('Email or phone required');
    const lookupField = email ? { email: email.toLowerCase().trim() } : { phone: phone.trim() };

    let user = await db('users').where(lookupField).first();

    if (!user) {
        // Auto-create user on first login/signup
        const isSuperAdmin = email && SUPER_ADMINS.includes(email.toLowerCase().trim());
        const insertData = {
            email: email ? email.toLowerCase().trim() : null,
            name: name || (email ? email.split('@')[0] : phone),
            avatar_url: avatar_url || null,
            auth_provider: auth_provider || 'email_otp',
            phone: phone || null,
            role: isSuperAdmin ? 'admin' : 'user',
            password_hash: null,
        };
        [user] = await db('users').insert(insertData).returning(['id', 'email', 'name', 'role', 'is_active', 'avatar_url', 'auth_provider']);
        logger.info({ email: user.email, role: user.role, auth_provider }, 'New user auto-created');
    }

    if (!user.is_active) {
        throw new Error('Account is deactivated. Contact your administrator.');
    }

    // Enforce super-admin status
    const isSuperAdmin = user.email && SUPER_ADMINS.includes(user.email.toLowerCase());
    if (isSuperAdmin && user.role !== 'admin') {
        await db('users').where({ id: user.id }).update({ role: 'admin' });
        user.role = 'admin';
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );

    return {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar_url: user.avatar_url }
    };
}

// ============================================================
// GET /api/auth/config  (Public — tells frontend which providers are available)
// ============================================================
function getAuthConfig(req, res) {
    const { host, user } = config.smtp;
    res.json({
        success: true,
        data: {
            google: !!config.oauth.google.clientId,
            microsoft: !!config.oauth.microsoft.clientId,
            emailOtp: true,  // Always available (falls back to logging OTP)
            mobileOtp: !!config.sms.twilioSid,
            smtpConfigured: !!(host && user),
        }
    });
}

// ============================================================
// GOOGLE OAuth — Server-side authorization code flow
// ============================================================

// GET /api/auth/google → Redirect user to Google consent screen
function googleRedirect(req, res) {
    const { clientId } = config.oauth.google;
    if (!clientId) {
        return res.status(501).json({ success: false, error: { message: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' } });
    }

    const callbackUrl = `${config.appUrl}/api/auth/google/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// GET /api/auth/google/callback → Exchange code for tokens, create/find user
async function googleCallback(req, res) {
    try {
        const { code, error: authError } = req.query;
        if (authError || !code) {
            logger.warn({ authError }, 'Google OAuth declined or failed');
            return res.redirect('/?error=google_auth_cancelled');
        }

        const { clientId, clientSecret } = config.oauth.google;
        const callbackUrl = `${config.appUrl}/api/auth/google/callback`;

        // Exchange authorization code for tokens
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code',
        });

        // Get user profile
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
        });

        const { email, name, picture } = userInfo.data;
        const result = await findOrCreateUser({
            email,
            name,
            avatar_url: picture,
            auth_provider: 'google',
        });

        // Redirect back to frontend with token embedded
        const userBase64 = Buffer.from(JSON.stringify(result.user)).toString('base64');
        res.redirect(`/?token=${result.token}&user=${encodeURIComponent(userBase64)}`);

    } catch (err) {
        logger.error({ err: err.message }, 'Google OAuth callback failed');
        res.redirect('/?error=google_auth_failed');
    }
}

// ============================================================
// MICROSOFT OAuth — Server-side authorization code flow
// ============================================================

// GET /api/auth/microsoft → Redirect user to Microsoft login
function microsoftRedirect(req, res) {
    const { clientId, tenantId } = config.oauth.microsoft;
    if (!clientId) {
        return res.status(501).json({ success: false, error: { message: 'Microsoft OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.' } });
    }

    const callbackUrl = `${config.appUrl}/api/auth/microsoft/callback`;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile User.Read',
        response_mode: 'query',
    });

    res.redirect(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`);
}

// GET /api/auth/microsoft/callback → Exchange code for tokens
async function microsoftCallback(req, res) {
    try {
        const { code, error: authError } = req.query;
        if (authError || !code) {
            logger.warn({ authError }, 'Microsoft OAuth declined or failed');
            return res.redirect('/?error=microsoft_auth_cancelled');
        }

        const { clientId, clientSecret, tenantId } = config.oauth.microsoft;
        const callbackUrl = `${config.appUrl}/api/auth/microsoft/callback`;

        // Exchange code for tokens
        const tokenRes = await axios.post(
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
            new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: callbackUrl,
                grant_type: 'authorization_code',
                scope: 'openid email profile User.Read',
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // Get user profile from Microsoft Graph
        const userInfo = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
        });

        const email = userInfo.data.mail || userInfo.data.userPrincipalName;
        const name = userInfo.data.displayName;

        const result = await findOrCreateUser({
            email,
            name,
            auth_provider: 'microsoft',
        });

        const userBase64 = Buffer.from(JSON.stringify(result.user)).toString('base64');
        res.redirect(`/?token=${result.token}&user=${encodeURIComponent(userBase64)}`);

    } catch (err) {
        logger.error({ err: err.message }, 'Microsoft OAuth callback failed');
        res.redirect('/?error=microsoft_auth_failed');
    }
}

// ============================================================
// EMAIL OTP
// ============================================================

// POST /api/auth/otp/send-email  { email }
async function sendEmailOtpHandler(req, res, next) {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: { message: 'Valid email is required' } });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user is deactivated
        const existingUser = await db('users').where({ email: normalizedEmail }).first();
        if (existingUser && !existingUser.is_active) {
            return res.status(403).json({ success: false, error: { message: 'Account is deactivated. Contact your administrator.' } });
        }

        // Rate limit: max 3 OTPs per email per 10 minutes
        const recentOtps = await db('otp_codes')
            .where({ identifier: normalizedEmail, type: 'email' })
            .where('created_at', '>', new Date(Date.now() - 10 * 60 * 1000))
            .count('id as count')
            .first();

        if (parseInt(recentOtps.count) >= 3) {
            return res.status(429).json({ success: false, error: { message: 'Too many OTP requests. Wait a few minutes.' } });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000);

        // Invalidate previous unused OTPs for this email
        await db('otp_codes')
            .where({ identifier: normalizedEmail, type: 'email', used: false })
            .update({ used: true });

        // Store new OTP
        await db('otp_codes').insert({
            identifier: normalizedEmail,
            code: otp,
            type: 'email',
            expires_at: expiresAt,
        });

        // Send email (falls back to console logging if SMTP not configured)
        const deliveryResult = await sendOtpEmail(normalizedEmail, otp);

        const message = deliveryResult.sent
            ? `OTP sent to ${normalizedEmail}`
            : `OTP generated for ${normalizedEmail}. Email delivery is not configured — check server logs for the code.`;

        res.json({
            success: true,
            data: {
                message,
                expiresInMinutes: OTP_EXPIRY_MINS,
                delivered: deliveryResult.sent,
            }
        });
    } catch (err) {
        logger.error({ err }, 'Send email OTP failed');
        next(err);
    }
}

// POST /api/auth/otp/test-email  { email } (Admin only)
async function testEmailOtpHandler(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { message: 'Admin access required' } });
        }

        const { email } = req.body;
        const testOtp = '123456';

        logger.info({ email, actor: req.user.email }, 'Running SMTP diagnostic test');

        const connection = await verifySmtpConnection();
        const delivery = await sendOtpEmail(email, testOtp);

        res.json({
            success: true,
            data: {
                diagnostic: {
                    smtpHost: config.smtp.host,
                    smtpUser: config.smtp.user ? `${config.smtp.user.substring(0, 3)}***` : 'none',
                    connection,
                    delivery
                }
            }
        });
    } catch (err) {
        logger.error({ err }, 'SMTP diagnostic test failed');
        next(err);
    }
}

// POST /api/auth/otp/send-mobile  { phone }
async function sendMobileOtpHandler(req, res, next) {
    try {
        const { phone } = req.body;
        if (!phone || phone.length < 10) {
            return res.status(400).json({ success: false, error: { message: 'Valid phone number is required' } });
        }

        if (!config.sms.twilioSid) {
            return res.status(501).json({ success: false, error: { message: 'SMS service is not configured. Contact admin.' } });
        }

        const normalizedPhone = phone.replace(/\s+/g, '').trim();

        // Rate limit
        const recentOtps = await db('otp_codes')
            .where({ identifier: normalizedPhone, type: 'mobile' })
            .where('created_at', '>', new Date(Date.now() - 10 * 60 * 1000))
            .count('id as count')
            .first();

        if (parseInt(recentOtps.count) >= 3) {
            return res.status(429).json({ success: false, error: { message: 'Too many OTP requests. Wait a few minutes.' } });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000);

        await db('otp_codes')
            .where({ identifier: normalizedPhone, type: 'mobile', used: false })
            .update({ used: true });

        await db('otp_codes').insert({
            identifier: normalizedPhone,
            code: otp,
            type: 'mobile',
            expires_at: expiresAt,
        });

        // TODO: Send SMS via Twilio when configured
        logger.info({ phone: normalizedPhone, otp }, '📱 MOBILE OTP (SMS sending not yet implemented)');

        res.json({
            success: true,
            data: { message: `OTP sent to ${normalizedPhone}`, expiresInMinutes: OTP_EXPIRY_MINS }
        });
    } catch (err) {
        logger.error({ err }, 'Send mobile OTP failed');
        next(err);
    }
}

// POST /api/auth/otp/verify  { identifier, otp, type: 'email'|'mobile' }
async function verifyOtp(req, res, next) {
    try {
        const { identifier, otp, type = 'email' } = req.body;
        if (!identifier || !otp) {
            return res.status(400).json({ success: false, error: { message: 'Email/phone and OTP code are required' } });
        }

        const normalizedId = identifier.toLowerCase().trim();

        // Find the most recent unused, non-expired OTP
        const record = await db('otp_codes')
            .where({ identifier: normalizedId, type, used: false })
            .where('expires_at', '>', new Date())
            .orderBy('created_at', 'desc')
            .first();

        if (!record) {
            return res.status(400).json({
                success: false,
                error: { code: 'OTP_EXPIRED', message: 'OTP expired or not found. Please request a new one.' }
            });
        }

        // Rate limit attempts (max 5 per OTP)
        if (record.attempts >= 5) {
            await db('otp_codes').where({ id: record.id }).update({ used: true });
            return res.status(429).json({
                success: false,
                error: { message: 'Too many incorrect attempts. Please request a new OTP.' }
            });
        }

        // Verify OTP code
        if (record.code !== otp.trim()) {
            await db('otp_codes').where({ id: record.id }).increment('attempts', 1);
            const remaining = 5 - record.attempts - 1;
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_OTP', message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` }
            });
        }

        // Mark OTP as used
        await db('otp_codes').where({ id: record.id }).update({ used: true });

        // Create or find user
        const result = await findOrCreateUser({
            email: type === 'email' ? normalizedId : undefined,
            phone: type === 'mobile' ? normalizedId : undefined,
            auth_provider: type === 'email' ? 'email_otp' : 'mobile_otp',
        });

        logger.info({ identifier: normalizedId, type }, 'OTP verified, user logged in');

        res.json({ success: true, data: result });
    } catch (err) {
        if (err.message.includes('deactivated')) {
            return res.status(403).json({ success: false, error: { message: err.message } });
        }
        logger.error({ err }, 'OTP verification failed');
        next(err);
    }
}

// ============================================================
// EXISTING ADMIN ENDPOINTS (kept with improvements)
// ============================================================

// GET /api/auth/me
async function me(req, res, next) {
    try {
        const user = await db('users')
            .where({ id: req.user.id })
            .select('id', 'email', 'name', 'role', 'is_active', 'avatar_url', 'auth_provider', 'phone')
            .first();

        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Account not found or deactivated' } });
        }

        res.json({ success: true, data: { user } });
    } catch (err) { next(err); }
}

// GET /api/auth/users  (admin only)
async function listUsers(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }
        const users = await db('users')
            .select('id', 'email', 'name', 'role', 'is_active', 'auth_provider', 'avatar_url', 'created_at')
            .orderBy('created_at', 'asc');
        res.json({ success: true, data: users });
    } catch (err) { next(err); }
}

// PATCH /api/auth/users/:id  (admin only — update role/active)
async function updateUser(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }

        const { id } = req.params;
        const { name, role, is_active } = req.body;

        // Check if target is a super admin
        const targetUser = await db('users').where({ id }).first();
        if (!targetUser) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        const isTargetSuperAdmin = SUPER_ADMINS.includes(targetUser.email);

        // Protect super admins from demotion or deactivation
        if (isTargetSuperAdmin) {
            if (role && role !== 'admin') {
                return res.status(403).json({ success: false, error: { message: 'Cannot change role of a super admin' } });
            }
            if (is_active === false) {
                return res.status(403).json({ success: false, error: { message: 'Cannot deactivate a super admin' } });
            }
        }

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (role === 'admin' || role === 'user') updates.role = role;
        if (typeof is_active === 'boolean') updates.is_active = is_active;
        updates.updated_at = new Date();

        if (Object.keys(updates).length <= 1) {
            return res.status(400).json({ success: false, error: { code: 'NO_CHANGES', message: 'Nothing to update' } });
        }

        const [user] = await db('users').where({ id }).update(updates).returning(['id', 'email', 'name', 'role', 'is_active']);
        logger.info({ id, updates, actor: req.user.email }, 'User updated');
        res.json({ success: true, data: user });
    } catch (err) { next(err); }
}

// DELETE /api/auth/users/:id  (admin only)
async function deleteUser(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }

        const { id } = req.params;

        // Can't delete yourself
        if (String(id) === String(req.user.id)) {
            return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'Cannot delete your own account' } });
        }

        // Can't delete super admins
        const targetUser = await db('users').where({ id }).first();
        if (targetUser && SUPER_ADMINS.includes(targetUser.email)) {
            return res.status(403).json({ success: false, error: { message: 'Cannot delete a super admin' } });
        }

        const deleted = await db('users').where({ id }).del();
        if (!deleted) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        }

        logger.info({ id, actor: req.user.email }, 'User deleted');
        res.json({ success: true });
    } catch (err) { next(err); }
}

module.exports = {
    getAuthConfig,
    googleRedirect,
    googleCallback,
    microsoftRedirect,
    microsoftCallback,
    sendEmailOtpHandler,
    testEmailOtpHandler,
    sendMobileOtpHandler,
    verifyOtp,
    me,
    listUsers,
    updateUser,
    deleteUser,
};
