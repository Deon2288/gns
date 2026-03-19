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

// CORS Configuration for Docker
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://gns-frontend:3000',
            'http://gns-frontend',
            'http://gnnscloud.dedicated.co.za',
            'https://gnnscloud.dedicated.co.za',
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware to attach pool to request
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

// Authentication routes
app.post('/authenticate', (req, res) => {
    res.json({ token: 'sample_token' });
});

// API Routes - all under /api prefix
app.use('/api/devices', devicesRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/snmp', snmpRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/teltonika', teltonikaRoutes);
app.use('/api/users', usersRoutes);

// Backward compatibility - old routes without /api prefix
app.use('/devices', devicesRoutes);
app.use('/gps', gpsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${process.env.DB_NAME}`);
    console.log('✅ All routes loaded');
    console.log('🔐 CORS enabled for Docker containers');
});

module.exports = app;
