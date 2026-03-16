const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/roles');

const getDb = (req) => req.app.get('db');

// GET /api/alerts/rules - Get all alert rules
router.get('/rules', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `SELECT ar.*, d.device_name
             FROM alert_rules ar
             LEFT JOIN devices d ON ar.device_id = d.device_id
             ORDER BY ar.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get alert rules error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/alerts/rules - Create alert rule
router.post('/rules', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { device_id, alert_type, threshold_value, threshold_unit, is_active, recipients } = req.body;

    if (!alert_type) {
        return res.status(400).json({ message: 'Alert type is required' });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO alert_rules (device_id, alert_type, threshold_value, threshold_unit, is_active, recipients, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [device_id || null, alert_type, threshold_value || null, threshold_unit || null,
             is_active !== undefined ? is_active : true, recipients ? JSON.stringify(recipients) : null, req.user.userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create alert rule error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/alerts/rules/:id - Update alert rule
router.put('/rules/:id', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { threshold_value, threshold_unit, is_active, recipients } = req.body;

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `UPDATE alert_rules SET
                threshold_value = COALESCE($1, threshold_value),
                threshold_unit = COALESCE($2, threshold_unit),
                is_active = COALESCE($3, is_active),
                recipients = COALESCE($4, recipients)
             WHERE rule_id = $5
             RETURNING *`,
            [threshold_value, threshold_unit, is_active, recipients ? JSON.stringify(recipients) : null, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Alert rule not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update alert rule error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/alerts/rules/:id
router.delete('/rules/:id', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const pool = getDb(req);
        await pool.query('DELETE FROM alert_rules WHERE rule_id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        console.error('Delete alert rule error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/alerts/history - Get alert history
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { device_id, alert_type, from, to, acknowledged, limit = 100, offset = 0 } = req.query;

        let query = `
            SELECT ah.*, d.device_name
            FROM alert_history ah
            LEFT JOIN devices d ON ah.device_id = d.device_id
            WHERE 1=1
        `;
        const params = [];

        if (device_id) {
            params.push(device_id);
            query += ` AND ah.device_id = $${params.length}`;
        }

        if (alert_type) {
            params.push(alert_type);
            query += ` AND ah.alert_type = $${params.length}`;
        }

        if (from) {
            params.push(from);
            query += ` AND ah.triggered_at >= $${params.length}`;
        }

        if (to) {
            params.push(to);
            query += ` AND ah.triggered_at <= $${params.length}`;
        }

        if (acknowledged !== undefined) {
            params.push(acknowledged === 'true');
            query += ` AND ah.acknowledged = $${params.length}`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY ah.triggered_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get alert history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/alerts/history/:id/acknowledge
router.put('/history/:id/acknowledge', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `UPDATE alert_history SET acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
             WHERE alert_id = $2 RETURNING *`,
            [req.user.userId, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Alert not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Acknowledge alert error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/alerts/summary - Alert statistics
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(`
            SELECT
                alert_type,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE acknowledged = false) as unacknowledged,
                COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '24 hours') as last_24h
            FROM alert_history
            GROUP BY alert_type
            ORDER BY total DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Alert summary error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
