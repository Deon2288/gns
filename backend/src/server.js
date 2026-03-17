require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

// WebSocket setup
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// Broadcast to all connected WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Make broadcast available to routes
app.locals.broadcast = broadcast;

// Middleware
app.use(cors());
app.use(express.json());

// General API rate limiter: 300 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter rate limit for discovery scans (resource-intensive nmap)
const scanLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan requests. Please wait before scanning again.' },
});

// Health check (no rate limit needed)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
const deviceRoutes = require('./routes/devices');
const discoveryRoutes = require('./routes/discovery');
const snmpRoutes = require('./routes/snmp');
const gpsRoutes = require('./routes/gps');
const userRoutes = require('./routes/users');

// Mount routes with rate limiting
app.use('/api/devices', apiLimiter, deviceRoutes);
app.use('/api/discovery/scan', scanLimiter);
app.use('/api/discovery', apiLimiter, discoveryRoutes);
app.use('/api/snmp', apiLimiter, snmpRoutes);
app.use('/api/gps', apiLimiter, gpsRoutes);
app.use('/api/users', apiLimiter, userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Try DB connection
  const pool = require('./db');
  pool.query('SELECT 1').then(() => {
    console.log('✅ Database connected successfully');
  }).catch((err) => {
    console.warn('⚠️  Database not connected:', err.message);
  });
});

module.exports = { app, broadcast };
