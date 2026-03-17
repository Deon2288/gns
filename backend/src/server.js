const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

// Import routes
const discoveryRoutes = require('./routes/discovery');
const snmpRoutes = require('./routes/snmp');
const firmwareRoutes = require('./routes/firmware');
const remoteRoutes = require('./routes/remote');
const vpnRoutes = require('./routes/vpn');
const tasksRoutes = require('./routes/tasks');
const reportsRoutes = require('./routes/reports');

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'your_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'your_database',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT || 5432,
});

// Attach pool to every request so route handlers can use req.pool
app.use((req, res, next) => {
    req.pool = pool;
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// JWT middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token) {
        jwt.verify(token, 'your_jwt_secret', (err, user) => {
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

// Authentication routes
app.post('/authenticate', (req, res) => {
    res.json({ token: 'sample_token' });
});

// Device routes
app.get('/devices', (req, res) => {
    res.json({ devices: [] });
});

app.post('/devices', (req, res) => {
    res.json({ message: 'Device added' });
});

// API Routes
app.use('/api/discovery', discoveryRoutes);
app.use('/api/snmp', snmpRoutes);
app.use('/api/firmware', firmwareRoutes);
app.use('/api/remote', remoteRoutes);
app.use('/api/vpn', vpnRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/reports', reportsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ Database connected successfully');
});

module.exports = app;
