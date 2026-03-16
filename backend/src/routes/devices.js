const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/roles');

const getDb = (req) => req.app.get('db');

// GET /api/devices - Get all devices
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { group_id, status, search } = req.query;

        let query = `
            SELECT d.*, dg.group_name,
                   g.latitude as last_lat, g.longitude as last_lon, g.speed as last_speed, g.timestamp as last_seen,
                   CASE WHEN g.timestamp > NOW() - INTERVAL '5 minutes' THEN 'online'
                        WHEN g.timestamp > NOW() - INTERVAL '1 hour' THEN 'idle'
                        ELSE 'offline' END as status
            FROM devices d
            LEFT JOIN device_groups dg ON d.group_id = dg.group_id
            LEFT JOIN LATERAL (
                SELECT latitude, longitude, speed, timestamp
                FROM gps_data
                WHERE device_id = d.device_id
                ORDER BY timestamp DESC LIMIT 1
            ) g ON true
            WHERE 1=1
        `;
        const params = [];

        if (req.user.role === ROLES.DRIVER) {
            params.push(req.user.userId);
            query += ` AND d.assigned_driver_id = $${params.length}`;
        }

        if (group_id) {
            params.push(group_id);
            query += ` AND d.group_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (d.device_name ILIKE $${params.length} OR d.imei ILIKE $${params.length})`;
        }

        query += ' ORDER BY d.device_name';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get devices error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/devices/:id - Get single device
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `SELECT d.*, dg.group_name,
                    u.username as driver_name
             FROM devices d
             LEFT JOIN device_groups dg ON d.group_id = dg.group_id
             LEFT JOIN users u ON d.assigned_driver_id = u.user_id
             WHERE d.device_id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Device not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get device error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/devices - Create device
router.post('/', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { device_name, imei, model, sim_number, group_id, assigned_driver_id } = req.body;

    if (!device_name || !imei) {
        return res.status(400).json({ message: 'Device name and IMEI are required' });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO devices (device_name, imei, model, sim_number, group_id, assigned_driver_id, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [device_name, imei, model || null, sim_number || null, group_id || null, assigned_driver_id || null, req.user.userId]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'IMEI already exists' });
        }
        console.error('Create device error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/devices/:id - Update device
router.put('/:id', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { device_name, model, sim_number, group_id, assigned_driver_id, speed_limit } = req.body;

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `UPDATE devices SET
                device_name = COALESCE($1, device_name),
                model = COALESCE($2, model),
                sim_number = COALESCE($3, sim_number),
                group_id = $4,
                assigned_driver_id = $5,
                speed_limit = COALESCE($6, speed_limit),
                updated_at = CURRENT_TIMESTAMP
             WHERE device_id = $7
             RETURNING *`,
            [device_name, model, sim_number, group_id || null, assigned_driver_id || null, speed_limit, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Device not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update device error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', authenticateToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            'DELETE FROM devices WHERE device_id = $1 RETURNING device_id',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Device not found' });
        }

        res.status(204).send();
    } catch (err) {
        console.error('Delete device error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/devices/:id/sensors - Get device sensor data
router.get('/:id/sensors', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `SELECT * FROM device_sensors WHERE device_id = $1 ORDER BY recorded_at DESC LIMIT 100`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get sensors error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/devices/:id/commands - Send command to device
router.post('/:id/commands', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { command, parameters } = req.body;

    if (!command) {
        return res.status(400).json({ message: 'Command is required' });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO device_commands (device_id, command, parameters, issued_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [req.params.id, command, parameters ? JSON.stringify(parameters) : null, req.user.userId]
        );

        const io = req.app.get('io');
        if (io) {
            io.to(`device-${req.params.id}`).emit('command', result.rows[0]);
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Send command error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/devices/:id/commands - Get device commands
router.get('/:id/commands', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `SELECT dc.*, u.username as issued_by_username
             FROM device_commands dc
             LEFT JOIN users u ON dc.issued_by = u.user_id
             WHERE dc.device_id = $1
             ORDER BY dc.executed_at DESC LIMIT 50`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get commands error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
