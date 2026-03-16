const express = require('express');
const router = express.Router();

// In-memory analytics store (replace with DB in production)
let scans = [];
let discoveredDevices = [];

// ─── Overview ────────────────────────────────────────────────────────────────

router.get('/overview', (req, res) => {
    const totalScans = scans.length;
    const completedScans = scans.filter(s => s.status === 'completed').length;
    const totalDevices = discoveredDevices.length;
    const registeredDevices = discoveredDevices.filter(d => d.registration_status === 'registered').length;
    const avgDevicesPerScan = completedScans > 0
        ? (discoveredDevices.length / completedScans).toFixed(2)
        : 0;

    res.json({
        total_scans: totalScans,
        completed_scans: completedScans,
        total_devices_discovered: totalDevices,
        registered_devices: registeredDevices,
        pending_devices: totalDevices - registeredDevices,
        success_rate: totalScans > 0 ? ((completedScans / totalScans) * 100).toFixed(1) : 0,
        avg_devices_per_scan: parseFloat(avgDevicesPerScan),
    });
});

// ─── Devices ─────────────────────────────────────────────────────────────────

router.get('/devices', (req, res) => {
    const online = discoveredDevices.filter(d => d.status === 'online').length;
    const offline = discoveredDevices.filter(d => d.status === 'offline').length;

    res.json({
        total: discoveredDevices.length,
        online,
        offline,
        registered: discoveredDevices.filter(d => d.registration_status === 'registered').length,
        pending: discoveredDevices.filter(d => d.registration_status === 'pending').length,
    });
});

// ─── Trends ──────────────────────────────────────────────────────────────────

router.get('/trends', (req, res) => {
    // Group scans and devices by date
    const scansByDate = {};
    const devicesByDate = {};

    scans.forEach(s => {
        const date = s.started_at ? s.started_at.split('T')[0] : 'unknown';
        scansByDate[date] = (scansByDate[date] || 0) + 1;
    });

    discoveredDevices.forEach(d => {
        const date = d.discovered_at ? d.discovered_at.split('T')[0] : 'unknown';
        devicesByDate[date] = (devicesByDate[date] || 0) + 1;
    });

    const dates = Array.from(new Set([...Object.keys(scansByDate), ...Object.keys(devicesByDate)])).sort();

    res.json({
        labels: dates,
        scans_per_day: dates.map(d => scansByDate[d] || 0),
        devices_per_day: dates.map(d => devicesByDate[d] || 0),
    });
});

// ─── Protocols ───────────────────────────────────────────────────────────────

router.get('/protocols', (req, res) => {
    const counts = {};
    discoveredDevices.forEach(d => {
        counts[d.protocol] = (counts[d.protocol] || 0) + 1;
    });

    const result = Object.entries(counts).map(([protocol, count]) => ({ protocol, count }));
    result.sort((a, b) => b.count - a.count);

    res.json({ protocols: result, total: discoveredDevices.length });
});

// ─── Manufacturers ───────────────────────────────────────────────────────────

router.get('/manufacturers', (req, res) => {
    const counts = {};
    const modelCounts = {};

    discoveredDevices.forEach(d => {
        counts[d.manufacturer] = (counts[d.manufacturer] || 0) + 1;
        const key = `${d.manufacturer}::${d.model}`;
        modelCounts[key] = (modelCounts[key] || 0) + 1;
    });

    const manufacturers = Object.entries(counts)
        .map(([manufacturer, count]) => ({ manufacturer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const models = Object.entries(modelCounts)
        .map(([key, count]) => {
            const [manufacturer, model] = key.split('::');
            return { manufacturer, model, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    res.json({ manufacturers, models });
});

// ─── Performance ─────────────────────────────────────────────────────────────

router.get('/performance', (req, res) => {
    const completed = scans.filter(s => s.status === 'completed' && s.completed_at && s.started_at);

    let avgDuration = 0;
    if (completed.length) {
        const totalMs = completed.reduce((sum, s) => {
            return sum + (new Date(s.completed_at) - new Date(s.started_at));
        }, 0);
        avgDuration = Math.round(totalMs / completed.length);
    }

    res.json({
        completed_scans: completed.length,
        avg_scan_duration_ms: avgDuration,
        total_devices_found: discoveredDevices.length,
        avg_devices_per_minute: avgDuration > 0
            ? ((discoveredDevices.length / (avgDuration / 60000))).toFixed(2)
            : 0,
    });
});

// ─── Export ──────────────────────────────────────────────────────────────────

router.get('/export', (req, res) => {
    const { format = 'json' } = req.query;

    if (format === 'csv') {
        const headers = 'device_id,ip,manufacturer,model,protocol,status,registration_status,latitude,longitude,discovered_at';
        const rows = discoveredDevices.map(d =>
            [d.device_id, d.ip, d.manufacturer, d.model, d.protocol, d.status, d.registration_status, d.latitude, d.longitude, d.discovered_at].join(',')
        );
        const csv = [headers, ...rows].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="discovery_export.csv"');
        return res.send(csv);
    }

    res.json({ scans, devices: discoveredDevices });
});

// ─── Seed helpers for other modules ─────────────────────────────────────────

function addScan(scan) { scans.push(scan); }
function addDevice(device) { discoveredDevices.push(device); }

module.exports = router;
module.exports.addScan = addScan;
module.exports.addDevice = addDevice;
