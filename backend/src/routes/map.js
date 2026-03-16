const express = require('express');
const router = express.Router();

// In-memory storage (replace with DB in production)
let discoveredDevices = [];
let wsClients = [];

// ─── Map Endpoints ───────────────────────────────────────────────────────────

// Get all discovered devices with coordinates for map display
router.get('/devices', (req, res) => {
    const { scan_id, status } = req.query;
    let devices = discoveredDevices;

    if (scan_id) devices = devices.filter(d => d.scan_id === scan_id);
    if (status) devices = devices.filter(d => d.status === status);

    const mapDevices = devices.map(d => ({
        device_id: d.device_id,
        scan_id: d.scan_id,
        ip: d.ip,
        manufacturer: d.manufacturer,
        model: d.model,
        protocol: d.protocol,
        status: d.status,
        registration_status: d.registration_status,
        latitude: d.latitude,
        longitude: d.longitude,
        discovered_at: d.discovered_at,
        marker_color: getMarkerColor(d),
    }));

    res.json({ devices: mapDevices, total: mapDevices.length });
});

// Get a specific scan's devices on the map
router.get('/scan/:scanId', (req, res) => {
    const { scanId } = req.params;
    const devices = discoveredDevices
        .filter(d => d.scan_id === scanId)
        .map(d => ({
            device_id: d.device_id,
            ip: d.ip,
            manufacturer: d.manufacturer,
            model: d.model,
            protocol: d.protocol,
            status: d.status,
            registration_status: d.registration_status,
            latitude: d.latitude,
            longitude: d.longitude,
            discovered_at: d.discovered_at,
            marker_color: getMarkerColor(d),
        }));

    if (!devices.length) {
        return res.status(404).json({ message: 'No devices found for this scan' });
    }

    res.json({ scan_id: scanId, devices, total: devices.length });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMarkerColor(device) {
    if (device.registration_status === 'registered') return 'yellow';
    if (device.status === 'offline') return 'red';
    if (device.registration_status === 'pending') return 'blue';
    return 'green';
}

// Allow other modules to push devices onto the map store
function addDiscoveredDevice(device) {
    discoveredDevices.push(device);
    // Broadcast to any WebSocket clients listening
    wsClients.forEach(ws => {
        try {
            ws.send(JSON.stringify({ type: 'new_device', device: { ...device, marker_color: getMarkerColor(device) } }));
        } catch (_) {}
    });
}

function registerWsClient(ws) {
    wsClients.push(ws);
    ws.on('close', () => {
        wsClients = wsClients.filter(c => c !== ws);
    });
}

module.exports = router;
module.exports.addDiscoveredDevice = addDiscoveredDevice;
module.exports.registerWsClient = registerWsClient;
