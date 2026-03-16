const express = require('express');
const router = express.Router();

// Get latest GPS records
router.get('/latest', async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const result = await req.pool.query(
            'SELECT device_id, latitude, longitude, timestamp FROM gps_data ORDER BY timestamp DESC LIMIT $1',
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch GPS data' });
    }
});

// Get GPS data for specific device
router.get('/device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const limit = req.query.limit || 100;
        const result = await req.pool.query(
            'SELECT device_id, latitude, longitude, timestamp FROM gps_data WHERE device_id = $1 ORDER BY timestamp DESC LIMIT $2',
            [deviceId, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch device GPS data' });
    }
});

// Update GPS data
router.post('/update', async (req, res) => {
    try {
        const { device_id, latitude, longitude } = req.body;
        const result = await req.pool.query(
            'INSERT INTO gps_data (device_id, latitude, longitude, timestamp) VALUES ($1, $2, $3, NOW()) RETURNING device_id, latitude, longitude, timestamp',
            [device_id, latitude, longitude]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update GPS data' });
    }
});

// Get device route history
router.get('/route/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const hours = req.query.hours || 24;
        const result = await req.pool.query(
            `SELECT device_id, latitude, longitude, timestamp FROM gps_data
             WHERE device_id = $1 AND timestamp > NOW() - INTERVAL '1 hour' * $2
             ORDER BY timestamp ASC`,
            [deviceId, hours]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch route data' });
    }
});

module.exports = router;
