const express = require('express');
const router = express.Router();

// Handle GPS data from Teltonika RUTX12
// The device can send data via HTTP POST to this endpoint
// Expected format from Teltonika:
// {
//   "imei": "device_imei",
//   "latitude": 40.7128,
//   "longitude": -74.0060,
//   "altitude": 10,
//   "speed": 45.5,
//   "course": 180,
//   "satellites": 12,
//   "hdop": 1.2,
//   "timestamp": "2026-03-12T17:30:00Z"
// }

router.post('/gps', async (req, res) => {
    try {
        const { imei, latitude, longitude, altitude, speed, course, satellites, hdop, timestamp } = req.body;

        if (!imei || !latitude || !longitude) {
            return res.status(400).json({ error: 'Missing required fields: imei, latitude, longitude' });
        }

        // Find device by IMEI
        const deviceResult = await req.pool.query(
            'SELECT device_id FROM devices WHERE imei = $1',
            [imei]
        );

        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: `Device with IMEI ${imei} not found` });
        }

        const device_id = deviceResult.rows[0].device_id;

        // Insert GPS data
        const gpsResult = await req.pool.query(
            `INSERT INTO gps_tracking (device_id, latitude, longitude, altitude, speed, course, satellites, hdop, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             RETURNING *`,
            [device_id, latitude, longitude, altitude || 0, speed || 0, course || 0, satellites || 0, hdop || 0, timestamp || new Date()]
        );

        // Update device last seen timestamp
        await req.pool.query(
            'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
            [device_id]
        );

        res.status(201).json({
            success: true,
            device_id,
            gps_id: gpsResult.rows[0].gps_id,
            message: 'GPS data received successfully'
        });

    } catch (err) {
        console.error('Error processing Teltonika GPS data:', err);
        res.status(500).json({ error: 'Failed to process GPS data' });
    }
});

// Get device status by IMEI
router.get('/device/:imei', async (req, res) => {
    try {
        const { imei } = req.params;

        const result = await req.pool.query(
            `SELECT d.*, 
                    (SELECT COUNT(*) FROM gps_tracking WHERE device_id = d.device_id) as total_gps_points,
                    (SELECT timestamp FROM gps_tracking WHERE device_id = d.device_id ORDER BY timestamp DESC LIMIT 1) as last_gps_update
             FROM devices d 
             WHERE d.imei = $1`,
            [imei]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Device with IMEI ${imei} not found` });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching device by IMEI:', err);
        res.status(500).json({ error: 'Failed to fetch device' });
    }
});

module.exports = router;
