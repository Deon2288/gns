const express = require('express');
const router = express.Router();

// Get all alerts
router.get('/', async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const result = await req.pool.query(
            'SELECT * FROM alerts ORDER BY created_at DESC LIMIT $1',
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// Get alerts for specific device
router.get('/device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const result = await req.pool.query(
            'SELECT * FROM alerts WHERE device_id = $1 ORDER BY created_at DESC',
            [deviceId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch device alerts' });
    }
});

// Create new alert
router.post('/', async (req, res) => {
    try {
        const { device_id, alert_type, message, severity } = req.body;
        const result = await req.pool.query(
            `INSERT INTO alerts (device_id, alert_type, message, severity, acknowledged, created_at)
             VALUES ($1, $2, $3, $4, false, NOW())
             RETURNING *`,
            [device_id, alert_type, message, severity]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create alert' });
    }
});

// Acknowledge alert
router.put('/:alertId/acknowledge', async (req, res) => {
    try {
        const { alertId } = req.params;
        const result = await req.pool.query(
            'UPDATE alerts SET acknowledged = true WHERE alert_id = $1 RETURNING *',
            [alertId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// Get unacknowledged alerts count
router.get('/unacknowledged/count', async (req, res) => {
    try {
        const result = await req.pool.query(
            'SELECT COUNT(*) as count FROM alerts WHERE acknowledged = false'
        );
        res.json({ unacknowledgedCount: parseInt(result.rows[0].count) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch count' });
    }
});

module.exports = router;
