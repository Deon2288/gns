const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const getDb = (req) => req.app.get('db');

// GET /api/reports/trips - Trip report
router.get('/trips', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { device_id, driver_id, from, to } = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        let query = `
            SELECT t.*, d.device_name, u.username as driver_name
            FROM trips t
            JOIN devices d ON t.device_id = d.device_id
            LEFT JOIN users u ON t.driver_id = u.user_id
            WHERE t.start_time BETWEEN $1 AND $2
            AND t.status = 'completed'
        `;
        const params = [fromDate, toDate];

        if (device_id) {
            params.push(device_id);
            query += ` AND t.device_id = $${params.length}`;
        }

        if (driver_id) {
            params.push(driver_id);
            query += ` AND t.driver_id = $${params.length}`;
        }

        query += ' ORDER BY t.start_time DESC';

        const tripsResult = await pool.query(query, params);

        const summaryResult = await pool.query(
            `SELECT
                COUNT(*) as total_trips,
                COALESCE(SUM(distance_km), 0) as total_distance,
                COALESCE(SUM(duration_minutes), 0) as total_duration,
                COALESCE(AVG(avg_speed), 0) as avg_speed,
                COALESCE(SUM(fuel_consumed), 0) as total_fuel,
                COALESCE(SUM(idle_time_minutes), 0) as total_idle
             FROM trips
             WHERE start_time BETWEEN $1 AND $2
             AND status = 'completed'`,
            [fromDate, toDate]
        );

        res.json({
            trips: tripsResult.rows,
            summary: summaryResult.rows[0],
            period: { from: fromDate, to: toDate }
        });
    } catch (err) {
        console.error('Trips report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/reports/driver-behavior - Driver behavior report
router.get('/driver-behavior', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { from, to } = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        const result = await pool.query(
            `SELECT
                u.user_id, u.username, u.full_name,
                COUNT(db.behavior_id) as total_events,
                COUNT(db.behavior_id) FILTER (WHERE db.event_type = 'harsh_acceleration') as harsh_accel,
                COUNT(db.behavior_id) FILTER (WHERE db.event_type = 'harsh_braking') as harsh_brake,
                COUNT(db.behavior_id) FILTER (WHERE db.event_type = 'harsh_cornering') as harsh_corner,
                COUNT(db.behavior_id) FILTER (WHERE db.event_type = 'speeding') as speeding,
                GREATEST(0, 100 - COUNT(db.behavior_id) * 2) as safety_score
             FROM users u
             LEFT JOIN driver_behavior db ON u.user_id = db.driver_id
                AND db.recorded_at BETWEEN $1 AND $2
             GROUP BY u.user_id, u.username, u.full_name
             ORDER BY safety_score DESC`,
            [fromDate, toDate]
        );

        res.json({
            drivers: result.rows,
            period: { from: fromDate, to: toDate }
        });
    } catch (err) {
        console.error('Driver behavior report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/reports/vehicle-utilization - Vehicle utilization report
router.get('/vehicle-utilization', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { from, to } = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        const result = await pool.query(
            `SELECT
                d.device_id, d.device_name, d.imei,
                COUNT(t.trip_id) as total_trips,
                COALESCE(SUM(t.distance_km), 0) as total_distance,
                COALESCE(SUM(t.duration_minutes), 0) as active_minutes,
                COALESCE(SUM(t.idle_time_minutes), 0) as idle_minutes,
                COALESCE(SUM(t.fuel_consumed), 0) as fuel_consumed,
                CASE WHEN SUM(t.duration_minutes) > 0
                     THEN ROUND(SUM(t.distance_km) / NULLIF(SUM(t.fuel_consumed), 0), 2)
                     ELSE 0 END as fuel_efficiency
             FROM devices d
             LEFT JOIN trips t ON d.device_id = t.device_id
                AND t.start_time BETWEEN $1 AND $2
                AND t.status = 'completed'
             GROUP BY d.device_id, d.device_name, d.imei
             ORDER BY total_trips DESC`,
            [fromDate, toDate]
        );

        res.json({
            vehicles: result.rows,
            period: { from: fromDate, to: toDate }
        });
    } catch (err) {
        console.error('Vehicle utilization report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/reports/alerts - Alerts report
router.get('/alerts', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { from, to, device_id } = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        let query = `
            SELECT
                alert_type,
                severity,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE acknowledged = true) as acknowledged,
                COUNT(*) FILTER (WHERE acknowledged = false) as unacknowledged
            FROM alert_history
            WHERE triggered_at BETWEEN $1 AND $2
        `;
        const params = [fromDate, toDate];

        if (device_id) {
            params.push(device_id);
            query += ` AND device_id = $${params.length}`;
        }

        query += ' GROUP BY alert_type, severity ORDER BY total DESC';

        const result = await pool.query(query, params);

        res.json({
            alerts: result.rows,
            period: { from: fromDate, to: toDate }
        });
    } catch (err) {
        console.error('Alerts report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/reports/geofence-activity - Geofence activity report
router.get('/geofence-activity', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { from, to } = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        const result = await pool.query(
            `SELECT
                g.geofence_id, g.name as geofence_name,
                COUNT(ge.event_id) as total_events,
                COUNT(ge.event_id) FILTER (WHERE ge.event_type = 'enter') as entries,
                COUNT(ge.event_id) FILTER (WHERE ge.event_type = 'exit') as exits,
                COUNT(DISTINCT ge.device_id) as unique_devices
             FROM geofences g
             LEFT JOIN geofence_events ge ON g.geofence_id = ge.geofence_id
                AND ge.event_time BETWEEN $1 AND $2
             GROUP BY g.geofence_id, g.name
             ORDER BY total_events DESC`,
            [fromDate, toDate]
        );

        res.json({
            geofences: result.rows,
            period: { from: fromDate, to: toDate }
        });
    } catch (err) {
        console.error('Geofence activity report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/reports/speed - Speed report
router.get('/speed', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { device_id, from, to } = req.query;

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        let query = `
            SELECT
                g.device_id, d.device_name,
                AVG(g.speed) as avg_speed,
                MAX(g.speed) as max_speed,
                COUNT(*) FILTER (WHERE g.speed > COALESCE(d.speed_limit, 120)) as speed_violations,
                COUNT(*) as total_records
            FROM gps_data g
            JOIN devices d ON g.device_id = d.device_id
            WHERE g.timestamp BETWEEN $1 AND $2
        `;
        const params = [fromDate, toDate];

        if (device_id) {
            params.push(device_id);
            query += ` AND g.device_id = $${params.length}`;
        }

        query += ' GROUP BY g.device_id, d.device_name ORDER BY max_speed DESC';

        const result = await pool.query(query, params);

        res.json({
            speeds: result.rows,
            period: { from: fromDate, to: toDate }
        });
    } catch (err) {
        console.error('Speed report error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
