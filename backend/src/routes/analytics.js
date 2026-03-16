const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/dashboard - KPI summary
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const [devices, alerts, trips, drivers] = await Promise.all([
      query("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'online') AS online FROM devices"),
      query("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE acknowledged = false) AS unacknowledged FROM alerts WHERE triggered_at > NOW() - INTERVAL '24 hours'"),
      query("SELECT COUNT(*) AS total, COALESCE(SUM(distance_km), 0) AS total_km, COALESCE(SUM(fuel_used), 0) AS total_fuel FROM trips WHERE start_time > NOW() - INTERVAL '24 hours'"),
      query("SELECT COALESCE(AVG(safety_score), 0) AS avg_score FROM driver_scores"),
    ]);
    res.json({
      devices: { total: parseInt(devices.rows[0].total), online: parseInt(devices.rows[0].online) },
      alerts: { total: parseInt(alerts.rows[0].total), unacknowledged: parseInt(alerts.rows[0].unacknowledged) },
      trips: { total: parseInt(trips.rows[0].total), total_km: parseFloat(trips.rows[0].total_km), total_fuel: parseFloat(trips.rows[0].total_fuel) },
      drivers: { avg_score: parseFloat(parseFloat(drivers.rows[0].avg_score).toFixed(1)) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch dashboard KPIs' });
  }
});

// GET /api/analytics/trips - trip analytics over time
router.get('/trips', authenticateToken, async (req, res) => {
  try {
    const { from, to, device_id, group_by = 'day' } = req.query;
    const interval = group_by === 'week' ? 'week' : group_by === 'month' ? 'month' : 'day';
    let sql = `
      SELECT DATE_TRUNC($1, start_time) AS period,
        COUNT(*) AS trip_count,
        COALESCE(SUM(distance_km), 0) AS total_km,
        COALESCE(SUM(fuel_used), 0) AS total_fuel,
        COALESCE(AVG(avg_speed), 0) AS avg_speed,
        COALESCE(SUM(idle_time_seconds), 0) AS total_idle_seconds
      FROM trips WHERE status = 'completed'`;
    const params = [interval];
    let idx = 2;
    if (device_id) { sql += ` AND device_id = $${idx++}`; params.push(device_id); }
    if (from) { sql += ` AND start_time >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND start_time <= $${idx++}`; params.push(to); }
    sql += ` GROUP BY period ORDER BY period DESC LIMIT 90`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch trip analytics' });
  }
});

// GET /api/analytics/alerts - alert analytics
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT alert_type, severity, COUNT(*) AS count FROM alerts WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (from) { sql += ` AND triggered_at >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND triggered_at <= $${idx++}`; params.push(to); }
    sql += ' GROUP BY alert_type, severity ORDER BY count DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch alert analytics' });
  }
});

// GET /api/analytics/fleet - fleet utilization
router.get('/fleet', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const toDate = to || new Date().toISOString();
    const result = await query(
      `SELECT d.device_id, d.device_name, d.status,
        COUNT(t.trip_id) AS trips,
        COALESCE(SUM(t.distance_km), 0) AS distance_km,
        COALESCE(SUM(t.fuel_used), 0) AS fuel_used,
        COALESCE(AVG(ds.safety_score), 0) AS avg_safety_score
       FROM devices d
       LEFT JOIN trips t ON t.device_id = d.device_id AND t.start_time BETWEEN $1 AND $2
       LEFT JOIN driver_scores ds ON ds.user_id = t.driver_id
       GROUP BY d.device_id, d.device_name, d.status
       ORDER BY distance_km DESC`,
      [fromDate, toDate]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch fleet analytics' });
  }
});

// GET /api/analytics/fuel - fuel consumption
router.get('/fuel', authenticateToken, async (req, res) => {
  try {
    const { device_id, from, to } = req.query;
    let sql = `SELECT DATE_TRUNC('day', start_time) AS day,
        COALESCE(SUM(fuel_used), 0) AS fuel_used,
        COALESCE(SUM(distance_km), 0) AS distance_km,
        CASE WHEN SUM(distance_km) > 0 THEN SUM(fuel_used) / SUM(distance_km) * 100 ELSE 0 END AS l_per_100km
       FROM trips WHERE status = 'completed'`;
    const params = [];
    let idx = 1;
    if (device_id) { sql += ` AND device_id = $${idx++}`; params.push(device_id); }
    if (from) { sql += ` AND start_time >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND start_time <= $${idx++}`; params.push(to); }
    sql += ' GROUP BY day ORDER BY day DESC LIMIT 30';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch fuel analytics' });
  }
});

module.exports = router;
