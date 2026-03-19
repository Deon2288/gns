require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' },
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
});

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'gns_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gns_database',
    password: process.env.DB_PASSWORD || 'secure_password',
    port: parseInt(process.env.DB_PORT) || 5432,
});

// JWT middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Health check route
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'GNS Backend', version: '1.0.0' });
});

// API health check with DB connectivity test
app.get('/api/health', apiLimiter, async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(503).json({ status: 'error', database: 'disconnected', message: err.message });
    }
});

// Basic routes
app.post('/authenticate', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign(
            { id: user.user_id, username: user.username },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '24h' }
        );
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/devices', apiLimiter, authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM devices ORDER BY device_id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/devices', apiLimiter, authenticateJWT, async (req, res) => {
    const { device_name } = req.body;
    if (!device_name) {
        return res.status(400).json({ error: 'device_name is required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO devices (user_id, device_name) VALUES ($1, $2) RETURNING *',
            [req.user.id, device_name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
