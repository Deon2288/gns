const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// GET /api/gps/latest  — latest position for each device owned by the user
router.get('/gps/latest', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (g.device_id)
                    g.gps_id, g.device_id, d.device_name,
                    g.latitude, g.longitude, g.timestamp
             FROM gps_data g
             JOIN devices d ON d.device_id = g.device_id
             WHERE d.user_id = $1
             ORDER BY g.device_id, g.timestamp DESC`,
            [req.user.userId],
        );
        res.json(result.rows);
    } catch (err) {
        console.error('GET /gps/latest error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/gps/:deviceId  — full history for a specific device
router.get('/gps/:deviceId', authenticateToken, async (req, res) => {
    const { deviceId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    try {
        // Verify ownership
        const owns = await pool.query(
            'SELECT 1 FROM devices WHERE device_id = $1 AND user_id = $2',
            [deviceId, req.user.userId],
        );
        if (!owns.rows[0]) return res.status(404).json({ message: 'Device not found' });

        const result = await pool.query(
            `SELECT gps_id, device_id, latitude, longitude, timestamp
             FROM gps_data
             WHERE device_id = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [deviceId, limit],
        );
        res.json(result.rows);
    } catch (err) {
        console.error('GET /gps/:deviceId error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/gps/:deviceId  — ingest a new GPS record
router.post('/gps/:deviceId', authenticateToken, async (req, res) => {
    const { deviceId } = req.params;
    const { latitude, longitude, timestamp } = req.body;
    if (latitude == null || longitude == null) {
        return res.status(400).json({ message: 'latitude and longitude are required' });
    }
    try {
        const owns = await pool.query(
            'SELECT 1 FROM devices WHERE device_id = $1 AND user_id = $2',
            [deviceId, req.user.userId],
        );
        if (!owns.rows[0]) return res.status(404).json({ message: 'Device not found' });

        const ts = timestamp ? new Date(timestamp) : new Date();
        const result = await pool.query(
            'INSERT INTO gps_data (device_id, latitude, longitude, timestamp) VALUES ($1,$2,$3,$4) RETURNING *',
            [deviceId, latitude, longitude, ts],
        );

        // Broadcast live position update to WebSocket clients
        const broadcast = req.app.locals.broadcast;
        if (broadcast) {
            broadcast({ type: 'gps_update', data: result.rows[0] });
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /gps/:deviceId error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
