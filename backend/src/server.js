require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
const deviceRoutes = require('./routes/devices');
const discoveryRoutes = require('./routes/discovery');
const snmpRoutes = require('./routes/snmp');
const gpsRoutes = require('./routes/gps');
const userRoutes = require('./routes/users');

// Mount routes
app.use('/api/devices', deviceRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/snmp', snmpRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/users', userRoutes);

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
