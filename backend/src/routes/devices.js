const express = require('express');
const router = express.Router();

// Mock database for devices
dlet devices = [];

// Get all devices
router.get('/devices', (req, res) => {
    res.json(devices);
});

// Create a new device
router.post('/devices', (req, res) => {
    const newDevice = { id: devices.length + 1, ...req.body };
    devices.push(newDevice);
    res.status(201).json(newDevice);
});

// Update a device
router.put('/devices/:id', (req, res) => {
    const deviceId = parseInt(req.params.id);
    const index = devices.findIndex(dev => dev.id === deviceId);
    if (index !== -1) {
        devices[index] = { id: deviceId, ...req.body };
        res.json(devices[index]);
    } else {
        res.status(404).json({ message: 'Device not found' });
    }
});

// Delete a device
router.delete('/devices/:id', (req, res) => {
    const deviceId = parseInt(req.params.id);
    devices = devices.filter(dev => dev.id !== deviceId);
    res.status(204).send();
});

module.exports = router;