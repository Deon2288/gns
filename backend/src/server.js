const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const http = require('http');
const { createWebSocketServer } = require('./websocket-server');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'your_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'your_database',
    password: process.env.DB_PASSWORD || 'your_password',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
});

// Make pool available to routes
app.locals.pool = pool;

// JWT middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
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

// Routes
const usersRouter = require('./routes/users');
const devicesRouter = require('./routes/devices');
const alertsRouter = require('./routes/alerts');
const analyticsRouter = require('./routes/analytics');
const tripsRouter = require('./routes/trips');

app.use('/api/users', usersRouter);
app.use('/api', devicesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/trips', tripsRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket server
const wss = createWebSocketServer(server);
app.locals.wss = wss;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
