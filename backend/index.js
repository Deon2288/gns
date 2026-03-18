'use strict';

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// WebSocket server for real-time OTA progress updates
// ---------------------------------------------------------------------------
let wss = null;
try {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });

  wss.on('connection', ws => {
    ws.on('error', err => console.error('[WS] Client error:', err.message));
  });

  // Expose broadcast helper to OTA service
  const otaService = require('./src/services/otaService');
  otaService.setWsBroadcast(payload => {
    const message = JSON.stringify(payload);
    wss.clients.forEach(client => {
      if (client.readyState === 1 /* OPEN */) {
        client.send(message);
      }
    });
  });
} catch (_) {
  console.warn('[WS] WebSocket server not available (ws package missing)');
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const otaRouter = require('./src/routes/ota');

app.get('/', (_req, res) => {
  res.json({ service: 'GNS Backend', status: 'ok' });
});

app.use('/api/ota', otaRouter);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
