'use strict';

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mock data
let devices = [
    { device_id: 1, name: 'Device 1', latitude: 51.5074, longitude: -0.1278, status: 'active' },
    { device_id: 2, name: 'Device 2', latitude: 51.5175, longitude: -0.1369, status: 'active' },
];

let alerts = [
    { id: 1, device_id: 1, message: 'High speed detected', timestamp: new Date() },
    { id: 2, device_id: 2, message: 'Geofence breached', timestamp: new Date() },
];

// ===== API Routes =====

// Health check
app.get('/', (req, res) => {
    res.send('✅ Backend server is running!');
});

// Get all devices
app.get('/api/devices', (req, res) => {
    res.json(devices);
});

// Get alerts
app.get('/api/alerts', (req, res) => {
    const limit = req.query.limit || 100;
    res.json(alerts.slice(0, limit));
});

// Get GPS data for a device
app.get('/api/gps/:deviceId', (req, res) => {
    const deviceId = parseInt(req.params.deviceId);
    const device = devices.find(d => d.device_id === deviceId);
    if (device) {
        res.json({
            deviceId,
            records: [
                { lat: device.latitude, lon: device.longitude, timestamp: new Date() }
            ]
        });
    } else {
        res.status(404).json({ message: 'Device not found' });
    }
});

// Create a new device
app.post('/api/devices', (req, res) => {
    const newDevice = {
        device_id: devices.length + 1,
        ...req.body
    };
    devices.push(newDevice);
    res.status(201).json(newDevice);
});

// Enterprise feature routes
const firmwareRoutes = require('./src/routes/firmware');
const remoteRoutes = require('./src/routes/remote');
const vpnRoutes = require('./src/routes/vpn');
const tasksRoutes = require('./src/routes/tasks');
const reportsRoutes = require('./src/routes/reports');

app.use('/api/firmware', firmwareRoutes);
app.use('/api/remote', remoteRoutes);
app.use('/api/vpn', vpnRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/reports', reportsRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Listening on all interfaces (0.0.0.0:${PORT})`);
});
