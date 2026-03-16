const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// POST /api/telemetry/:deviceId  — store telemetry record
router.post('/:deviceId', authenticateToken, async (req, res) => {
    const { deviceId } = req.params;
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({ message: 'Telemetry data body is required' });
    }
    try {
        const owns = await pool.query(
            'SELECT 1 FROM devices WHERE device_id = $1 AND user_id = $2',
            [deviceId, req.user.userId],
        );
        if (!owns.rows[0]) return res.status(404).json({ message: 'Device not found' });

        const result = await pool.query(
            'INSERT INTO telemetry (device_id, data, timestamp) VALUES ($1,$2,NOW()) RETURNING *',
            [deviceId, JSON.stringify(data)],
        );

        const broadcast = req.app.locals.broadcast;
        if (broadcast) broadcast({ type: 'telemetry', data: result.rows[0] });

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /telemetry/:deviceId error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /api/telemetry/:deviceId  — latest telemetry records for a device
router.get('/:deviceId', authenticateToken, async (req, res) => {
    const { deviceId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    try {
        const owns = await pool.query(
            'SELECT 1 FROM devices WHERE device_id = $1 AND user_id = $2',
            [deviceId, req.user.userId],
        );
        if (!owns.rows[0]) return res.status(404).json({ message: 'Device not found' });

        const result = await pool.query(
            `SELECT telemetry_id, device_id, data, timestamp
             FROM telemetry
             WHERE device_id = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [deviceId, limit],
        );
        res.json(result.rows);
    } catch (err) {
        console.error('GET /telemetry/:deviceId error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
