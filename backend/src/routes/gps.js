const express = require('express');
const router = express.Router();

// Mock GPS data
let gpsData = [
    { deviceId: '1', records: [{ lat: 10.0, lon: 20.0, timestamp: '2026-03-16T15:24:00Z' }] },
    { deviceId: '2', records: [{ lat: 15.0, lon: 25.0, timestamp: '2026-03-16T15:25:00Z' }] }
];

// GET /latest - must be defined before /:deviceId to avoid route conflict
router.get('/latest', (req, res) => {
    const latestRecords = gpsData.map(data => {
        const latestRecord = data.records[data.records.length - 1];
        return { deviceId: data.deviceId, latestRecord };
    });
    res.status(200).json(latestRecords);
});

// GET /:deviceId - fetch GPS data for a specific device
router.get('/:deviceId', (req, res) => {
    const { deviceId } = req.params;
    const deviceData = gpsData.find(data => data.deviceId === deviceId);

    if (deviceData) {
        res.status(200).json(deviceData);
    } else {
        res.status(404).json({ error: 'Device not found' });
    }
});

module.exports = router;