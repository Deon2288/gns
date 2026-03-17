const WebSocket = require('ws');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
    // Optional JWT authentication via query param: ws://host:8080?token=<jwt>
    const url = new URL(req.url, `http://localhost:${WEBSOCKET_PORT}`);
    const token = url.searchParams.get('token');
    if (token) {
        try {
            ws.user = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            ws.close(4001, 'Invalid token');
            return;
        }
    }

    clients.add(ws);
    console.log(`WebSocket client connected (total: ${clients.size})`);

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`WebSocket client disconnected (total: ${clients.size})`);
    });

    ws.on('error', (err) => {
        console.error('WebSocket client error:', err.message);
        clients.delete(ws);
    });
});

wss.on('error', (err) => {
    console.error('WebSocket server error:', err.message);
});

/**
 * Broadcast a GPS update to all connected clients.
 * @param {object} gpsRecord - { device_id, latitude, longitude, timestamp }
 */
function broadcastGpsUpdate(gpsRecord) {
    const message = JSON.stringify({ type: 'gps_update', data: gpsRecord });
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// PostgreSQL LISTEN/NOTIFY – listen for inserts on gps_data
const pool = new Pool({
    user: process.env.DB_USER || 'your_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'your_database',
    password: process.env.DB_PASSWORD || 'your_password',
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function startDbListener() {
    let client;
    try {
        client = await pool.connect();
        await client.query('LISTEN gps_update');
        console.log('Listening for PostgreSQL NOTIFY on channel "gps_update"');

        client.on('notification', (msg) => {
            try {
                const payload = JSON.parse(msg.payload);
                broadcastGpsUpdate(payload);
            } catch (err) {
                console.error('Error parsing gps_update notification:', err.message);
            }
        });

        client.on('error', (err) => {
            console.error('DB listener client error:', err.message);
            // Release the client before reconnecting to avoid a connection leak
            client.release();
            setTimeout(startDbListener, 5000);
        });
    } catch (err) {
        console.error('Failed to start DB listener:', err.message);
        if (client) client.release();
        setTimeout(startDbListener, 5000);
    }
}

startDbListener();

console.log(`WebSocket server listening on port ${WEBSOCKET_PORT}`);

module.exports = { broadcastGpsUpdate, wss };
