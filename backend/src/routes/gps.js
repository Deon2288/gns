const express = require('express');
const router = express.Router();

// broadcastGpsUpdate is injected via router.broadcastGpsUpdate after the
// WebSocket server is initialised (see server.js).  Default to a no-op so
// the routes work even when the WebSocket server is not available.
router.broadcastGpsUpdate = () => {};

// Mock GPS data
let gpsData = [
    { deviceId: '1', records: [ { lat: 10.0, lon: 20.0, timestamp: '2026-03-16T15:24:00Z' } ] },
    { deviceId: '2', records: [ { lat: 15.0, lon: 25.0, timestamp: '2026-03-16T15:25:00Z' } ] }
];

// GET endpoint for fetching GPS data by device ID
router.get('/gps/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    const deviceData = gpsData.find(data => data.deviceId === deviceId);

    if (deviceData) {
        res.status(200).json(deviceData);
    } else {
        res.status(404).json({ message: 'Device not found' });
    }
});

// GET endpoint for fetching the latest GPS records
router.get('/gps/latest', (req, res) => {
    const latestRecords = gpsData.map(data => {
        const latestRecord = data.records[data.records.length - 1];
        return { deviceId: data.deviceId, latestRecord };
    });
    res.status(200).json(latestRecords);
});

// POST endpoint for inserting a new GPS record and broadcasting via WebSocket
router.post('/gps', (req, res) => {
    const { device_id, lat, lon } = req.body;
    if (!device_id || lat === undefined || lon === undefined) {
        return res.status(400).json({ message: 'device_id, lat and lon are required' });
    }

    const record = { lat, lon, timestamp: new Date().toISOString() };
    const existing = gpsData.find(d => d.deviceId === String(device_id));
    if (existing) {
        existing.records.push(record);
    } else {
        gpsData.push({ deviceId: String(device_id), records: [record] });
    }

    // Broadcast the new GPS record to all WebSocket clients
    router.broadcastGpsUpdate({
        device_id,
        latitude: lat,
        longitude: lon,
        timestamp: record.timestamp,
    });

    res.status(201).json({ device_id, ...record });
});

module.exports = router;