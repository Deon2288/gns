const WebSocket = require('ws');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'gns_user',
    password: process.env.DB_PASSWORD || 'gns_password',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'gns_database'
});

class WebSocketServer {
    constructor(httpServer) {
        this.wss = new WebSocket.Server({ server: httpServer });
        this.clients = new Map();
        this.deviceSubscriptions = new Map();
        
        this.wss.on('connection', (ws) => this.handleConnection(ws));
        console.log('🌐 WebSocket Server initialized');
    }

    handleConnection(ws) {
        const clientId = Math.random().toString(36).substr(2, 9);
        this.clients.set(clientId, { ws, subscriptions: new Set() });

        console.log(`✨ Client connected: ${clientId}, Total clients: ${this.clients.size}`);

        ws.on('message', (data) => this.handleMessage(clientId, data));
        ws.on('close', () => this.handleClose(clientId));
        ws.on('error', (err) => console.error(`WebSocket error for ${clientId}:`, err.message));
    }

    handleMessage(clientId, data) {
        try {
            const message = JSON.parse(data);

            if (message.type === 'subscribe') {
                this.subscribe(clientId, message.deviceId);
            } else if (message.type === 'unsubscribe') {
                this.unsubscribe(clientId, message.deviceId);
            } else if (message.type === 'subscribe_all') {
                this.subscribeAll(clientId);
            }
        } catch (err) {
            console.error('Error handling message:', err);
        }
    }

    handleClose(clientId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscriptions.forEach(deviceId => {
                const subscribers = this.deviceSubscriptions.get(deviceId) || new Set();
                subscribers.delete(clientId);
            });
            this.clients.delete(clientId);
        }
        console.log(`👋 Client disconnected: ${clientId}, Total clients: ${this.clients.size}`);
    }

    subscribe(clientId, deviceId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.subscriptions.add(deviceId);

        if (!this.deviceSubscriptions.has(deviceId)) {
            this.deviceSubscriptions.set(deviceId, new Set());
        }
        this.deviceSubscriptions.get(deviceId).add(clientId);

        console.log(`📡 Client ${clientId} subscribed to device ${deviceId}`);
    }

    unsubscribe(clientId, deviceId) {
        const client = this.clients.get(clientId);
        if (client) {
            client.subscriptions.delete(deviceId);
        }

        const subscribers = this.deviceSubscriptions.get(deviceId);
        if (subscribers) {
            subscribers.delete(clientId);
        }
    }

    subscribeAll(clientId) {
        console.log(`📡 Client ${clientId} subscribed to all devices`);
        // Will receive all updates
        const client = this.clients.get(clientId);
        if (client) {
            client.subscriptions.add('*');
        }
    }

    broadcastGPSUpdate(deviceId, gpsData) {
        const subscribers = this.deviceSubscriptions.get(deviceId) || new Set();

        const message = JSON.stringify({
            type: 'gps_update',
            deviceId,
            data: gpsData,
            timestamp: new Date().toISOString()
        });

        subscribers.forEach(clientId => {
            const client = this.clients.get(clientId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        });

        // Also send to subscribers of all devices
        this.clients.forEach((client, clientId) => {
            if (client.subscriptions.has('*') && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }

    broadcastAlert(alert) {
        const message = JSON.stringify({
            type: 'alert',
            data: alert,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }

    broadcastDeviceStatus(deviceId, status) {
        const message = JSON.stringify({
            type: 'device_status',
            deviceId,
            status,
            timestamp: new Date().toISOString()
        });

        this.clients.forEach((client) => {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        });
    }

    getConnectedClients() {
        return this.clients.size;
    }
}

module.exports = WebSocketServer;
