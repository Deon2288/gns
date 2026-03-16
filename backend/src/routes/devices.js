const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// GET /api/devices
router.get('/devices', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.device_id, d.device_name, d.created_at,
                    g.latitude, g.longitude, g.timestamp AS last_seen
             FROM devices d
             LEFT JOIN LATERAL (
                 SELECT latitude, longitude, timestamp
                 FROM gps_data
                 WHERE device_id = d.device_id
                 ORDER BY timestamp DESC
                 LIMIT 1
             ) g ON true
             WHERE d.user_id = $1
             ORDER BY d.device_name`,
            [req.user.userId],
        );
        res.json(result.rows);
    } catch (err) {
        console.error('GET /devices error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/devices
router.post('/devices', authenticateToken, async (req, res) => {
    const { device_name } = req.body;
    if (!device_name) return res.status(400).json({ message: 'device_name is required' });
    try {
        const result = await pool.query(
            'INSERT INTO devices (user_id, device_name) VALUES ($1, $2) RETURNING *',
            [req.user.userId, device_name],
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /devices error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PUT /api/devices/:id
router.put('/devices/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { device_name } = req.body;
    if (!device_name) return res.status(400).json({ message: 'device_name is required' });
    try {
        const result = await pool.query(
            'UPDATE devices SET device_name = $1 WHERE device_id = $2 AND user_id = $3 RETURNING *',
            [device_name, id, req.user.userId],
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Device not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PUT /devices/:id error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE /api/devices/:id
router.delete('/devices/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM devices WHERE device_id = $1 AND user_id = $2 RETURNING device_id',
            [id, req.user.userId],
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Device not found' });
        res.status(204).send();
    } catch (err) {
        console.error('DELETE /devices/:id error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
