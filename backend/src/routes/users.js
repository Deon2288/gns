const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateToken, JWT_SECRET } = require('../auth');

const router = express.Router();

// POST /api/users/register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'username and password are required' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING user_id, username, created_at',
            [username, hash],
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Username already exists' });
        }
        console.error('register error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'username and password are required' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign(
            { userId: user.user_id, username: user.username },
            JWT_SECRET,
            { expiresIn: '8h' },
        );
        res.json({ token, username: user.username });
    } catch (err) {
        console.error('login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/users/profile  (protected)
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT user_id, username, created_at FROM users WHERE user_id = $1',
            [req.user.userId],
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('profile error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
