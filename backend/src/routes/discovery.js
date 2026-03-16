'use strict';

/**
 * Discovery API Routes
 *
 * Provides endpoints to:
 *  - Start / manage network scans
 *  - List discovered devices
 *  - Register discovered devices
 *  - Manage scan configurations
 *  - Query scanner status
 *  - Test a single IP:port
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { scanNetwork, testConnection, expandIpRange, isValidIp } = require('../discovery/networkScanner');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores (replace with DB queries in production)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, object>} scanId → scan record */
const scans = new Map();

/** @type {Map<string, object>} discoveredId → discovered device */
const discoveredDevices = new Map();

/** @type {Map<string, object>} configId → scan config */
const scanConfigs = new Map();

/** @type {Map<string, object>} jobId → registration job */
const registrationJobs = new Map();

/** @type {Set<string>} scan IDs that are currently running */
const activeScans = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate ports array. Each element must be 1-65535.
 * @param {any[]} ports
 * @returns {number[]}
 */
function validatePorts(ports) {
    if (!Array.isArray(ports) || ports.length === 0) {
        return [27015, 27016, 10110, 80, 8080, 1883];
    }
    return ports.map((p) => {
        const n = parseInt(p, 10);
        if (isNaN(n) || n < 1 || n > 65535) {
            throw new Error(`Invalid port: ${p}`);
        }
        return n;
    });
}

/**
 * Validate protocol types array.
 * @param {any[]} protocols
 * @returns {string[]}
 */
