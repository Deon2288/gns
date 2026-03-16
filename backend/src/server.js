require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/users',    require('./routes/users'));
app.use('/api',          require('./routes/devices'));
app.use('/api',          require('./routes/gps'));
app.use('/api/alerts',   require('./routes/alerts'));
app.use('/api/telemetry', require('./routes/telemetry'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── HTTP + WebSocket server ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

/** Broadcast a JSON message to all connected WebSocket clients. */
function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', message: 'GNS WebSocket ready' }));
    ws.on('error', (err) => console.error('WebSocket error:', err));
});

// Expose broadcast so routes can push live updates
app.locals.broadcast = broadcast;

server.listen(PORT, () => {
    console.log(`GNS server listening on port ${PORT}`);
});
