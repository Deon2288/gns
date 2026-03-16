const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Calculate safety score from behavior events
function calculateSafetyScore(events) {
  let score = 100;
  const deductions = { harsh_acceleration: 3, harsh_braking: 4, harsh_cornering: 2, speeding: 5, excessive_idling: 1 };
  events.forEach((e) => {
    score -= (deductions[e.event_type] || 1) * (e.count || 1);
  });
  return Math.max(0, Math.min(100, Math.round(score)));
}

// GET /api/drivers - list drivers with scores
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT ds.*, u.username, u.email
       FROM driver_scores ds
       LEFT JOIN users u ON u.user_id = ds.user_id
       ORDER BY ds.safety_score DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch drivers' });
  }
});

// GET /api/drivers/:userId/score
router.get('/:userId/score', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM driver_scores WHERE user_id = $1',
      [req.params.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Driver score not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch driver score' });
  }
});

// GET /api/drivers/:userId/events - behavior events for a driver
router.get('/:userId/events', authenticateToken, async (req, res) => {
  try {
    const { from, to, limit = 100 } = req.query;
    let sql = 'SELECT be.*, d.device_name FROM behavior_events be LEFT JOIN devices d ON d.device_id = be.device_id WHERE be.driver_id = $1';
    const params = [req.params.userId];
    let idx = 2;
    if (from) { sql += ` AND be.occurred_at >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND be.occurred_at <= $${idx++}`; params.push(to); }
    sql += ` ORDER BY be.occurred_at DESC LIMIT $${idx}`;
    params.push(parseInt(limit, 10));
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch behavior events' });
  }
});

// POST /api/drivers/event - record a behavior event
router.post('/event', async (req, res) => {
  try {
    const { device_id, driver_id, event_type, severity = 'warning', value, latitude, longitude } = req.body;
    if (!device_id || !event_type) return res.status(400).json({ message: 'device_id and event_type are required' });
    const result = await query(
      `INSERT INTO behavior_events (device_id, driver_id, event_type, severity, value, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [device_id, driver_id || null, event_type, severity, value || null, latitude || null, longitude || null]
    );
    // Recalculate score if driver is identified
    if (driver_id) {
      const eventsResult = await query(
        `SELECT event_type, COUNT(*) AS count FROM behavior_events WHERE driver_id = $1 AND occurred_at > NOW() - INTERVAL '30 days' GROUP BY event_type`,
        [driver_id]
      );
      const score = calculateSafetyScore(eventsResult.rows);
      await query(
        `INSERT INTO driver_scores (user_id, safety_score, events_last_30d, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET safety_score = $2, events_last_30d = $3, updated_at = NOW()`,
        [driver_id, score, eventsResult.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0)]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to record event' });
  }
});

// GET /api/drivers/leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT ds.user_id, u.username, ds.safety_score, ds.events_last_30d, ds.updated_at
       FROM driver_scores ds LEFT JOIN users u ON u.user_id = ds.user_id
       ORDER BY ds.safety_score DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
