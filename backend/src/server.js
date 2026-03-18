require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection using environment variables
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gns_db',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
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

// Import route modules
const devicesRouter = require('./routes/devices');
const gpsRouter = require('./routes/gps');
const usersRouter = require('./routes/users');
const discoveryRouter = require('./routes/discovery');
const snmpRouter = require('./routes/snmp');

// Register API routes
app.use('/api/devices', devicesRouter);
app.use('/api/gps', gpsRouter);
app.use('/api/users', usersRouter);
app.use('/api/discovery', discoveryRouter);
app.use('/api/snmp', snmpRouter);

// Authentication route
app.post('/api/authenticate', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    const token = jwt.sign({ username }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
    res.json({ token });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