function validateProtocols(protocols) {
    const allowed = ['teltonika', 'nmea', 'http', 'mqtt'];
    if (!Array.isArray(protocols) || protocols.length === 0) {
        return allowed;
    }
    return protocols.map((p) => {
        if (!allowed.includes(p)) {
            throw new Error(`Unknown protocol: ${p}. Allowed: ${allowed.join(', ')}`);
        }
        return p;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/discovery/scan  – Start a manual scan
// ─────────────────────────────────────────────────────────────────────────────

router.post('/scan', (req, res) => {
    const { ipRange, ports, timeoutMs, protocols, concurrency } = req.body || {};

    if (!ipRange) {
        return res.status(400).json({ error: 'ipRange is required' });
    }

    // Validate / expand the range first so we fail fast before allocating
    let expandedIps;
    try {
        expandedIps = expandIpRange(ipRange);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    let validPorts, validProtocols;
    try {
        validPorts = validatePorts(ports);
        validProtocols = validateProtocols(protocols);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const scanId = uuidv4();
    const scan = {
        scanId,
        scanType: 'manual',
        ipRange,
        ports: validPorts,
        protocols: validProtocols,
        startTime: new Date().toISOString(),
        endTime: null,
        devicesFound: 0,
        devicesRegistered: 0,
        status: 'running',
        totalIps: expandedIps.length,
        scannedIps: 0,
        createdBy: (req.user && req.user.userId) || null,
    };
    scans.set(scanId, scan);
    activeScans.add(scanId);

    // Launch scan in background
    const emitter = scanNetwork({
        ipRange,
        ports: validPorts,
        protocols: validProtocols,
        timeoutMs: timeoutMs || 3000,
        concurrency: concurrency || 50,
    });

    emitter.on('progress', ({ scanned, total, found }) => {
        const s = scans.get(scanId);
        if (s) {
            s.scannedIps = scanned;
            s.totalIps = total;
            s.devicesFound = found;
        }
    });

    emitter.on('device', (device) => {
        const discoveredId = uuidv4();
        discoveredDevices.set(discoveredId, {
            discoveredId,
            scanId,
            ipAddress: device.ip,
            port: device.port,
            protocol: device.protocol || 'unknown',
            manufacturer: device.manufacturer || null,
            deviceModel: device.deviceModel || null,
            firmwareVersion: device.firmwareVersion || null,
            imei: device.imei || null,
            deviceName: device.deviceName || `Device-${device.ip.replace(/\./g, '-')}-${device.port}`,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            status: 'new',
            registeredDeviceId: null,
            responseData: device.responseData || null,
            createdAt: new Date().toISOString(),
        });
        const s = scans.get(scanId);
        if (s) s.devicesFound++;
    });

    emitter.on('done', ({ devices }) => {
        const s = scans.get(scanId);
        if (s) {
            s.status = 'completed';
            s.endTime = new Date().toISOString();
            s.devicesFound = devices.length;
        }
        activeScans.delete(scanId);
    });

    emitter.on('error', (err) => {
        const s = scans.get(scanId);
        if (s) {
            s.status = 'failed';
            s.endTime = new Date().toISOString();
            s.errorMessage = err.message;
        }
        activeScans.delete(scanId);
    });

    return res.status(202).json({ scanId, status: 'running', totalIps: expandedIps.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/discovery/scans  – List scan history
// ─────────────────────────────────────────────────────────────────────────────

router.get('/scans', (_req, res) => {
    const list = Array.from(scans.values()).sort(
        (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );
    res.json(list);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/discovery/results/:id  – Get results for a specific scan
// ─────────────────────────────────────────────────────────────────────────────

router.get('/results/:id', (req, res) => {
    const scan = scans.get(req.params.id);
    if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
    }

    const devices = Array.from(discoveredDevices.values()).filter(
        (d) => d.scanId === req.params.id
    );

    return res.json({ scan, devices });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/discovery/discovered  – List all discovered devices
// ─────────────────────────────────────────────────────────────────────────────

router.get('/discovered', (req, res) => {
    const { status, protocol, search } = req.query;

    let list = Array.from(discoveredDevices.values());

    if (status) {
        list = list.filter((d) => d.status === status);
    }
    if (protocol) {
        list = list.filter((d) => d.protocol === protocol);
    }
    if (search) {
        const q = search.toLowerCase();
        list = list.filter(
            (d) =>
                d.ipAddress.includes(q) ||
                (d.deviceName && d.deviceName.toLowerCase().includes(q)) ||
                (d.manufacturer && d.manufacturer.toLowerCase().includes(q)) ||
                (d.imei && d.imei.includes(q))
        );
    }

    list.sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
    res.json(list);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/discovery/register  – Register one or more discovered devices
// ─────────────────────────────────────────────────────────────────────────────

router.post('/register', (req, res) => {
    const { discoveredIds, groupId } = req.body || {};

    if (!Array.isArray(discoveredIds) || discoveredIds.length === 0) {
        return res.status(400).json({ error: 'discoveredIds array is required' });
    }

    const jobs = [];
    const errors = [];

    for (const discoveredId of discoveredIds) {
        const device = discoveredDevices.get(discoveredId);
        if (!device) {
            errors.push({ discoveredId, error: 'Discovered device not found' });
            continue;
        }
        if (device.status === 'registered') {
            errors.push({ discoveredId, error: 'Device is already registered' });
            continue;
        }

        const jobId = uuidv4();
        const deviceId = Math.floor(Math.random() * 90000) + 10000; // simulated device_id

        const job = {
            jobId,
            discoveredDeviceId: discoveredId,
            userId: (req.user && req.user.userId) || null,
            status: 'registered',
            deviceId,
            groupId: groupId || null,
            errorMessage: null,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
        };

        registrationJobs.set(jobId, job);

        // Mark the discovered device as registered
        device.status = 'registered';
        device.registeredDeviceId = deviceId;

        jobs.push(job);
    }

    return res.status(errors.length > 0 && jobs.length === 0 ? 400 : 201).json({
        registered: jobs,
        errors,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scan Config CRUD
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/discovery/config
router.post('/config', (req, res) => {
    const { name, ipRanges, ports, protocolTypes, enabled, scanSchedule, autoRegister, defaultGroupId, alertThresholdConfig } = req.body || {};

    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }

    let validPorts, validProtocols;
    try {
        validPorts = validatePorts(ports);
        validProtocols = validateProtocols(protocolTypes);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const configId = uuidv4();
    const config = {
        configId,
        userId: (req.user && req.user.userId) || null,
        name,
        ipRanges: Array.isArray(ipRanges) ? ipRanges : [],
        ports: validPorts,
        protocolTypes: validProtocols,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
        scanSchedule: scanSchedule || null,
        autoRegister: autoRegister !== undefined ? Boolean(autoRegister) : false,
        defaultGroupId: defaultGroupId || null,
        alertThresholdConfig: alertThresholdConfig || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    scanConfigs.set(configId, config);
    res.status(201).json(config);
});

// GET /api/discovery/config
router.get('/config', (_req, res) => {
    res.json(Array.from(scanConfigs.values()));
});

// PUT /api/discovery/config/:id
router.put('/config/:id', (req, res) => {
    const config = scanConfigs.get(req.params.id);
    if (!config) {
        return res.status(404).json({ error: 'Config not found' });
    }

    const { name, ipRanges, ports, protocolTypes, enabled, scanSchedule, autoRegister, defaultGroupId, alertThresholdConfig } = req.body || {};

    let validPorts = config.ports;
    let validProtocols = config.protocolTypes;
    try {
        if (ports !== undefined) validPorts = validatePorts(ports);
        if (protocolTypes !== undefined) validProtocols = validateProtocols(protocolTypes);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const updated = {
        ...config,
        name: name || config.name,
        ipRanges: Array.isArray(ipRanges) ? ipRanges : config.ipRanges,
        ports: validPorts,
        protocolTypes: validProtocols,
        enabled: enabled !== undefined ? Boolean(enabled) : config.enabled,
        scanSchedule: scanSchedule !== undefined ? scanSchedule : config.scanSchedule,
        autoRegister: autoRegister !== undefined ? Boolean(autoRegister) : config.autoRegister,
        defaultGroupId: defaultGroupId !== undefined ? defaultGroupId : config.defaultGroupId,
        alertThresholdConfig: alertThresholdConfig !== undefined ? alertThresholdConfig : config.alertThresholdConfig,
        updatedAt: new Date().toISOString(),
    };

    scanConfigs.set(req.params.id, updated);
    res.json(updated);
});

// DELETE /api/discovery/config/:id
router.delete('/config/:id', (req, res) => {
    if (!scanConfigs.has(req.params.id)) {
        return res.status(404).json({ error: 'Config not found' });
    }
    scanConfigs.delete(req.params.id);
    res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/discovery/schedule  – Enable / disable a config's auto-scan
// ─────────────────────────────────────────────────────────────────────────────

router.post('/schedule', (req, res) => {
    const { configId, enabled } = req.body || {};

    if (!configId) {
        return res.status(400).json({ error: 'configId is required' });
    }

    const config = scanConfigs.get(configId);
    if (!config) {
        return res.status(404).json({ error: 'Config not found' });
    }

    config.enabled = Boolean(enabled);
    config.updatedAt = new Date().toISOString();

    res.json({ configId, enabled: config.enabled });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/discovery/status  – Current scanner status
// ─────────────────────────────────────────────────────────────────────────────

router.get('/status', (_req, res) => {
    const running = Array.from(activeScans).map((id) => scans.get(id)).filter(Boolean);
    const recentCompleted = Array.from(scans.values())
        .filter((s) => s.status === 'completed' || s.status === 'failed')
        .sort((a, b) => new Date(b.endTime || b.startTime) - new Date(a.endTime || a.startTime))
        .slice(0, 5);

    res.json({
        activeScans: running.length,
        totalScans: scans.size,
        totalDiscovered: discoveredDevices.size,
        totalRegistered: Array.from(discoveredDevices.values()).filter((d) => d.status === 'registered').length,
        running,
        recentCompleted,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/discovery/test  – Test a single IP:port connection
// ─────────────────────────────────────────────────────────────────────────────

router.post('/test', async (req, res) => {
    const { ip, port, timeoutMs, protocols } = req.body || {};

    if (!ip) {
        return res.status(400).json({ error: 'ip is required' });
    }
    if (!isValidIp(ip)) {
        return res.status(400).json({ error: `Invalid IP address: ${ip}` });
    }

    const portNum = parseInt(port, 10);
    if (!port || isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return res.status(400).json({ error: 'A valid port (1-65535) is required' });
    }

    let validProtocols;
    try {
        validProtocols = validateProtocols(protocols);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    try {
        const result = await testConnection(ip, portNum, {
            timeoutMs: timeoutMs || 5000,
            protocols: validProtocols,
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
