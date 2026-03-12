const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const gpsRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(gpsRateLimiter);

// Get latest GPS data for all devices
router.get('/latest', async (req, res) => {
    try {
        const result = await req.pool.query(
            `SELECT d.device_id, d.device_name, d.imei, d.last_seen,
                    g.latitude, g.longitude, g.altitude, g.speed, g.course, g.satellites, g.timestamp
             FROM devices d
             LEFT JOIN LATERAL (
                 SELECT * FROM gps_data
                 WHERE device_id = d.device_id
                 ORDER BY timestamp DESC
                 LIMIT 1
             ) g ON true`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching latest GPS data:', err);
        res.status(500).json({ error: 'Failed to fetch latest GPS data' });
    }
});

// Get GPS history for a specific device
router.get('/history/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        const result = await req.pool.query(
            `SELECT * FROM gps_data
             WHERE device_id = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [deviceId, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching GPS history:', err);
        res.status(500).json({ error: 'Failed to fetch GPS history' });
    }
});

// Add GPS data point for a device
router.post('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { latitude, longitude, altitude, speed, course, satellites, timestamp } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'latitude and longitude are required' });
        }

        const result = await req.pool.query(
            `INSERT INTO gps_data (device_id, latitude, longitude, altitude, speed, course, satellites, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [deviceId, latitude, longitude, altitude || 0, speed || 0, course || 0, satellites || 0, timestamp || new Date()]
        );

        await req.pool.query(
            'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
            [deviceId]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error inserting GPS data:', err);
        res.status(500).json({ error: 'Failed to insert GPS data' });
    }
});

module.exports = router;
