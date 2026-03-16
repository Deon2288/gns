const express = require('express');
const router = express.Router();
const { calculateDistance } = require('../services/geoService');

// In-memory trip store (replace with DB queries in production)
let trips = [];
let tripIdCounter = 1;

// GET /api/trips - List all trips, optionally filtered by device_id or date range
router.get('/', (req, res) => {
    const { device_id, start_date, end_date } = req.query;
    let filtered = [...trips];

    if (device_id) {
        filtered = filtered.filter(t => String(t.device_id) === String(device_id));
    }
    if (start_date) {
        filtered = filtered.filter(t => new Date(t.start_time) >= new Date(start_date));
    }
    if (end_date) {
        filtered = filtered.filter(t => new Date(t.end_time) <= new Date(end_date));
    }

    res.json(filtered);
});

// GET /api/trips/:id - Get a specific trip
router.get('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const trip = trips.find(t => t.id === id);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(trip);
});

// POST /api/trips - Create a new trip with GPS waypoints
router.post('/', (req, res) => {
    const { device_id, waypoints, start_time, end_time } = req.body;
    if (!device_id || !waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
        return res.status(400).json({ error: 'device_id and at least 2 waypoints are required' });
    }

    const distance = computeTripDistance(waypoints);
    const duration = computeDuration(start_time, end_time);
    const avgSpeed = computeAverageSpeed(waypoints);
    const maxSpeed = computeMaxSpeed(waypoints);

    const trip = {
        id: tripIdCounter++,
        device_id,
        waypoints,
        start_time: start_time || waypoints[0].timestamp,
        end_time: end_time || waypoints[waypoints.length - 1].timestamp,
        distance: Math.round(distance * 100) / 100,
        duration_minutes: Math.round(duration),
        average_speed: Math.round(avgSpeed * 100) / 100,
        max_speed: Math.round(maxSpeed * 100) / 100,
        created_at: new Date().toISOString(),
    };

    trips.push(trip);
    res.status(201).json(trip);
});

// GET /api/trips/:id/export/csv - Export a trip as CSV
router.get('/:id/export/csv', (req, res) => {
    const id = parseInt(req.params.id);
    const trip = trips.find(t => t.id === id);
    if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
    }

    const headers = 'timestamp,latitude,longitude,speed,altitude\n';
    const rows = trip.waypoints.map(wp =>
        `${wp.timestamp || ''},${wp.latitude},${wp.longitude},${wp.speed || 0},${wp.altitude || 0}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trip-${id}.csv"`);
    res.send(headers + rows);
});

// DELETE /api/trips/:id - Delete a trip
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = trips.findIndex(t => t.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Trip not found' });
    }
    trips.splice(index, 1);
    res.status(204).send();
});

// --- Helper functions ---

function computeTripDistance(waypoints) {
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
        total += calculateDistance(
            waypoints[i - 1].latitude, waypoints[i - 1].longitude,
            waypoints[i].latitude, waypoints[i].longitude
        );
    }
    return total;
}

function computeDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    return (new Date(endTime) - new Date(startTime)) / 60000;
}

function computeAverageSpeed(waypoints) {
    const speeds = waypoints.map(wp => wp.speed || 0);
    return speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
}

function computeMaxSpeed(waypoints) {
    const speeds = waypoints.map(wp => wp.speed || 0);
    return speeds.length > 0 ? Math.max(...speeds) : 0;
}

module.exports = router;
