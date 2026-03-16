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
    user: process.env.DB_USER || 'your_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'your_database',
    password: process.env.DB_PASSWORD || 'your_password',
    port: parseInt(process.env.DB_PORT || '5432', 10),
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

// Start WebSocket server and wire broadcast into GPS router
const { broadcastGpsUpdate } = require('./websocket-server');
const gpsRouter = require('./routes/gps');
gpsRouter.broadcastGpsUpdate = broadcastGpsUpdate;

// Mount routes
app.use('/api', gpsRouter);
app.use('/api', require('./routes/devices'));
app.use('/api', require('./routes/users'));

// Simple in-memory rate limiter: max requests per window per IP
function createRateLimiter(maxRequests, windowMs) {
    const requests = new Map();
    return (req, res, next) => {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = requests.get(ip) || { count: 0, start: now };
        if (now - entry.start > windowMs) {
            entry.count = 0;
            entry.start = now;
        }
        entry.count += 1;
        requests.set(ip, entry);
        if (entry.count > maxRequests) {
            return res.status(429).json({ message: 'Too many requests, please try again later.' });
        }
        next();
    };
}

const authRateLimit = createRateLimiter(10, 15 * 60 * 1000); // 10 requests per 15 min
const apiRateLimit = createRateLimiter(100, 60 * 1000);       // 100 requests per minute

// Basic routes
app.post('/authenticate', authRateLimit, (req, res) => {
    // Your authentication logic here
});

app.get('/devices', apiRateLimit, authenticateJWT, (req, res) => {
    // Logic for getting devices
});

app.post('/devices', apiRateLimit, authenticateJWT, (req, res) => {
    // Logic for adding a new device
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
