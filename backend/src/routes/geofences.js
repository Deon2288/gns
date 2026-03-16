const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/roles');

const getDb = (req) => req.app.get('db');

// GET /api/geofences
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `SELECT g.*, COUNT(ga.device_id) as assigned_devices
             FROM geofences g
             LEFT JOIN geofence_assignments ga ON g.geofence_id = ga.geofence_id
             GROUP BY g.geofence_id
             ORDER BY g.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get geofences error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/geofences/:id
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const geofenceResult = await pool.query(
            'SELECT * FROM geofences WHERE geofence_id = $1',
            [req.params.id]
        );

        if (geofenceResult.rows.length === 0) {
            return res.status(404).json({ message: 'Geofence not found' });
        }

        const assignmentsResult = await pool.query(
            `SELECT ga.*, d.device_name FROM geofence_assignments ga
             JOIN devices d ON ga.device_id = d.device_id
             WHERE ga.geofence_id = $1`,
            [req.params.id]
        );

        res.json({
            ...geofenceResult.rows[0],
            assignments: assignmentsResult.rows
        });
    } catch (err) {
        console.error('Get geofence error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/geofences - Create geofence
router.post('/', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { name, description, geofence_type, coordinates, radius, color, is_active } = req.body;

    if (!name || !geofence_type || !coordinates) {
        return res.status(400).json({ message: 'Name, type and coordinates are required' });
    }

    if (!['circle', 'polygon', 'route'].includes(geofence_type)) {
        return res.status(400).json({ message: 'Invalid geofence type. Must be circle, polygon, or route' });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO geofences (name, description, geofence_type, coordinates, radius, color, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [name, description || null, geofence_type, JSON.stringify(coordinates), radius || null,
             color || '#FF6B6B', is_active !== undefined ? is_active : true, req.user.userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create geofence error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/geofences/:id
router.put('/:id', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { name, description, coordinates, radius, color, is_active } = req.body;

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `UPDATE geofences SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                coordinates = COALESCE($3, coordinates),
                radius = COALESCE($4, radius),
                color = COALESCE($5, color),
                is_active = COALESCE($6, is_active)
             WHERE geofence_id = $7
             RETURNING *`,
            [name, description, coordinates ? JSON.stringify(coordinates) : null, radius, color, is_active, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Geofence not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update geofence error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/geofences/:id
router.delete('/:id', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const pool = getDb(req);
        await pool.query('DELETE FROM geofences WHERE geofence_id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        console.error('Delete geofence error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/geofences/:id/assign - Assign device to geofence
router.post('/:id/assign', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { device_id, alert_on_enter, alert_on_exit } = req.body;

    if (!device_id) {
        return res.status(400).json({ message: 'Device ID is required' });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO geofence_assignments (geofence_id, device_id, alert_on_enter, alert_on_exit)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (geofence_id, device_id) DO UPDATE SET
                alert_on_enter = $3, alert_on_exit = $4
             RETURNING *`,
            [req.params.id, device_id, alert_on_enter !== undefined ? alert_on_enter : true,
             alert_on_exit !== undefined ? alert_on_exit : true]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Assign device to geofence error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/geofences/:id/assign/:deviceId
router.delete('/:id/assign/:deviceId', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const pool = getDb(req);
        await pool.query(
            'DELETE FROM geofence_assignments WHERE geofence_id = $1 AND device_id = $2',
            [req.params.id, req.params.deviceId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Remove device from geofence error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/geofences/:id/events - Get geofence events
router.get('/:id/events', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { from, to, device_id, limit = 100 } = req.query;

        let query = `
            SELECT ge.*, d.device_name
            FROM geofence_events ge
            JOIN devices d ON ge.device_id = d.device_id
            WHERE ge.geofence_id = $1
        `;
        const params = [req.params.id];

        if (device_id) {
            params.push(device_id);
            query += ` AND ge.device_id = $${params.length}`;
        }
        if (from) {
            params.push(from);
            query += ` AND ge.event_time >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            query += ` AND ge.event_time <= $${params.length}`;
        }

        params.push(parseInt(limit));
        query += ` ORDER BY ge.event_time DESC LIMIT $${params.length}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get geofence events error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
