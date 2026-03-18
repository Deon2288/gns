require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    console.warn('WARNING: JWT_SECRET env var is not set. Using insecure default – set JWT_SECRET in production.');
    return 'changeme_jwt_secret';
})();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Rate limiter for auth endpoints (100 req per 15 min per IP)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
});

// ── PostgreSQL connection pool ────────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gns_db',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
});

// Attach pool to every request
app.use((req, _res, next) => {
    req.pool = pool;
    next();
});

// ── JWT middleware ────────────────────────────────────────────────────────────
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/authenticate', authLimiter, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    // TODO: validate credentials from database
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

app.get('/devices', authLimiter, authenticateJWT, (req, res) => {
    res.json({ message: 'Device list endpoint - use /api/devices via index.js' });
});

app.post('/devices', authLimiter, authenticateJWT, (req, res) => {
    res.json({ message: 'Create device endpoint - use /api/devices via index.js' });
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
