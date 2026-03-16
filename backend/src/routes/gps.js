const express = require('express');
const router = express.Router();

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
    // Assuming we want the most recent record for each device
    const latestRecords = gpsData.map(data => {
        const latestRecord = data.records[data.records.length - 1];
        return { deviceId: data.deviceId, latestRecord };
    });
    res.status(200).json(latestRecords);
});

module.exports = router;