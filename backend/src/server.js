require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

// Import all routes
const devicesRoutes = require('./routes/devices');
const gpsRoutes = require('./routes/gps');
const discoveryRoutes = require('./routes/discovery');
const snmpRoutes = require('./routes/snmp');
const alertsRoutes = require('./routes/alerts');
const analyticsRoutes = require('./routes/analytics');
const teltonikaRoutes = require('./routes/teltonika');
const usersRoutes = require('./routes/users');

// CORS Configuration for Public IP
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://gns-frontend:3000',
            'http://gns-frontend',
            'http://197.242.150.120:3000',
            'http://197.242.150.120:3001',
            'http://197.242.150.120',
            'https://197.242.150.120:3000',
            'https://197.242.150.120:3001',
            'https://197.242.150.120',
            'http://gnnscloud.dedicated.co.za',
            'https://gnnscloud.dedicated.co.za'
        ];

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'gns_user',
    password: process.env.DB_PASSWORD || 'secure_password',
    database: process.env.DB_NAME || 'gns_database',
});

// Middleware to attach pool to requests
app.use((req, res, next) => {
    req.pool = pool;
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Routes
app.use('/api/devices', devicesRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/snmp', snmpRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/teltonika', teltonikaRoutes);
app.use('/api/users', usersRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.DB_NAME || 'gns_database'}`);
    console.log(`✅ All routes loaded`);
});

module.exports = app;
