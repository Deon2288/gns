const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const getDb = (req) => req.app.get('db');

// GET /api/notifications - Get user notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { read, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT * FROM notifications
            WHERE user_id = $1
        `;
        const params = [req.user.userId];

        if (read !== undefined) {
            params.push(read === 'true');
            query += ` AND is_read = $${params.length}`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await pool.query(query, params);

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
            [req.user.userId]
        );

        res.json({
            notifications: result.rows,
            unread_count: parseInt(countResult.rows[0].count)
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/notifications/read-all - Mark all as read (must be before /:id routes)
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [req.user.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        await pool.query(
            'UPDATE notifications SET is_read = true WHERE notification_id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        await pool.query(
            'DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('Delete notification error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
