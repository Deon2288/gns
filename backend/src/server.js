require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// Make io accessible to routes
app.set('io', io);

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gns_database',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT) || 5432,
});

// Make pool accessible to routes
app.set('db', pool);

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later' }
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts, please try again later' }
});

app.use('/api/', apiLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// Routes
const usersRouter = require('./routes/users');
const devicesRouter = require('./routes/devices');
const gpsRouter = require('./routes/gps');
const alertsRouter = require('./routes/alerts');
const geofencesRouter = require('./routes/geofences');
const tripsRouter = require('./routes/trips');
const driverBehaviorRouter = require('./routes/driver-behavior');
const reportsRouter = require('./routes/reports');
const notificationsRouter = require('./routes/notifications');
const deviceGroupsRouter = require('./routes/device-groups');

app.use('/api/users', usersRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/gps', gpsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/geofences', geofencesRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/driver-behavior', driverBehaviorRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/device-groups', deviceGroupsRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-device-room', (deviceId) => {
        socket.join(`device-${deviceId}`);
        console.log(`Client ${socket.id} joined device room: ${deviceId}`);
    });

    socket.on('leave-device-room', (deviceId) => {
        socket.leave(`device-${deviceId}`);
    });

    socket.on('subscribe-alerts', () => {
        socket.join('alerts-room');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`GNS Fleet Management Server running on port ${PORT}`);
    console.log(`WebSocket server ready`);
});

module.exports = { app, io, pool };
