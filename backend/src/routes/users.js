const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/roles');

const getDb = (req) => req.app.get('db');

// POST /api/users/register
router.post('/register', async (req, res) => {
    const { username, email, password, full_name, role } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Username, email and password are required' });
    }

    try {
        const pool = getDb(req);

        const existing = await pool.query(
            'SELECT user_id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (username, email, password, full_name, role)
             VALUES ($1, $2, $3, $4, $5) RETURNING user_id, username, email, full_name, role, created_at`,
            [username, email, hashedPassword, full_name || null, role || ROLES.VIEWER]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { userId: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({ user, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const pool = getDb(req);

        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
            [user.user_id]
        );

        const token = jwt.sign(
            { userId: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// GET /api/users/profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            'SELECT user_id, username, email, full_name, role, created_at, last_login FROM users WHERE user_id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/users - Admin only
router.get('/', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            'SELECT user_id, username, email, full_name, role, created_at, last_login FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/users/:id/role - Admin only
router.put('/:id/role', authenticateToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { role } = req.body;
    const validRoles = Object.values(ROLES);

    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role', validRoles });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id, username, role',
            [role, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
