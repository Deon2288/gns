const express = require('express');
const router = express.Router();

// In-memory storage for discovery state (replace with DB in production)
let scans = [];
let discoveredDevices = [];
let scanIdCounter = 1;
let deviceIdCounter = 1;

// ─── Utility ────────────────────────────────────────────────────────────────

function generateScanId() {
    return `scan-${scanIdCounter++}`;
}

function generateDeviceId() {
    return `dev-${deviceIdCounter++}`;
}

function simulateDeviceDiscovery(ipRange) {
    // Simulate discovering devices in a given IP range
    const parts = ipRange.split('/');
    const baseIp = parts[0];
    const subnet = parseInt(parts[1]) || 24;
    const ipParts = baseIp.split('.');
    const count = Math.floor(Math.random() * 5) + 1;
    const devices = [];

    const protocols = ['teltonika', 'nmea', 'http', 'mqtt', 'snmp'];
    const manufacturers = ['Teltonika', 'Quectel', 'Sierra Wireless', 'Cradlepoint', 'Pepwave'];
    const models = {
        Teltonika: ['FMB125', 'FMB920', 'FMT100', 'FMB140', 'FMB003'],
        Quectel: ['EC21', 'EC25', 'RG500Q', 'BG96', 'MC60'],
        'Sierra Wireless': ['RV50', 'RV55', 'MP70', 'LX40', 'GX450'],
        Cradlepoint: ['IBR600', 'IBR900', 'E300', 'R500', 'R1900'],
        Pepwave: ['MAX BR1', 'MAX BR2', 'MAX Transit', 'Balance One', 'AP One'],
    };

    for (let i = 0; i < count; i++) {
        const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
        const modelList = models[manufacturer];
        const model = modelList[Math.floor(Math.random() * modelList.length)];
        const protocol = protocols[Math.floor(Math.random() * protocols.length)];
        const hostOctet = Math.floor(Math.random() * 254) + 1;
        const ip = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${hostOctet}`;

        devices.push({
            ip,
            manufacturer,
            model,
            protocol,
            status: 'online',
            response_time: Math.floor(Math.random() * 200) + 10,
            latitude: parseFloat((Math.random() * 180 - 90).toFixed(6)),
            longitude: parseFloat((Math.random() * 360 - 180).toFixed(6)),
        });
    }

    return devices;
}

// ─── Scan Endpoints ──────────────────────────────────────────────────────────

// Start a new discovery scan
router.post('/scan', (req, res) => {
    const { ip_range, protocols = ['all'], timeout = 5000 } = req.body;

    if (!ip_range) {
        return res.status(400).json({ message: 'ip_range is required' });
    }

    const scanId = generateScanId();
    const scan = {
        scan_id: scanId,
        ip_range,
        protocols,
        timeout,
        status: 'running',
        started_at: new Date().toISOString(),
        completed_at: null,
        devices_found: 0,
        devices: [],
    };

    scans.push(scan);

    // Simulate async scan completion
    setTimeout(() => {
        const found = simulateDeviceDiscovery(ip_range);
        scan.status = 'completed';
        scan.completed_at = new Date().toISOString();
        scan.devices_found = found.length;

        found.forEach(device => {
            const d = {
                device_id: generateDeviceId(),
                scan_id: scanId,
                ...device,
                discovered_at: new Date().toISOString(),
                registration_status: 'pending',
            };
            scan.devices.push(d);
            discoveredDevices.push(d);
        });
    }, 2000);

    res.status(201).json({ scan_id: scanId, message: 'Scan started', status: 'running' });
});

// Get all scans
router.get('/scans', (req, res) => {
    res.json(scans.map(s => ({
        scan_id: s.scan_id,
        ip_range: s.ip_range,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.completed_at,
        devices_found: s.devices_found,
    })));
});

// Get scan by ID
router.get('/scans/:scanId', (req, res) => {
    const scan = scans.find(s => s.scan_id === req.params.scanId);
    if (!scan) return res.status(404).json({ message: 'Scan not found' });
    res.json(scan);
});

// ─── Discovered Devices Endpoints ───────────────────────────────────────────

// Get all discovered devices
router.get('/devices', (req, res) => {
    const { scan_id, status, protocol } = req.query;
    let result = discoveredDevices;

    if (scan_id) result = result.filter(d => d.scan_id === scan_id);
    if (status) result = result.filter(d => d.status === status);
    if (protocol) result = result.filter(d => d.protocol === protocol);

    res.json(result);
});

// Register discovered devices in bulk
router.post('/devices/register', (req, res) => {
    const { device_ids, group_id } = req.body;

    if (!device_ids || !Array.isArray(device_ids)) {
        return res.status(400).json({ message: 'device_ids array is required' });
    }

    const registered = [];
    device_ids.forEach(id => {
        const device = discoveredDevices.find(d => d.device_id === id);
        if (device) {
            device.registration_status = 'registered';
            device.group_id = group_id || null;
            device.registered_at = new Date().toISOString();
            registered.push(device);
        }
    });

    res.json({ registered_count: registered.length, devices: registered });
});

module.exports = router;
