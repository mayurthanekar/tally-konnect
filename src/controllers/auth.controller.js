// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db } = require('../db');

const JWT_SECRET = config.security.jwtSecret;
const JWT_EXPIRY = '7d';

// POST /api/auth/login
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password required' } });
        }

        const user = await db('users').where({ email: email.toLowerCase().trim() }).first();
        if (!user || !user.is_active) {
            return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            success: true,
            data: {
                token,
                user: { id: user.id, email: user.email, name: user.name, role: user.role }
            }
        });
    } catch (err) { next(err); }
}

// GET /api/auth/me
async function me(req, res) {
    res.json({ success: true, data: { user: req.user } });
}

// GET /api/auth/users  (admin only)
async function listUsers(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }
        const users = await db('users').select('id', 'email', 'name', 'role', 'is_active', 'created_at').orderBy('created_at', 'asc');
        res.json({ success: true, data: users });
    } catch (err) { next(err); }
}

// POST /api/auth/users  (admin only)
async function createUser(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }

        const { email, password, name, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password required' } });
        }

        const existing = await db('users').where({ email: email.toLowerCase().trim() }).first();
        if (existing) {
            return res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'User already exists' } });
        }

        const hash = await bcrypt.hash(password, 12);
        const [user] = await db('users').insert({
            email: email.toLowerCase().trim(),
            password_hash: hash,
            name: name || '',
            role: role || 'user',
        }).returning(['id', 'email', 'name', 'role', 'is_active', 'created_at']);

        res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
}

// DELETE /api/auth/users/:id  (admin only)
async function deleteUser(req, res, next) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
        }

        const { id } = req.params;

        // Prevent deleting yourself
        if (id === req.user.id) {
            return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'Cannot delete your own account' } });
        }

        await db('users').where({ id }).del();
        res.json({ success: true });
    } catch (err) { next(err); }
}

module.exports = { login, me, listUsers, createUser, deleteUser };
