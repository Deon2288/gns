const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// GET /api/alerts  — list all alerts for the user's devices
router.get('/', authenticateToken, async (req, res) => {
    const { status } = req.query; // optional: 'open' | 'acknowledged'
    try {
        let query = `
            SELECT a.alert_id, a.device_id, d.device_name,
                   a.alert_type, a.message, a.severity,
                   a.acknowledged, a.created_at
            FROM alerts a
            JOIN devices d ON d.device_id = a.device_id
            WHERE d.user_id = $1`;
        const params = [req.user.userId];
        if (status === 'open') {
            query += ' AND a.acknowledged = false';
        } else if (status === 'acknowledged') {
            query += ' AND a.acknowledged = true';
        }
        query += ' ORDER BY a.created_at DESC LIMIT 200';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /alerts error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/alerts  — create an alert (typically called by the backend/device)
router.post('/', authenticateToken, async (req, res) => {
    const { device_id, alert_type, message, severity } = req.body;
    if (!device_id || !alert_type || !message) {
        return res.status(400).json({ message: 'device_id, alert_type, and message are required' });
    }
    try {
        // Verify ownership
        const owns = await pool.query(
            'SELECT 1 FROM devices WHERE device_id = $1 AND user_id = $2',
            [device_id, req.user.userId],
        );
        if (!owns.rows[0]) return res.status(404).json({ message: 'Device not found' });

        const result = await pool.query(
            `INSERT INTO alerts (device_id, alert_type, message, severity)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [device_id, alert_type, message, severity || 'info'],
        );

        const broadcast = req.app.locals.broadcast;
        if (broadcast) broadcast({ type: 'new_alert', data: result.rows[0] });

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST /alerts error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// PATCH /api/alerts/:id/acknowledge
router.patch('/:id/acknowledge', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE alerts a SET acknowledged = true
             FROM devices d
             WHERE a.alert_id = $1 AND a.device_id = d.device_id AND d.user_id = $2
             RETURNING a.*`,
            [id, req.user.userId],
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Alert not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('PATCH /alerts/:id/acknowledge error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// DELETE /api/alerts/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `DELETE FROM alerts a USING devices d
             WHERE a.alert_id = $1 AND a.device_id = d.device_id AND d.user_id = $2
             RETURNING a.alert_id`,
            [id, req.user.userId],
        );
        if (!result.rows[0]) return res.status(404).json({ message: 'Alert not found' });
        res.status(204).send();
    } catch (err) {
        console.error('DELETE /alerts/:id error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
