const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const getDb = (req) => req.app.get('db');

const GPS_SAMPLE_INTERVAL_SECONDS = 30; // Expected interval between GPS data points

// GET /api/trips - Get trips list
router.get('/', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { device_id, from, to, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT t.*, d.device_name,
                   u.username as driver_name
            FROM trips t
            JOIN devices d ON t.device_id = d.device_id
            LEFT JOIN users u ON t.driver_id = u.user_id
            WHERE 1=1
        `;
        const params = [];

        if (device_id) {
            params.push(device_id);
            query += ` AND t.device_id = $${params.length}`;
        }

        if (from) {
            params.push(from);
            query += ` AND t.start_time >= $${params.length}`;
        }

        if (to) {
            params.push(to);
            query += ` AND t.start_time <= $${params.length}`;
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));
        query += ` ORDER BY t.start_time DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get trips error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/trips/stats/:deviceId - Trip statistics for a device
router.get('/stats/:deviceId', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { period = '30d' } = req.query;

        const days = parseInt(period) || 30;

        const result = await pool.query(
            `SELECT
                COUNT(*) as total_trips,
                SUM(distance_km) as total_distance,
                SUM(duration_minutes) as total_duration,
                AVG(avg_speed) as average_speed,
                MAX(max_speed) as top_speed,
                SUM(idle_time_minutes) as total_idle_time,
                SUM(fuel_consumed) as total_fuel
             FROM trips
             WHERE device_id = $1
               AND start_time > NOW() - ($2 || ' days')::INTERVAL
               AND status = 'completed'`,
            [req.params.deviceId, days]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get trip stats error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/trips/:id - Get single trip with waypoints
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);

        const tripResult = await pool.query(
            `SELECT t.*, d.device_name, u.username as driver_name
             FROM trips t
             JOIN devices d ON t.device_id = d.device_id
             LEFT JOIN users u ON t.driver_id = u.user_id
             WHERE t.trip_id = $1`,
            [req.params.id]
        );

        if (tripResult.rows.length === 0) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const waypointsResult = await pool.query(
            `SELECT latitude, longitude, speed, heading, timestamp
             FROM gps_data
             WHERE device_id = $1 AND timestamp BETWEEN $2 AND $3
             ORDER BY timestamp ASC`,
            [tripResult.rows[0].device_id, tripResult.rows[0].start_time, tripResult.rows[0].end_time || new Date()]
        );

        res.json({
            ...tripResult.rows[0],
            waypoints: waypointsResult.rows
        });
    } catch (err) {
        console.error('Get trip error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/trips - Start a trip
router.post('/', authenticateToken, async (req, res) => {
    const { device_id, driver_id, start_latitude, start_longitude } = req.body;

    if (!device_id) {
        return res.status(400).json({ message: 'Device ID is required' });
    }

    try {
        const pool = getDb(req);

        // End any active trip for this device
        await pool.query(
            `UPDATE trips SET end_time = CURRENT_TIMESTAMP, status = 'completed'
             WHERE device_id = $1 AND status = 'active'`,
            [device_id]
        );

        const result = await pool.query(
            `INSERT INTO trips (device_id, driver_id, start_time, start_latitude, start_longitude, status)
             VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, 'active')
             RETURNING *`,
            [device_id, driver_id || req.user.userId, start_latitude || null, start_longitude || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Start trip error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/trips/:id/end - End a trip
router.put('/:id/end', authenticateToken, async (req, res) => {
    const { end_latitude, end_longitude, fuel_consumed, notes } = req.body;

    try {
        const pool = getDb(req);

        const tripResult = await pool.query('SELECT * FROM trips WHERE trip_id = $1', [req.params.id]);
        if (tripResult.rows.length === 0) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const trip = tripResult.rows[0];

        const statsResult = await pool.query(
            `SELECT
                COUNT(*) as points,
                MAX(speed) as max_speed,
                AVG(speed) as avg_speed,
                SUM(CASE WHEN speed < 5 THEN 1 ELSE 0 END) as idle_points
             FROM gps_data
             WHERE device_id = $1 AND timestamp >= $2`,
            [trip.device_id, trip.start_time]
        );

        const stats = statsResult.rows[0];
        const endTime = new Date();
        const durationMinutes = Math.floor((endTime - new Date(trip.start_time)) / 60000);

        const result = await pool.query(
            `UPDATE trips SET
                end_time = CURRENT_TIMESTAMP,
                end_latitude = $1,
                end_longitude = $2,
                duration_minutes = $3,
                max_speed = $4,
                avg_speed = $5,
                idle_time_minutes = $6,
                fuel_consumed = $7,
                notes = $8,
                status = 'completed'
             WHERE trip_id = $9
             RETURNING *`,
            [end_latitude || null, end_longitude || null, durationMinutes,
             parseFloat(stats.max_speed) || 0, parseFloat(stats.avg_speed) || 0,
             Math.floor((parseInt(stats.idle_points) * GPS_SAMPLE_INTERVAL_SECONDS) / 60),
             fuel_consumed || null, notes || null, req.params.id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('End trip error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
