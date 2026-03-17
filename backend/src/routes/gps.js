const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/gps/:deviceId - Get GPS data for device
router.get('/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 100, since } = req.query;
  try {
    let query = 'SELECT * FROM gps_data WHERE device_id = $1';
    const params = [deviceId];
    if (since) {
      params.push(since);
      query += ` AND timestamp >= $${params.length}`;
    }
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    const result = await pool.query(query, params);
    res.json({ records: result.rows, device_id: deviceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gps - Get latest GPS for all devices
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (g.device_id) g.*, d.device_name, d.ip_address
       FROM gps_data g
       JOIN devices d ON g.device_id = d.device_id
       ORDER BY g.device_id, g.timestamp DESC`
    );
    res.json({ records: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gps - Add GPS record
router.post('/', async (req, res) => {
  const { device_id, latitude, longitude, speed, heading, altitude, timestamp } = req.body;
  if (!device_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'device_id, latitude, longitude required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO gps_data (device_id, latitude, longitude, speed, heading, altitude, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [device_id, latitude, longitude, speed, heading, altitude, timestamp || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;