const express = require('express');
const router = express.Router();

// In-memory store (replace with DB queries as needed)
let devices = [];

// Get all devices
router.get('/', (req, res) => {
    res.json(devices);
});

// Create a new device
router.post('/', (req, res) => {
    if (!req.body || !req.body.name) {
        return res.status(400).json({ error: 'Device name is required' });
    }
    const newDevice = { id: devices.length + 1, ...req.body };
    devices.push(newDevice);
    res.status(201).json(newDevice);
});

// Update a device
router.put('/:id', (req, res) => {
    const deviceId = parseInt(req.params.id, 10);
    const index = devices.findIndex(dev => dev.id === deviceId);
    if (index !== -1) {
        devices[index] = { id: deviceId, ...req.body };
        res.json(devices[index]);
    } else {
        res.status(404).json({ error: 'Device not found' });
    }
});

// Delete a device
router.delete('/:id', (req, res) => {
    const deviceId = parseInt(req.params.id, 10);
    const exists = devices.some(dev => dev.id === deviceId);
    if (!exists) {
        return res.status(404).json({ error: 'Device not found' });
    }
    devices = devices.filter(dev => dev.id !== deviceId);
    res.status(204).send();
});

module.exports = router;