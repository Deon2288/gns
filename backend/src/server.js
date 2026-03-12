const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'gns_user',
    password: process.env.DB_PASSWORD || 'gns_password',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'gns_database',
});

// Attach pool to requests for use in route handlers
app.use((req, res, next) => {
    req.pool = pool;
    next();
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

// Import routes
const usersRouter = require('./routes/users');
const devicesRouter = require('./routes/devices');
const gpsRouter = require('./routes/gps');

// Use routes
app.use('/api/users', usersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/gps', gpsRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const PORT = parseInt(process.env.PORT) || 5000;
app.listen(PORT, () => {
    console.log(`GNS Backend running on port ${PORT}`);
});

module.exports = app;
