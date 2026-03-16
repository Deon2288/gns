const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const getDb = (req) => req.app.get('db');

// GET /api/driver-behavior - Get driver behavior records
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { device_id, driver_id, from, to, limit = 100 } = req.query;

        let query = `
            SELECT db.*, d.device_name, u.username as driver_name
            FROM driver_behavior db
            JOIN devices d ON db.device_id = d.device_id
            LEFT JOIN users u ON db.driver_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (device_id) {
            params.push(device_id);
            query += ` AND db.device_id = $${params.length}`;
        }

        if (driver_id) {
            params.push(driver_id);
            query += ` AND db.driver_id = $${params.length}`;
        }

        if (from) {
            params.push(from);
            query += ` AND db.recorded_at >= $${params.length}`;
        }

        if (to) {
            params.push(to);
            query += ` AND db.recorded_at <= $${params.length}`;
        }

        params.push(parseInt(limit));
        query += ` ORDER BY db.recorded_at DESC LIMIT $${params.length}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get driver behavior error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/driver-behavior/leaderboard - Driver safety leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { period = '30' } = req.query;
        const days = parseInt(period);

        const result = await pool.query(
            `SELECT
                u.user_id, u.username, u.full_name,
                COUNT(db.behavior_id) as total_events,
                COUNT(db.behavior_id) FILTER (WHERE db.severity = 'high') as high_severity,
                (100 - COUNT(db.behavior_id) * 2 - COUNT(db.behavior_id) FILTER (WHERE db.severity = 'high') * 3) as safety_score
             FROM users u
             LEFT JOIN driver_behavior db ON u.user_id = db.driver_id
                AND db.recorded_at > NOW() - ($1 || ' days')::INTERVAL
             WHERE u.role = 'driver'
             GROUP BY u.user_id, u.username, u.full_name
             ORDER BY safety_score DESC`,
            [days]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Get leaderboard error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/driver-behavior/score/:driverId - Get driver safety score
router.get('/score/:driverId', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { period = '30' } = req.query;
        const days = parseInt(period);

        const result = await pool.query(
            `SELECT
                COUNT(*) as total_events,
                COUNT(*) FILTER (WHERE event_type = 'harsh_acceleration') as harsh_acceleration,
                COUNT(*) FILTER (WHERE event_type = 'harsh_braking') as harsh_braking,
                COUNT(*) FILTER (WHERE event_type = 'harsh_cornering') as harsh_cornering,
                COUNT(*) FILTER (WHERE event_type = 'speeding') as speeding_events,
                COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
                COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity,
                COUNT(*) FILTER (WHERE severity = 'low') as low_severity
             FROM driver_behavior
             WHERE driver_id = $1
               AND recorded_at > NOW() - ($2 || ' days')::INTERVAL`,
            [req.params.driverId, days]
        );

        const stats = result.rows[0];

        let score = 100;
        score -= (parseInt(stats.harsh_acceleration) || 0) * 3;
        score -= (parseInt(stats.harsh_braking) || 0) * 3;
        score -= (parseInt(stats.harsh_cornering) || 0) * 2;
        score -= (parseInt(stats.speeding_events) || 0) * 5;
        score -= (parseInt(stats.high_severity) || 0) * 2;
        score = Math.max(0, score);

        res.json({
            driver_id: req.params.driverId,
            period_days: days,
            safety_score: score,
            grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
            statistics: stats
        });
    } catch (err) {
        console.error('Get driver score error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/driver-behavior - Record driver behavior event
router.post('/', async (req, res) => {
    const { device_id, driver_id, event_type, severity, speed, g_force, latitude, longitude } = req.body;

    if (!device_id || !event_type) {
        return res.status(400).json({ message: 'Device ID and event type are required' });
    }

    const validEvents = ['harsh_acceleration', 'harsh_braking', 'harsh_cornering', 'speeding', 'sharp_turn'];
    if (!validEvents.includes(event_type)) {
        return res.status(400).json({ message: 'Invalid event type', validEvents });
    }

    try {
        const pool = getDb(req);
        const result = await pool.query(
            `INSERT INTO driver_behavior (device_id, driver_id, event_type, severity, speed, g_force, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [device_id, driver_id || null, event_type, severity || 'medium',
             speed || null, g_force || null, latitude || null, longitude || null]
        );

        const io = req.app.get('io');
        const alertResult = await pool.query(
            `INSERT INTO alert_history (device_id, alert_type, message, severity, data)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [device_id, event_type,
             `${event_type.replace(/_/g, ' ')} detected at ${speed || 0} km/h`,
             severity || 'medium',
             JSON.stringify({ speed, g_force, latitude, longitude })]
        );

        if (io) {
            io.emit('alert', alertResult.rows[0]);
            io.emit('driver-behavior', result.rows[0]);
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Record driver behavior error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
