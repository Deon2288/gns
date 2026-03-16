const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

const getDb = (req) => req.app.get('db');

// GET /api/gps/latest - Get latest GPS for all devices
router.get('/latest', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const result = await pool.query(`
            SELECT DISTINCT ON (g.device_id)
                g.gps_id, g.device_id, g.latitude, g.longitude, g.speed, g.heading, g.altitude,
                g.satellites, g.accuracy, g.timestamp,
                d.device_name, d.imei
            FROM gps_data g
            JOIN devices d ON g.device_id = d.device_id
            ORDER BY g.device_id, g.timestamp DESC
        `);

        const io = req.app.get('io');
        if (io) {
            io.emit('location-update', result.rows);
        }

        res.json(result.rows);
    } catch (err) {
        console.error('Get latest GPS error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/gps/:deviceId - Get GPS history for device
router.get('/:deviceId', authenticateToken, async (req, res) => {
    try {
        const pool = getDb(req);
        const { from, to, limit = 1000 } = req.query;

        let query = `
            SELECT * FROM gps_data
            WHERE device_id = $1
        `;
        const params = [req.params.deviceId];

        if (from) {
            params.push(from);
            query += ` AND timestamp >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            query += ` AND timestamp <= $${params.length}`;
        }

        params.push(Math.min(parseInt(limit), 10000));
        query += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get GPS history error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/gps - Ingest GPS data (from tracking device)
router.post('/', async (req, res) => {
    const { device_id, imei, latitude, longitude, speed, heading, altitude, satellites, accuracy, timestamp } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    try {
        const pool = getDb(req);

        let deviceId = device_id;
        if (!deviceId && imei) {
            const devResult = await pool.query('SELECT device_id FROM devices WHERE imei = $1', [imei]);
            if (devResult.rows.length > 0) {
                deviceId = devResult.rows[0].device_id;
            }
        }

        if (!deviceId) {
            return res.status(404).json({ message: 'Device not found' });
        }

        const result = await pool.query(
            `INSERT INTO gps_data (device_id, latitude, longitude, speed, heading, altitude, satellites, accuracy, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [deviceId, latitude, longitude, speed || 0, heading || 0, altitude || 0, satellites || 0, accuracy || 0, timestamp || new Date()]
        );

        const gpsRecord = result.rows[0];

        const io = req.app.get('io');
        if (io) {
            io.to(`device-${deviceId}`).emit('gps-update', gpsRecord);
            io.emit('location-update', [{ ...gpsRecord, device_id: deviceId }]);
        }

        await checkGeofenceEvents(pool, deviceId, latitude, longitude, io);
        await checkSpeedAlert(pool, deviceId, speed, io);

        res.status(201).json(gpsRecord);
    } catch (err) {
        console.error('GPS ingest error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper: Check geofence events
async function checkGeofenceEvents(pool, deviceId, lat, lon, io) {
    try {
        const geofences = await pool.query(
            `SELECT ga.*, g.name, g.geofence_type, g.coordinates, g.radius
             FROM geofence_assignments ga
             JOIN geofences g ON ga.geofence_id = g.geofence_id
             WHERE ga.device_id = $1 AND g.is_active = true`,
            [deviceId]
        );

        for (const geofence of geofences.rows) {
            const inside = isInsideGeofence(lat, lon, geofence);

            const lastEvent = await pool.query(
                `SELECT event_type FROM geofence_events
                 WHERE device_id = $1 AND geofence_id = $2
                 ORDER BY event_time DESC LIMIT 1`,
                [deviceId, geofence.geofence_id]
            );

            const wasInside = lastEvent.rows.length > 0 && lastEvent.rows[0].event_type === 'enter';

            if (inside && !wasInside) {
                await pool.query(
                    `INSERT INTO geofence_events (device_id, geofence_id, event_type, latitude, longitude)
                     VALUES ($1, $2, 'enter', $3, $4)`,
                    [deviceId, geofence.geofence_id, lat, lon]
                );

                if (io) {
                    io.emit('geofence-event', { deviceId, geofenceName: geofence.name, event: 'enter', lat, lon });
                }
            } else if (!inside && wasInside) {
                await pool.query(
                    `INSERT INTO geofence_events (device_id, geofence_id, event_type, latitude, longitude)
                     VALUES ($1, $2, 'exit', $3, $4)`,
                    [deviceId, geofence.geofence_id, lat, lon]
                );

                if (io) {
                    io.emit('geofence-event', { deviceId, geofenceName: geofence.name, event: 'exit', lat, lon });
                }
            }
        }
    } catch (err) {
        console.error('Geofence check error:', err);
    }
}

// Helper: Check speed alerts
async function checkSpeedAlert(pool, deviceId, speed, io) {
    if (!speed) return;

    try {
        const device = await pool.query(
            'SELECT speed_limit FROM devices WHERE device_id = $1',
            [deviceId]
        );

        if (device.rows.length > 0 && device.rows[0].speed_limit && speed > device.rows[0].speed_limit) {
            const alert = await pool.query(
                `INSERT INTO alert_history (device_id, alert_type, message, severity, data)
                 VALUES ($1, 'speed', $2, 'warning', $3)
                 RETURNING *`,
                [deviceId, `Speed limit exceeded: ${speed} km/h (limit: ${device.rows[0].speed_limit} km/h)`,
                 JSON.stringify({ speed, limit: device.rows[0].speed_limit })]
            );

            if (io) {
                io.emit('alert', alert.rows[0]);
            }
        }
    } catch (err) {
        console.error('Speed alert check error:', err);
    }
}

// Helper: Check if point is inside geofence
function isInsideGeofence(lat, lon, geofence) {
    if (geofence.geofence_type === 'circle') {
        const coords = typeof geofence.coordinates === 'string'
            ? JSON.parse(geofence.coordinates)
            : geofence.coordinates;
        const center = coords.center || coords;
        return getDistance(lat, lon, center.lat, center.lng) <= geofence.radius;
    } else if (geofence.geofence_type === 'polygon') {
        const coords = typeof geofence.coordinates === 'string'
            ? JSON.parse(geofence.coordinates)
            : geofence.coordinates;
        return isPointInPolygon(lat, lon, coords.points || coords);
    }
    return false;
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPointInPolygon(lat, lon, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        // x = longitude (horizontal axis), y = latitude (vertical axis)
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > lat) !== (yj > lat)) &&
                          (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

module.exports = router;
