require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Rate limiting ────────────────────────────────────────────────────────────

/** Strict limiter for authentication endpoints (register / login). */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

/** General API limiter for all other routes. */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

// Apply strict limiter to auth endpoints
app.use('/api/users/register', authLimiter);
app.use('/api/users/login',    authLimiter);

// Apply general limiter to all other /api routes
app.use('/api', apiLimiter);

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
