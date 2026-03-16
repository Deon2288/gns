const express = require('express');
const router = express.Router();
const { calculateDistance, calculateAverageSpeed } = require('../services/geoService');

// In-memory GPS data store (replace with DB queries in production)
// Keyed by device_id, each value is an array of GPS records
const gpsHistory = new Map();

// GET /api/analytics/fleet - Fleet-wide statistics
router.get('/fleet', (req, res) => {
    const deviceIds = [...gpsHistory.keys()];
    const stats = deviceIds.map(deviceId => {
        const records = gpsHistory.get(deviceId) || [];
        return getDeviceStats(deviceId, records);
    });

    const activeDevices = stats.filter(s => s.status === 'active').length;
    const idleDevices = stats.filter(s => s.status === 'idle').length;
    const offlineDevices = stats.filter(s => s.status === 'offline').length;
    const totalDistance = stats.reduce((sum, s) => sum + s.totalDistance, 0);
    const avgSpeed = stats.length > 0
        ? stats.reduce((sum, s) => sum + s.averageSpeed, 0) / stats.length
        : 0;

    res.json({
        totalDevices: deviceIds.length,
        activeDevices,
        idleDevices,
        offlineDevices,
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageSpeed: Math.round(avgSpeed * 100) / 100,
        devices: stats,
    });
});

// GET /api/analytics/device/:deviceId - Per-device statistics
router.get('/device/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const records = gpsHistory.get(deviceId) || [];
    const stats = getDeviceStats(deviceId, records);
    res.json(stats);
});

// POST /api/analytics/gps - Record new GPS data point (used internally)
router.post('/gps', (req, res) => {
    const { device_id, latitude, longitude, speed, altitude, timestamp } = req.body;
    if (!device_id || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'device_id, latitude, and longitude are required' });
    }

    if (!gpsHistory.has(device_id)) {
        gpsHistory.set(device_id, []);
    }
    const records = gpsHistory.get(device_id);
    records.push({ latitude, longitude, speed: speed || 0, altitude: altitude || 0, timestamp: timestamp || new Date().toISOString() });

    // Keep only last 1000 records per device
    if (records.length > 1000) {
        records.splice(0, records.length - 1000);
    }

    // Broadcast GPS update via WebSocket
    const wss = req.app.locals.wss;
    if (wss && wss.broadcastGpsUpdate) {
        wss.broadcastGpsUpdate({ device_id, latitude, longitude, speed, altitude, timestamp });
    }

    res.status(201).json({ message: 'GPS data recorded', records: records.length });
});

// GET /api/analytics/speed-distribution/:deviceId - Speed distribution for charts
router.get('/speed-distribution/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const records = gpsHistory.get(deviceId) || [];
    const distribution = [
        { range: '0-20', count: 0 },
        { range: '20-40', count: 0 },
        { range: '40-60', count: 0 },
        { range: '60-80', count: 0 },
        { range: '80-100', count: 0 },
        { range: '100+', count: 0 },
    ];

    records.forEach(r => {
        const speed = r.speed || 0;
        if (speed < 20) distribution[0].count++;
        else if (speed < 40) distribution[1].count++;
        else if (speed < 60) distribution[2].count++;
        else if (speed < 80) distribution[3].count++;
        else if (speed < 100) distribution[4].count++;
        else distribution[5].count++;
    });

    res.json(distribution);
});

/**
 * Computes summary statistics for a device.
 */
function getDeviceStats(deviceId, records) {
    if (records.length === 0) {
        return { deviceId, status: 'offline', totalDistance: 0, averageSpeed: 0, maxSpeed: 0, totalRecords: 0 };
    }

    const lastRecord = records[records.length - 1];
    const lastUpdate = new Date(lastRecord.timestamp);
    const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / 60000;

    let status = 'offline';
    if (minutesSinceUpdate < 5) {
        status = lastRecord.speed > 2 ? 'active' : 'idle';
    }

    let totalDistance = 0;
    for (let i = 1; i < records.length; i++) {
        totalDistance += calculateDistance(
            records[i - 1].latitude, records[i - 1].longitude,
            records[i].latitude, records[i].longitude
        );
    }

    const speeds = records.map(r => r.speed || 0);
    const avgSpeed = calculateAverageSpeed(speeds);
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    return {
        deviceId,
        status,
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageSpeed: Math.round(avgSpeed * 100) / 100,
        maxSpeed: Math.round(maxSpeed * 100) / 100,
        totalRecords: records.length,
        lastUpdate: lastRecord.timestamp,
        lastPosition: { latitude: lastRecord.latitude, longitude: lastRecord.longitude },
    };
}

module.exports = router;
module.exports.gpsHistory = gpsHistory;
