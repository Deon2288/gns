const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts - list alerts with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { device_id, type, severity, acknowledged, from, to, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT a.*, d.device_name FROM alerts a
               LEFT JOIN devices d ON d.device_id = a.device_id WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (device_id) { sql += ` AND a.device_id = $${idx++}`; params.push(device_id); }
    if (type) { sql += ` AND a.alert_type = $${idx++}`; params.push(type); }
    if (severity) { sql += ` AND a.severity = $${idx++}`; params.push(severity); }
    if (acknowledged !== undefined) { sql += ` AND a.acknowledged = $${idx++}`; params.push(acknowledged === 'true'); }
    if (from) { sql += ` AND a.triggered_at >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND a.triggered_at <= $${idx++}`; params.push(to); }
    sql += ` ORDER BY a.triggered_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/summary - unacknowledged counts by severity
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT severity, COUNT(*) AS count FROM alerts WHERE acknowledged = false GROUP BY severity`
    );
    const summary = { critical: 0, warning: 0, info: 0 };
    result.rows.forEach((r) => { summary[r.severity] = parseInt(r.count, 10); });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch alert summary' });
  }
});

// GET /api/alerts/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT a.*, d.device_name FROM alerts a LEFT JOIN devices d ON d.device_id = a.device_id WHERE a.alert_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch alert' });
  }
});

// POST /api/alerts - create alert (called internally or by device)
router.post('/', async (req, res) => {
  try {
    const { device_id, alert_type, severity = 'warning', message, latitude, longitude, metadata } = req.body;
    if (!device_id || !alert_type || !message) {
      return res.status(400).json({ message: 'device_id, alert_type, message are required' });
    }
    const result = await query(
      `INSERT INTO alerts (device_id, alert_type, severity, message, latitude, longitude, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [device_id, alert_type, severity, message, latitude || null, longitude || null, metadata ? JSON.stringify(metadata) : null]
    );
    const alert = result.rows[0];
    const io = req.app.get('io');
    if (io) io.emit('new_alert', alert);
    res.status(201).json(alert);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create alert' });
  }
});

// PATCH /api/alerts/:id/acknowledge
router.patch('/:id/acknowledge', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'UPDATE alerts SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1 WHERE alert_id = $2 RETURNING *',
      [req.user.userId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to acknowledge alert' });
  }
});

// PATCH /api/alerts/acknowledge-all - acknowledge all unacknowledged alerts
router.patch('/acknowledge-all', authenticateToken, async (req, res) => {
  try {
    await query(
      'UPDATE alerts SET acknowledged = true, acknowledged_at = NOW(), acknowledged_by = $1 WHERE acknowledged = false',
      [req.user.userId]
    );
    res.json({ message: 'All alerts acknowledged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to acknowledge alerts' });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM alerts WHERE alert_id = $1 RETURNING alert_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Alert not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete alert' });
  }
});

module.exports = router;
