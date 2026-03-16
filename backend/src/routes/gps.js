const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/gps - ingest GPS data from a device
router.post('/', async (req, res) => {
  try {
    const { device_id, latitude, longitude, speed, altitude, heading, accuracy, ignition, fuel_level, odometer, satellites } = req.body;
    if (!device_id || latitude == null || longitude == null) {
      return res.status(400).json({ message: 'device_id, latitude, longitude are required' });
    }
    const result = await query(
      `INSERT INTO gps_data (device_id, latitude, longitude, speed, altitude, heading, accuracy, ignition, fuel_level, odometer, satellites)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [device_id, latitude, longitude, speed || 0, altitude || 0, heading || 0, accuracy || 0, ignition || false, fuel_level || null, odometer || null, satellites || 0]
    );
    // Update device status to online
    await query("UPDATE devices SET status = 'online', updated_at = NOW() WHERE device_id = $1", [device_id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`device_${device_id}`).emit('gps_update', result.rows[0]);
      io.emit('fleet_update', { device_id, ...result.rows[0] });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to ingest GPS data' });
  }
});

// GET /api/gps/latest - latest position for all devices
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (g.device_id) g.*, d.device_name, d.status, d.model
       FROM gps_data g
       JOIN devices d ON d.device_id = g.device_id
       ORDER BY g.device_id, g.timestamp DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch latest GPS data' });
  }
});

// GET /api/gps/:deviceId - history for a device
router.get('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { from, to, limit = 100 } = req.query;
    let sql = 'SELECT * FROM gps_data WHERE device_id = $1';
    const params = [req.params.deviceId];
    let idx = 2;
    if (from) { sql += ` AND timestamp >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND timestamp <= $${idx++}`; params.push(to); }
    sql += ` ORDER BY timestamp DESC LIMIT $${idx}`;
    params.push(parseInt(limit, 10));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch GPS data' });
  }
});

module.exports = router;