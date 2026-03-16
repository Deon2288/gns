const express = require('express');
const router = express.Router();

// In-memory state (replace with DB / background job runner in production)
let monitoringConfig = {
    enabled: false,
    pull_interval: 300,       // seconds
    monitor_type: 'all',      // registered | pending | all
    retry_on_failure: true,
    max_retries: 3,
    timeout: 10000,           // ms
    parallel_checks: 10,
    alert_on_status_change: true,
};

let monitoringLogs = [];
let monitoringTimer = null;
let monitoringStats = {
    status: 'stopped',
    last_check: null,
    devices_checked: 0,
    failed_checks: 0,
    uptime_percentage: 0,
};
let logIdCounter = 1;

// In-memory device list (populated by other modules in production)
let trackedDevices = [];

// ─── Config Endpoints ────────────────────────────────────────────────────────

router.get('/config', (req, res) => {
    res.json(monitoringConfig);
});

router.post('/config', (req, res) => {
    const {
        enabled,
        pull_interval,
        monitor_type,
        retry_on_failure,
        max_retries,
        timeout,
        parallel_checks,
        alert_on_status_change,
    } = req.body;

    if (pull_interval !== undefined && pull_interval < 60) {
        return res.status(400).json({ message: 'pull_interval must be at least 60 seconds' });
    }

    if (enabled !== undefined) monitoringConfig.enabled = enabled;
    if (pull_interval !== undefined) monitoringConfig.pull_interval = pull_interval;
    if (monitor_type !== undefined) monitoringConfig.monitor_type = monitor_type;
    if (retry_on_failure !== undefined) monitoringConfig.retry_on_failure = retry_on_failure;
    if (max_retries !== undefined) monitoringConfig.max_retries = max_retries;
    if (timeout !== undefined) monitoringConfig.timeout = timeout;
    if (parallel_checks !== undefined) monitoringConfig.parallel_checks = parallel_checks;
    if (alert_on_status_change !== undefined) monitoringConfig.alert_on_status_change = alert_on_status_change;

    if (monitoringConfig.enabled) {
        startMonitoring();
    } else {
        stopMonitoring();
    }

    res.json({ message: 'Monitoring configuration updated', config: monitoringConfig });
});

// ─── Status Endpoint ─────────────────────────────────────────────────────────

router.get('/status', (req, res) => {
    res.json({
        ...monitoringStats,
        config: monitoringConfig,
    });
});

// ─── Logs Endpoint ───────────────────────────────────────────────────────────

router.get('/logs', (req, res) => {
    const { device_id, status, limit = 100 } = req.query;
    let logs = monitoringLogs;

    if (device_id) logs = logs.filter(l => l.device_id === device_id);
    if (status) logs = logs.filter(l => l.status === status);

    res.json(logs.slice(-parseInt(limit)));
});

// ─── Pause / Resume ──────────────────────────────────────────────────────────

router.post('/pause', (req, res) => {
    stopMonitoring();
    monitoringStats.status = 'paused';
    res.json({ message: 'Monitoring paused', status: monitoringStats });
});

router.post('/resume', (req, res) => {
    if (!monitoringConfig.enabled) {
        monitoringConfig.enabled = true;
    }
    startMonitoring();
    res.json({ message: 'Monitoring resumed', status: monitoringStats });
});

// ─── Monitoring Engine ────────────────────────────────────────────────────────

function startMonitoring() {
    stopMonitoring();
    monitoringStats.status = 'running';

    monitoringTimer = setInterval(runMonitoringCycle, monitoringConfig.pull_interval * 1000);
    // Run immediately on start
    runMonitoringCycle();
}

function stopMonitoring() {
    if (monitoringTimer) {
        clearInterval(monitoringTimer);
        monitoringTimer = null;
    }
    if (monitoringStats.status === 'running') {
        monitoringStats.status = 'stopped';
    }
}

function runMonitoringCycle() {
    const now = new Date().toISOString();
    monitoringStats.last_check = now;

    let devices = trackedDevices;
    if (monitoringConfig.monitor_type === 'registered') {
        devices = devices.filter(d => d.registration_status === 'registered');
    } else if (monitoringConfig.monitor_type === 'pending') {
        devices = devices.filter(d => d.registration_status === 'pending');
    }

    let checked = 0;
    let failed = 0;

    devices.forEach(device => {
        // Simulate a status check (replace with real ping/HTTP check in production)
        const isOnline = Math.random() > 0.1; // 90% chance online
        const responseTime = isOnline ? Math.floor(Math.random() * 200) + 10 : null;
        const prevStatus = device.status;
        device.status = isOnline ? 'online' : 'offline';
        device.last_seen = now;

        const log = {
            log_id: `log-${logIdCounter++}`,
            device_id: device.device_id,
            check_time: now,
            status: device.status,
            response_time: responseTime,
            error_message: isOnline ? null : 'Device unreachable',
        };
        monitoringLogs.push(log);

        checked++;
        if (!isOnline) failed++;

        if (monitoringConfig.alert_on_status_change && prevStatus !== device.status) {
            // In production, trigger notification here
            console.log(`[monitoring] Device ${device.device_id} status changed: ${prevStatus} → ${device.status}`);
        }
    });

    monitoringStats.devices_checked += checked;
    monitoringStats.failed_checks += failed;
    monitoringStats.uptime_percentage = monitoringStats.devices_checked > 0
        ? (((monitoringStats.devices_checked - monitoringStats.failed_checks) / monitoringStats.devices_checked) * 100).toFixed(2)
        : 100;
}

// Allow other modules to register devices for monitoring
function addTrackedDevice(device) {
    trackedDevices.push(device);
}

module.exports = router;
module.exports.addTrackedDevice = addTrackedDevice;
module.exports.stopMonitoring = stopMonitoring;
