const express = require('express');
const router = express.Router();
const { checkSpeedAlert, checkOfflineAlert, checkGeofenceAlert } = require('../services/alertService');

// In-memory alert store (replace with DB queries in production)
let alerts = [];
let alertIdCounter = 1;

// GET /api/alerts - List all alerts
router.get('/', (req, res) => {
    const { device_id, acknowledged, type } = req.query;
    let filtered = [...alerts];
    if (device_id) filtered = filtered.filter(a => String(a.device_id) === String(device_id));
    if (acknowledged !== undefined) filtered = filtered.filter(a => a.acknowledged === (acknowledged === 'true'));
    if (type) filtered = filtered.filter(a => a.type === type);
    res.json(filtered);
});

// POST /api/alerts - Create a new alert
router.post('/', (req, res) => {
    const { device_id, type, message, severity } = req.body;
    if (!device_id || !type || !message) {
        return res.status(400).json({ error: 'device_id, type, and message are required' });
    }
    const alert = {
        id: alertIdCounter++,
        device_id,
        type,
        message,
        severity: severity || 'info',
        acknowledged: false,
        created_at: new Date().toISOString(),
    };
    alerts.push(alert);

    // Broadcast alert via WebSocket if available
    const wss = req.app.locals.wss;
    if (wss && wss.broadcastAlert) {
        wss.broadcastAlert(alert);
    }

    res.status(201).json(alert);
});

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert
router.put('/:id/acknowledge', (req, res) => {
    const id = parseInt(req.params.id);
    const alert = alerts.find(a => a.id === id);
    if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
    }
    alert.acknowledged = true;
    alert.acknowledged_at = new Date().toISOString();
    res.json(alert);
});

// DELETE /api/alerts/:id - Delete an alert
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = alerts.findIndex(a => a.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Alert not found' });
    }
    alerts.splice(index, 1);
    res.status(204).send();
});

// GET /api/alerts/check/:deviceId - Manually trigger alert checks for a device
router.post('/check', (req, res) => {
    const { device_id, speed, latitude, longitude, last_update, battery } = req.body;
    const newAlerts = [];

    const speedAlert = checkSpeedAlert(device_id, speed);
    if (speedAlert) newAlerts.push(speedAlert);

    const offlineAlert = checkOfflineAlert(device_id, last_update);
    if (offlineAlert) newAlerts.push(offlineAlert);

    if (latitude !== undefined && longitude !== undefined) {
        const geofenceAlert = checkGeofenceAlert(device_id, latitude, longitude);
        if (geofenceAlert) newAlerts.push(geofenceAlert);
    }

    newAlerts.forEach(alert => {
        alert.id = alertIdCounter++;
        alerts.push(alert);
    });

    const wss = req.app.locals.wss;
    if (wss && wss.broadcastAlert) {
        newAlerts.forEach(alert => wss.broadcastAlert(alert));
    }

    res.json(newAlerts);
});

module.exports = router;
