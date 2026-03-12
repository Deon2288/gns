const WebSocket = require('ws');

/**
 * Creates and configures the WebSocket server.
 * @param {import('http').Server} httpServer - The HTTP server to attach to.
 * @returns {WebSocket.Server} The WebSocket server instance.
 */
function createWebSocketServer(httpServer) {
    const wss = new WebSocket.Server({ server: httpServer });

    // Track connected clients
    const clients = new Map();

    wss.on('connection', (ws, req) => {
        const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        clients.set(ws, { id: clientId, connectedAt: new Date() });
        console.log(`WebSocket client connected: ${clientId}`);

        // Send initial connection confirmation
        ws.send(JSON.stringify({ type: 'connected', message: 'Connected to GPS tracking server' }));

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleClientMessage(ws, message, wss);
            } catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket client disconnected: ${clientId}`);
            clients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error(`WebSocket error for ${clientId}:`, err.message);
            clients.delete(ws);
        });
    });

    /**
     * Handles incoming messages from a WebSocket client.
     */
    function handleClientMessage(ws, message, wss) {
        switch (message.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
            case 'subscribe':
                // Client subscribes to specific device updates
                const clientInfo = clients.get(ws);
                if (clientInfo) {
                    clientInfo.subscribedDevices = message.deviceIds || [];
                }
                ws.send(JSON.stringify({ type: 'subscribed', deviceIds: message.deviceIds }));
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
    }

    /**
     * Broadcasts a GPS update to all connected clients.
     * @param {object} gpsData - The GPS data to broadcast.
     */
    wss.broadcastGpsUpdate = function (gpsData) {
        const payload = JSON.stringify({ type: 'gps_update', data: gpsData, timestamp: new Date().toISOString() });
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                const info = clients.get(client);
                if (!info || !info.subscribedDevices || info.subscribedDevices.length === 0 ||
                    info.subscribedDevices.includes(gpsData.device_id)) {
                    client.send(payload);
                }
            }
        });
    };

    /**
     * Broadcasts an alert to all connected clients.
     * @param {object} alert - The alert to broadcast.
     */
    wss.broadcastAlert = function (alert) {
        const payload = JSON.stringify({ type: 'alert', data: alert, timestamp: new Date().toISOString() });
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    };

    /**
     * Broadcasts a device status change to all connected clients.
     * @param {object} statusUpdate - The status update to broadcast.
     */
    wss.broadcastDeviceStatus = function (statusUpdate) {
        const payload = JSON.stringify({ type: 'device_status', data: statusUpdate, timestamp: new Date().toISOString() });
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    };

    return wss;
}

module.exports = { createWebSocketServer };
