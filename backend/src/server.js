const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ─── Import Routes ────────────────────────────────────────────────────────────
const usersRouter      = require('./routes/users');
const devicesRouter    = require('./routes/devices');
const gpsRouter        = require('./routes/gps');
const discoveryRouter  = require('./routes/discovery');
const mapRouter        = require('./routes/map');
const notifRouter      = require('./routes/notifications');
const analyticsRouter  = require('./routes/analytics');
const monitoringRouter = require('./routes/monitoring');
const namingRouter     = require('./routes/naming');
const protocolsRouter  = require('./routes/protocols');

// ─── JWT Middleware ───────────────────────────────────────────────────────────
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ─── Mount Routes ─────────────────────────────────────────────────────────────
app.use('/api/users',                         usersRouter);
app.use('/api/devices',                       devicesRouter);
app.use('/api/gps',                           gpsRouter);
app.use('/api/discovery',                     discoveryRouter);
app.use('/api/discovery/map',                 mapRouter);
app.use('/api/discovery/notifications',       notifRouter);
app.use('/api/discovery/analytics',           analyticsRouter);
app.use('/api/discovery/monitoring',          monitoringRouter);
app.use('/api/discovery/naming',              namingRouter);
app.use('/api/protocols',                     protocolsRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GNS server running on port ${PORT}`);
});

module.exports = app;
