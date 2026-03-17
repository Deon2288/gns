const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/devices - List all devices
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*,
        (SELECT metric_type || ':' || value::text
         FROM snmp_metrics WHERE device_id = d.device_id
         ORDER BY timestamp DESC LIMIT 1) as last_metric
       FROM devices d
       ORDER BY d.created_at DESC`
    );
    res.json({ devices: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM devices WHERE device_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices - Create device
router.post('/', async (req, res) => {
  const { device_name, ip_address, mac_address, model, firmware, device_type, snmp_community, location, tags, metadata } = req.body;
  if (!device_name || !ip_address) {
    return res.status(400).json({ error: 'device_name and ip_address are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO devices (device_name, ip_address, mac_address, model, firmware, device_type, snmp_community, location, tags, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [device_name, ip_address, mac_address, model || 'Unknown', firmware, device_type || 'unknown', snmp_community || 'public', location, tags, JSON.stringify(metadata || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Device with this IP already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/:id/update - Update device
router.post('/:id/update', async (req, res) => {
  const { device_name, model, firmware, device_type, snmp_community, location, tags, metadata, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE devices SET
        device_name = COALESCE($1, device_name),
        model = COALESCE($2, model),
        firmware = COALESCE($3, firmware),
        device_type = COALESCE($4, device_type),
        snmp_community = COALESCE($5, snmp_community),
        location = COALESCE($6, location),
        tags = COALESCE($7, tags),
        metadata = COALESCE($8, metadata),
        status = COALESCE($9, status),
        updated_at = NOW()
       WHERE device_id = $10
       RETURNING *`,
      [device_name, model, firmware, device_type, snmp_community, location, tags, metadata ? JSON.stringify(metadata) : null, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM devices WHERE device_id = $1 RETURNING device_id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ message: 'Device deleted', device_id: result.rows[0].device_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/devices - Bulk delete
router.delete('/', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM devices WHERE device_id = ANY($1::int[]) RETURNING device_id',
      [ids]
    );
    res.json({ message: `Deleted ${result.rows.length} devices`, deleted: result.rows.map(r => r.device_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;