const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Point-in-polygon (ray casting)
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// GET /api/geofences
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM geofences ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch geofences' });
  }
});

// GET /api/geofences/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM geofences WHERE geofence_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Geofence not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch geofence' });
  }
});

// POST /api/geofences
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, shape_type, center_lat, center_lon, radius_meters, polygon_coords, speed_limit, alert_on_entry, alert_on_exit } = req.body;
    if (!name || !shape_type) return res.status(400).json({ message: 'name and shape_type are required' });
    if (shape_type === 'circle' && (!center_lat || !center_lon || !radius_meters)) {
      return res.status(400).json({ message: 'center_lat, center_lon, radius_meters required for circle' });
    }
    if (shape_type === 'polygon' && (!polygon_coords || !Array.isArray(polygon_coords))) {
      return res.status(400).json({ message: 'polygon_coords array required for polygon' });
    }
    const result = await query(
      `INSERT INTO geofences (name, description, shape_type, center_lat, center_lon, radius_meters, polygon_coords, speed_limit, alert_on_entry, alert_on_exit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, description || null, shape_type, center_lat || null, center_lon || null, radius_meters || null,
       polygon_coords ? JSON.stringify(polygon_coords) : null, speed_limit || null,
       alert_on_entry !== false, alert_on_exit !== false, req.user.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create geofence' });
  }
});

// PUT /api/geofences/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, shape_type, center_lat, center_lon, radius_meters, polygon_coords, speed_limit, alert_on_entry, alert_on_exit, active } = req.body;
    const result = await query(
      `UPDATE geofences SET name = COALESCE($1, name), description = COALESCE($2, description),
        shape_type = COALESCE($3, shape_type), center_lat = COALESCE($4, center_lat),
        center_lon = COALESCE($5, center_lon), radius_meters = COALESCE($6, radius_meters),
        polygon_coords = COALESCE($7, polygon_coords), speed_limit = COALESCE($8, speed_limit),
        alert_on_entry = COALESCE($9, alert_on_entry), alert_on_exit = COALESCE($10, alert_on_exit),
        active = COALESCE($11, active), updated_at = NOW()
       WHERE geofence_id = $12 RETURNING *`,
      [name, description, shape_type, center_lat, center_lon, radius_meters,
       polygon_coords ? JSON.stringify(polygon_coords) : null, speed_limit,
       alert_on_entry, alert_on_exit, active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Geofence not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update geofence' });
  }
});

// DELETE /api/geofences/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM geofences WHERE geofence_id = $1 RETURNING geofence_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Geofence not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete geofence' });
  }
});

// POST /api/geofences/check - check if a GPS point is inside any geofence
router.post('/check', async (req, res) => {
  try {
    const { device_id, latitude, longitude } = req.body;
    if (!device_id || latitude == null || longitude == null) {
      return res.status(400).json({ message: 'device_id, latitude, longitude required' });
    }
    const fences = await query("SELECT * FROM geofences WHERE active = true");
    const events = [];
    for (const fence of fences.rows) {
      let inside = false;
      if (fence.shape_type === 'circle') {
        const dist = haversine(latitude, longitude, parseFloat(fence.center_lat), parseFloat(fence.center_lon));
        inside = dist <= parseFloat(fence.radius_meters);
      } else if (fence.shape_type === 'polygon') {
        const coords = typeof fence.polygon_coords === 'string' ? JSON.parse(fence.polygon_coords) : fence.polygon_coords;
        inside = pointInPolygon(latitude, longitude, coords);
      }
      // Get last known state
      const lastEvent = await query(
        'SELECT event_type FROM geofence_events WHERE geofence_id = $1 AND device_id = $2 ORDER BY occurred_at DESC LIMIT 1',
        [fence.geofence_id, device_id]
      );
      const wasInside = lastEvent.rows.length > 0 && lastEvent.rows[0].event_type === 'entry';
      if (inside && !wasInside) {
        await query(
          'INSERT INTO geofence_events (geofence_id, device_id, event_type, latitude, longitude) VALUES ($1, $2, $3, $4, $5)',
          [fence.geofence_id, device_id, 'entry', latitude, longitude]
        );
        events.push({ geofence_id: fence.geofence_id, name: fence.name, event_type: 'entry' });
      } else if (!inside && wasInside) {
        await query(
          'INSERT INTO geofence_events (geofence_id, device_id, event_type, latitude, longitude) VALUES ($1, $2, $3, $4, $5)',
          [fence.geofence_id, device_id, 'exit', latitude, longitude]
        );
        events.push({ geofence_id: fence.geofence_id, name: fence.name, event_type: 'exit' });
      }
    }
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Geofence check failed' });
  }
});

// GET /api/geofences/:id/events
router.get('/:id/events', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT ge.*, d.device_name FROM geofence_events ge
       LEFT JOIN devices d ON d.device_id = ge.device_id
       WHERE ge.geofence_id = $1 ORDER BY ge.occurred_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch geofence events' });
  }
});

module.exports = router;
