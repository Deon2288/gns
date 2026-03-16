const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/trips
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { device_id, from, to, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT t.*, d.device_name FROM trips t LEFT JOIN devices d ON d.device_id = t.device_id WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (device_id) { sql += ` AND t.device_id = $${idx++}`; params.push(device_id); }
    if (from) { sql += ` AND t.start_time >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND t.end_time <= $${idx++}`; params.push(to); }
    sql += ` ORDER BY t.start_time DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch trips' });
  }
});

// GET /api/trips/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT t.*, d.device_name FROM trips t LEFT JOIN devices d ON d.device_id = t.device_id WHERE t.trip_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Trip not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch trip' });
  }
});

// GET /api/trips/:id/waypoints
router.get('/:id/waypoints', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM trip_waypoints WHERE trip_id = $1 ORDER BY recorded_at',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch waypoints' });
  }
});

// POST /api/trips - start a new trip
router.post('/', async (req, res) => {
  try {
    const { device_id, start_lat, start_lon, driver_id } = req.body;
    if (!device_id) return res.status(400).json({ message: 'device_id is required' });
    // Close any open trips for this device first
    await query("UPDATE trips SET status = 'completed', end_time = NOW() WHERE device_id = $1 AND status = 'active'", [device_id]);
    const result = await query(
      `INSERT INTO trips (device_id, start_lat, start_lon, driver_id, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [device_id, start_lat || null, start_lon || null, driver_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to start trip' });
  }
});

// PATCH /api/trips/:id/end - end a trip
router.patch('/:id/end', async (req, res) => {
  try {
    const { end_lat, end_lon, distance_km, fuel_used, max_speed, avg_speed, idle_time_seconds } = req.body;
    const result = await query(
      `UPDATE trips SET status = 'completed', end_time = NOW(),
        end_lat = COALESCE($1, end_lat), end_lon = COALESCE($2, end_lon),
        distance_km = COALESCE($3, distance_km), fuel_used = COALESCE($4, fuel_used),
        max_speed = COALESCE($5, max_speed), avg_speed = COALESCE($6, avg_speed),
        idle_time_seconds = COALESCE($7, idle_time_seconds),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INT
       WHERE trip_id = $8 AND status = 'active' RETURNING *`,
      [end_lat, end_lon, distance_km, fuel_used, max_speed, avg_speed, idle_time_seconds, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Active trip not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to end trip' });
  }
});

// POST /api/trips/:id/waypoint - add a waypoint to a trip
router.post('/:id/waypoint', async (req, res) => {
  try {
    const { latitude, longitude, speed, altitude, heading } = req.body;
    const result = await query(
      'INSERT INTO trip_waypoints (trip_id, latitude, longitude, speed, altitude, heading) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.id, latitude, longitude, speed || 0, altitude || 0, heading || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add waypoint' });
  }
});

module.exports = router;
