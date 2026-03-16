const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/roles');

const getDb = (req) => req.app.get('db');

// GET /api/device-groups
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(
            `SELECT dg.*, COUNT(d.device_id) as device_count
             FROM device_groups dg
             LEFT JOIN devices d ON dg.group_id = d.group_id
             GROUP BY dg.group_id
             ORDER BY dg.group_name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get device groups error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/device-groups
router.post('/', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { group_name, description, color } = req.body;

    if (!group_name) {
        return res.status(400).json({ message: 'Group name is required' });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO device_groups (group_name, description, color, created_by)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [group_name, description || null, color || '#4A90E2', req.user.userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create device group error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/device-groups/:id
router.put('/:id', authenticateToken, requireRole(ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    const { group_name, description, color } = req.body;

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `UPDATE device_groups SET
                group_name = COALESCE($1, group_name),
                description = COALESCE($2, description),
                color = COALESCE($3, color)
             WHERE group_id = $4 RETURNING *`,
            [group_name, description, color, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Group not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update device group error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/device-groups/:id
router.delete('/:id', authenticateToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const pool = getDb(req);

        // Unassign all devices from this group
        await pool.query('UPDATE devices SET group_id = NULL WHERE group_id = $1', [req.params.id]);
        await pool.query('DELETE FROM device_groups WHERE group_id = $1', [req.params.id]);

        res.status(204).send();
    } catch (err) {
        console.error('Delete device group error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
