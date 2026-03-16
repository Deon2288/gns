const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// PostgreSQL Connection - Create BEFORE importing routes
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('✅ Database connected successfully');
    }
});

// Pass pool to routes as middleware
app.use((req, res, next) => {
    req.pool = pool;
    next();
});

// Import routes AFTER pool is created
const usersRouter = require('./routes/users');
const devicesRouter = require('./routes/devices');
const gpsRouter = require('./routes/gps');
const teltonikaRouter = require('./routes/teltonika');
const alertsRouter = require('./routes/alerts');
const analyticsRouter = require('./routes/analytics');

// Use routes
app.use('/api/users', usersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/gps', gpsRouter);
app.use('/api/teltonika', teltonikaRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/analytics', analyticsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
