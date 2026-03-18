'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Attach PostgreSQL pool to every request (skipped when DB is not configured)
let pool = null;
if (process.env.DATABASE_URL || process.env.DB_HOST) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gns_db',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
    });
}

app.use((req, _res, next) => {
    req.pool = pool;
    next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/devices', require('./src/routes/devices'));
app.use('/api/gps', require('./src/routes/gps'));
app.use('/api/discovery', require('./src/routes/discovery'));
app.use('/api/snmp', require('./src/routes/snmp'));
app.use('/api/users', require('./src/routes/users'));

// Health check
app.get('/', (_req, res) => {
    res.json({ status: 'ok', message: 'GNS API is running' });
});

// ── Error handling ────────────────────────────────────────────────────────────
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`GNS API server running on port ${PORT}`);
    });
}

module.exports = app;
