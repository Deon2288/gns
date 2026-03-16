require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const usersRouter = require('./routes/users');
const devicesRouter = require('./routes/devices');
const gpsRouter = require('./routes/gps');
const alertsRouter = require('./routes/alerts');
const geofencesRouter = require('./routes/geofences');
const tripsRouter = require('./routes/trips');
const driversRouter = require('./routes/drivers');
const analyticsRouter = require('./routes/analytics');
const commandsRouter = require('./routes/commands');

const app = express();
const server = http.createServer(app);

// Socket.IO real-time layer
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Expose io instance for use in routes
app.set('io', io);

app.use(cors());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/users', apiLimiter, usersRouter);
app.use('/api/devices', apiLimiter, devicesRouter);
app.use('/api/gps', apiLimiter, gpsRouter);
app.use('/api/alerts', apiLimiter, alertsRouter);
app.use('/api/geofences', apiLimiter, geofencesRouter);
app.use('/api/trips', apiLimiter, tripsRouter);
app.use('/api/drivers', apiLimiter, driversRouter);
app.use('/api/analytics', apiLimiter, analyticsRouter);
app.use('/api/commands', apiLimiter, commandsRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_device', (deviceId) => {
    socket.join(`device_${deviceId}`);
  });

  socket.on('unsubscribe_device', (deviceId) => {
    socket.leave(`device_${deviceId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`GNS server running on port ${PORT}`);
});

module.exports = { app, server, io };
