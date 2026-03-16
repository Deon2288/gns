const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/devices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, 
        g.latitude, g.longitude, g.speed, g.altitude, g.heading, g.timestamp AS last_seen,
        g.ignition, g.fuel_level
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT * FROM gps_data WHERE device_id = d.device_id ORDER BY timestamp DESC LIMIT 1
       ) g ON true
       ORDER BY d.device_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch devices' });
  }
});

// GET /api/devices/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*,
        g.latitude, g.longitude, g.speed, g.altitude, g.heading, g.timestamp AS last_seen,
        g.ignition, g.fuel_level
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT * FROM gps_data WHERE device_id = d.device_id ORDER BY timestamp DESC LIMIT 1
       ) g ON true
       WHERE d.device_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Device not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch device' });
  }
});

// POST /api/devices
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { device_name, imei, model, group_name, description } = req.body;
    if (!device_name) return res.status(400).json({ message: 'device_name is required' });
    const result = await query(
      'INSERT INTO devices (device_name, imei, model, group_name, description, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [device_name, imei || null, model || null, group_name || null, description || null, 'offline']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create device' });
  }
});

// PUT /api/devices/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { device_name, imei, model, group_name, description, status } = req.body;
    const result = await query(
      `UPDATE devices SET device_name = COALESCE($1, device_name), imei = COALESCE($2, imei),
        model = COALESCE($3, model), group_name = COALESCE($4, group_name),
        description = COALESCE($5, description), status = COALESCE($6, status)
       WHERE device_id = $7 RETURNING *`,
      [device_name, imei, model, group_name, description, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Device not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update device' });
  }
});

// DELETE /api/devices/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM devices WHERE device_id = $1 RETURNING device_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Device not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete device' });
  }
});

module.exports = router;