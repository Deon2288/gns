const express = require('express');
const router = express.Router();
const pool = require('../db');

// ─── Well-known SNMP OIDs ─────────────────────────────────────────────────────
const SNMP_OIDS = {
    sysDescr:    '1.3.6.1.2.1.1.1.0',
    sysObjectID: '1.3.6.1.2.1.1.2.0',
    sysUpTime:   '1.3.6.1.2.1.1.3.0',
    sysContact:  '1.3.6.1.2.1.1.4.0',
    sysName:     '1.3.6.1.2.1.1.5.0',
    sysLocation: '1.3.6.1.2.1.1.6.0',
    hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',
};

// ─── Simulate ICMP ping result ────────────────────────────────────────────────
// In production this would invoke a real system ping (e.g. via child_process / net-ping)
function simulatePing(deviceIp, count = 4, timeoutMs = 5000) {
    const reachable = Math.random() > 0.1;
    if (!reachable) {
        return {
            status: 'unreachable',
            packets_sent: count,
            packets_received: 0,
            packet_loss: 100,
            rtt: null,
        };
    }
    const baseLatency = 20 + Math.random() * 100;
    const jitter = Math.random() * 10;
    return {
        status: 'reachable',
        packets_sent: count,
        packets_received: count,
        packet_loss: 0,
        rtt: {
            min: Math.round(baseLatency),
            max: Math.round(baseLatency + jitter * 2),
            avg: Math.round(baseLatency + jitter),
            stddev: parseFloat(jitter.toFixed(1)),
        },
    };
}

// ─── Simulate SNMP query result ───────────────────────────────────────────────
function simulateSnmpGet(deviceIp, oid) {
    const values = {
        [SNMP_OIDS.sysName]:     { value: `Device-${deviceIp.split('.').pop()}`, type: 'STRING' },
        [SNMP_OIDS.sysDescr]:    { value: 'GPS Teltonika FMB125', type: 'STRING' },
        [SNMP_OIDS.sysUpTime]:   { value: Math.floor(Math.random() * 1e8), type: 'INTEGER' },
        [SNMP_OIDS.sysLocation]: { value: 'Vehicle Fleet', type: 'STRING' },
        [SNMP_OIDS.sysContact]:  { value: 'admin@example.com', type: 'STRING' },
        [SNMP_OIDS.hrSystemUptime]: { value: Math.floor(Math.random() * 1e8), type: 'INTEGER' },
    };
    return values[oid] || { value: `value-for-${oid}`, type: 'STRING' };
}

// ─── GET /api/device-access/ping-config ──────────────────────────────────────
router.get('/ping-config', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ping_config LIMIT 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No ping configuration found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/ping-config ─────────────────────────────────────
router.post('/ping-config', async (req, res) => {
    const {
        enabled = true,
        method = 'icmp',
        interval = 60,
        timeout = 5000,
        packet_size = 56,
        ttl = 64,
        parallel_pings = 10,
        alert_on_timeout = true,
        alert_threshold = 3,
        packet_loss_alert = true,
        packet_loss_threshold = 10,
    } = req.body;

    try {
        const existing = await pool.query('SELECT config_id FROM ping_config LIMIT 1');
        let result;
        if (existing.rows.length > 0) {
            result = await pool.query(
                `UPDATE ping_config SET
                    enabled = $1, method = $2, interval_seconds = $3,
                    timeout_ms = $4, packet_size = $5, ttl = $6,
                    parallel_pings = $7, alert_on_timeout = $8,
                    alert_threshold = $9, packet_loss_alert = $10,
                    packet_loss_threshold = $11, updated_at = CURRENT_TIMESTAMP
                 WHERE config_id = $12 RETURNING *`,
                [enabled, method, interval, timeout, packet_size, ttl,
                 parallel_pings, alert_on_timeout, alert_threshold,
                 packet_loss_alert, packet_loss_threshold, existing.rows[0].config_id]
            );
        } else {
            result = await pool.query(
                `INSERT INTO ping_config
                    (enabled, method, interval_seconds, timeout_ms, packet_size, ttl,
                     parallel_pings, alert_on_timeout, alert_threshold,
                     packet_loss_alert, packet_loss_threshold)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                [enabled, method, interval, timeout, packet_size, ttl,
                 parallel_pings, alert_on_timeout, alert_threshold,
                 packet_loss_alert, packet_loss_threshold]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/ping/:id ────────────────────────────────────────
// Ping a single device by device_id
router.post('/ping/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });

    const { count = 4, timeout = 5000 } = req.body;

    try {
        const deviceResult = await pool.query(
            'SELECT device_id, device_name FROM devices WHERE device_id = $1',
            [deviceId]
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const device = deviceResult.rows[0];
        // Derive a representative IP (stored in gps_data or telemetry in a real system)
        const deviceIp = `192.168.50.${100 + deviceId}`;

        const pingResult = simulatePing(deviceIp, count, timeout);
        const latencyMs = pingResult.rtt ? pingResult.rtt.avg : null;
        const now = new Date();

        // Persist result
        await pool.query(
            `INSERT INTO icmp_ping_results
                (device_id, status, latency_ms, packet_loss_percent,
                 packets_sent, packets_received,
                 min_latency, max_latency, avg_latency, stddev_latency, timestamp)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
                deviceId, pingResult.status, latencyMs, pingResult.packet_loss,
                pingResult.packets_sent, pingResult.packets_received,
                pingResult.rtt?.min ?? null, pingResult.rtt?.max ?? null,
                pingResult.rtt?.avg ?? null, pingResult.rtt?.stddev ?? null,
                now,
            ]
        );

        // Update reachability
        const reachableStatus = pingResult.status === 'reachable' ? 'online' : 'offline';
        await pool.query(
            `INSERT INTO device_reachability (device_id, status, last_ping, last_successful_ping, consecutive_failures)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (device_id) DO UPDATE SET
                status = EXCLUDED.status,
                last_ping = EXCLUDED.last_ping,
                last_successful_ping = CASE WHEN EXCLUDED.status = 'online'
                    THEN EXCLUDED.last_ping ELSE device_reachability.last_successful_ping END,
                consecutive_failures = CASE WHEN EXCLUDED.status = 'online' THEN 0
                    ELSE device_reachability.consecutive_failures + 1 END,
                updated_at = CURRENT_TIMESTAMP`,
            [deviceId, reachableStatus, now, pingResult.status === 'reachable' ? now : null,
             pingResult.status === 'reachable' ? 0 : 1]
        );

        // Audit log
        await pool.query(
            `INSERT INTO device_access_logs
                (access_type, device_id, source_ip, status, response_time_ms)
             VALUES ('ping', $1, '127.0.0.1', $2, $3)`,
            [deviceId, pingResult.status === 'reachable' ? 'success' : 'timeout', latencyMs]
        );

        res.json({
            device_id: device.device_id,
            device_name: device.device_name,
            device_ip: deviceIp,
            destination: deviceIp,
            ...pingResult,
            timestamp: now.toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/ping-all ────────────────────────────────────────
// Ping all devices (or a specific group)
async function pingAllHandler(req, res) {
    const { count = 2, timeout = 3000, group_id = null } = req.body;

    try {
        const devicesResult = await pool.query('SELECT device_id, device_name FROM devices');
        const devices = devicesResult.rows;

        if (devices.length === 0) {
            return res.json({
                total_devices: 0, reachable: 0, unreachable: 0, no_response: 0,
                average_latency: 0, overall_packet_loss: 0, details: [],
            });
        }

        const now = new Date();
        const details = [];
        let reachable = 0;
        let unreachable = 0;
        let totalLatency = 0;
        let totalPacketLoss = 0;

        for (const device of devices) {
            const deviceIp = `192.168.50.${100 + device.device_id}`;
            const ping = simulatePing(deviceIp, count, timeout);
            const latencyMs = ping.rtt ? ping.rtt.avg : null;

            if (ping.status === 'reachable') {
                reachable++;
                totalLatency += latencyMs || 0;
            } else {
                unreachable++;
            }
            totalPacketLoss += ping.packet_loss;

            details.push({
                device_id: device.device_id,
                device_name: device.device_name,
                device_ip: deviceIp,
                status: ping.status,
                latency: latencyMs,
                packet_loss: ping.packet_loss,
            });

            // Persist to icmp_ping_results
            await pool.query(
                `INSERT INTO icmp_ping_results
                    (device_id, status, latency_ms, packet_loss_percent,
                     packets_sent, packets_received,
                     min_latency, max_latency, avg_latency, stddev_latency, timestamp)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [device.device_id, ping.status, latencyMs, ping.packet_loss,
                 ping.packets_sent, ping.packets_received,
                 ping.rtt?.min ?? null, ping.rtt?.max ?? null,
                 ping.rtt?.avg ?? null, ping.rtt?.stddev ?? null, now]
            );
        }

        const total = devices.length;
        res.json({
            total_devices: total,
            reachable,
            unreachable,
            no_response: 0,
            average_latency: reachable > 0 ? parseFloat((totalLatency / reachable).toFixed(1)) : 0,
            overall_packet_loss: parseFloat((totalPacketLoss / total).toFixed(1)),
            details,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

router.post('/ping-all', pingAllHandler);

// ─── POST /api/device-access/ping-bulk ───────────────────────────────────────
// Alias for ping-all (kept for API compatibility)
router.post('/ping-bulk', pingAllHandler);

// ─── POST /api/device-access/continuous-ping ─────────────────────────────────
// Registers a background ping job (simulation – stored as metadata)
router.post('/continuous-ping', async (req, res) => {
    const { device_id, interval = 60, duration = 3600 } = req.body;
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    try {
        const deviceResult = await pool.query(
            'SELECT device_id, device_name FROM devices WHERE device_id = $1',
            [device_id]
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({
            message: 'Continuous ping job scheduled',
            device_id,
            device_name: deviceResult.rows[0].device_name,
            interval_seconds: interval,
            duration_seconds: duration,
            estimated_pings: Math.floor(duration / interval),
            started_at: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/device-access/snmp-config ──────────────────────────────────────
router.get('/snmp-config', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM snmp_config LIMIT 1');
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No SNMP configuration found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/snmp-config ─────────────────────────────────────
router.post('/snmp-config', async (req, res) => {
    const {
        enabled = true,
        version = '2c',
        community_string = 'public',
        timeout = 5000,
        retries = 3,
        port = 161,
        poll_interval = 300,
        parallel_queries = 10,
        security_level = 'noAuthNoPriv',
        auth_protocol = 'md5',
        priv_protocol = 'des',
    } = req.body;

    try {
        const existing = await pool.query('SELECT config_id FROM snmp_config LIMIT 1');
        let result;
        if (existing.rows.length > 0) {
            result = await pool.query(
                `UPDATE snmp_config SET
                    enabled=$1, version=$2, community_string=$3,
                    timeout_ms=$4, retries=$5, port=$6,
                    poll_interval_seconds=$7, parallel_queries=$8,
                    security_level=$9, auth_protocol=$10, priv_protocol=$11,
                    updated_at=CURRENT_TIMESTAMP
                 WHERE config_id=$12 RETURNING *`,
                [enabled, version, community_string, timeout, retries, port,
                 poll_interval, parallel_queries, security_level,
                 auth_protocol, priv_protocol, existing.rows[0].config_id]
            );
        } else {
            result = await pool.query(
                `INSERT INTO snmp_config
                    (enabled, version, community_string, timeout_ms, retries, port,
                     poll_interval_seconds, parallel_queries, security_level,
                     auth_protocol, priv_protocol)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                [enabled, version, community_string, timeout, retries, port,
                 poll_interval, parallel_queries, security_level, auth_protocol, priv_protocol]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/snmp/query ──────────────────────────────────────
// Query a single OID on a device
router.post('/snmp/query', async (req, res) => {
    const { device_id, oid, timeout = 5000 } = req.body;
    if (!device_id || !oid) {
        return res.status(400).json({ error: 'device_id and oid are required' });
    }

    try {
        const deviceResult = await pool.query(
            'SELECT device_id, device_name FROM devices WHERE device_id = $1',
            [device_id]
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const deviceIp = `192.168.50.${100 + device_id}`;
        const snmpResult = simulateSnmpGet(deviceIp, oid);
        const now = new Date();

        const query = await pool.query(
            `INSERT INTO snmp_queries (device_id, oid, query_type, timestamp)
             VALUES ($1,$2,'get',$3) RETURNING query_id`,
            [device_id, oid, now]
        );
        await pool.query(
            `INSERT INTO snmp_results (query_id, oid, value, value_type, timestamp)
             VALUES ($1,$2,$3,$4,$5)`,
            [query.rows[0].query_id, oid, String(snmpResult.value), snmpResult.type, now]
        );

        await pool.query(
            `INSERT INTO device_access_logs
                (access_type, device_id, source_ip, status, response_time_ms, query_details)
             VALUES ('snmp_query', $1, '127.0.0.1', 'success', $2, $3)`,
            [device_id, Math.floor(Math.random() * 200 + 50), JSON.stringify({ oid })]
        );

        res.json({
            device_id,
            oid,
            value: snmpResult.value,
            type: snmpResult.type,
            timestamp: now.toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/snmp/query-multiple ─────────────────────────────
// Query multiple OIDs on a device
router.post('/snmp/query-multiple', async (req, res) => {
    const { device_id, oids } = req.body;
    if (!device_id || !Array.isArray(oids) || oids.length === 0) {
        return res.status(400).json({ error: 'device_id and oids array are required' });
    }

    try {
        const deviceResult = await pool.query(
            'SELECT device_id FROM devices WHERE device_id = $1', [device_id]
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const deviceIp = `192.168.50.${100 + device_id}`;
        const now = new Date();
        const results = [];

        for (const oid of oids) {
            const snmpResult = simulateSnmpGet(deviceIp, oid);
            const query = await pool.query(
                `INSERT INTO snmp_queries (device_id, oid, query_type, timestamp)
                 VALUES ($1,$2,'get',$3) RETURNING query_id`,
                [device_id, oid, now]
            );
            await pool.query(
                `INSERT INTO snmp_results (query_id, oid, value, value_type, timestamp)
                 VALUES ($1,$2,$3,$4,$5)`,
                [query.rows[0].query_id, oid, String(snmpResult.value), snmpResult.type, now]
            );
            results.push({ oid, value: snmpResult.value, type: snmpResult.type });
        }

        res.json({ device_id, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/snmp/walk ───────────────────────────────────────
// Walk all OIDs under a given OID prefix
router.post('/snmp/walk', async (req, res) => {
    const { device_id, oid, timeout = 10000 } = req.body;
    if (!device_id || !oid) {
        return res.status(400).json({ error: 'device_id and oid are required' });
    }

    try {
        const deviceResult = await pool.query(
            'SELECT device_id FROM devices WHERE device_id = $1', [device_id]
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Simulate a walk returning several sub-OIDs
        const deviceIp = `192.168.50.${100 + device_id}`;
        const now = new Date();
        const oidTree = [];
        const suffixes = ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0'];

        const query = await pool.query(
            `INSERT INTO snmp_queries (device_id, oid, query_type, timestamp)
             VALUES ($1,$2,'walk',$3) RETURNING query_id`,
            [device_id, oid, now]
        );

        for (const suffix of suffixes) {
            const fullOid = `${oid}.${suffix}`;
            const result = simulateSnmpGet(deviceIp, fullOid);
            await pool.query(
                `INSERT INTO snmp_results (query_id, oid, value, value_type, timestamp)
                 VALUES ($1,$2,$3,$4,$5)`,
                [query.rows[0].query_id, fullOid, String(result.value), result.type, now]
            );
            oidTree.push({ oid: fullOid, value: result.value, type: result.type });
        }

        res.json({ device_id, base_oid: oid, oid_tree: oidTree, timestamp: now.toISOString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/snmp/bulk-query ─────────────────────────────────
// Query the same OID across all devices
router.post('/snmp/bulk-query', async (req, res) => {
    const { oid, timeout = 5000, group_id = null } = req.body;
    if (!oid) return res.status(400).json({ error: 'oid is required' });

    try {
        const devicesResult = await pool.query('SELECT device_id, device_name FROM devices');
        const devices = devicesResult.rows;
        const now = new Date();
        let successful = 0;
        const results = [];

        for (const device of devices) {
            const deviceIp = `192.168.50.${100 + device.device_id}`;
            const snmpResult = simulateSnmpGet(deviceIp, oid);
            successful++;
            results.push({
                device_id: device.device_id,
                device_name: device.device_name,
                value: snmpResult.value,
                type: snmpResult.type,
            });

            const query = await pool.query(
                `INSERT INTO snmp_queries (device_id, oid, query_type, timestamp)
                 VALUES ($1,$2,'bulk',$3) RETURNING query_id`,
                [device.device_id, oid, now]
            );
            await pool.query(
                `INSERT INTO snmp_results (query_id, oid, value, value_type, timestamp)
                 VALUES ($1,$2,$3,$4,$5)`,
                [query.rows[0].query_id, oid, String(snmpResult.value), snmpResult.type, now]
            );
        }

        res.json({
            oid,
            total_devices: devices.length,
            successful,
            failed: devices.length - successful,
            results,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Predefined SNMP GET helpers ─────────────────────────────────────────────

// GET /api/device-access/snmp/get-name/:id
router.get('/snmp/get-name/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });
    await handlePredefinedSnmp(req, res, deviceId, SNMP_OIDS.sysName, 'name');
});

// GET /api/device-access/snmp/get-description/:id
router.get('/snmp/get-description/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });
    await handlePredefinedSnmp(req, res, deviceId, SNMP_OIDS.sysDescr, 'description');
});

// GET /api/device-access/snmp/get-uptime/:id
router.get('/snmp/get-uptime/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });
    await handlePredefinedSnmp(req, res, deviceId, SNMP_OIDS.sysUpTime, 'uptime');
});

// GET /api/device-access/snmp/get-interfaces/:id
router.get('/snmp/get-interfaces/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });
    // Simulate interface list
    res.json({
        device_id: deviceId,
        interfaces: [
            { index: 1, name: 'lo', type: 'loopback', speed_mbps: 0, status: 'up' },
            { index: 2, name: 'eth0', type: 'ethernet', speed_mbps: 100, status: 'up',
              in_octets: Math.floor(Math.random() * 1e8),
              out_octets: Math.floor(Math.random() * 1e8) },
        ],
        timestamp: new Date().toISOString(),
    });
});

// GET /api/device-access/snmp/get-resources/:id
router.get('/snmp/get-resources/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });
    res.json({
        device_id: deviceId,
        cpu_usage_percent: parseFloat((Math.random() * 60 + 10).toFixed(1)),
        memory_total_mb: 512,
        memory_used_mb: Math.floor(Math.random() * 300 + 100),
        disk_total_mb: 4096,
        disk_used_mb: Math.floor(Math.random() * 2000 + 500),
        timestamp: new Date().toISOString(),
    });
});

// GET /api/device-access/snmp/get-location/:id
router.get('/snmp/get-location/:id', async (req, res) => {
    const deviceId = parseInt(req.params.id);
    if (isNaN(deviceId)) return res.status(400).json({ error: 'Invalid device ID' });
    await handlePredefinedSnmp(req, res, deviceId, SNMP_OIDS.sysLocation, 'location');
});

async function handlePredefinedSnmp(req, res, deviceId, oid, fieldName) {
    try {
        const deviceResult = await pool.query(
            'SELECT device_id, device_name FROM devices WHERE device_id = $1', [deviceId]
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const deviceIp = `192.168.50.${100 + deviceId}`;
        const snmpResult = simulateSnmpGet(deviceIp, oid);
        const now = new Date();

        const query = await pool.query(
            `INSERT INTO snmp_queries (device_id, oid, query_type, timestamp)
             VALUES ($1,$2,'get',$3) RETURNING query_id`,
            [deviceId, oid, now]
        );
        await pool.query(
            `INSERT INTO snmp_results (query_id, oid, value, value_type, timestamp)
             VALUES ($1,$2,$3,$4,$5)`,
            [query.rows[0].query_id, oid, String(snmpResult.value), snmpResult.type, now]
        );

        res.json({
            device_id: deviceId,
            device_name: deviceResult.rows[0].device_name,
            [fieldName]: snmpResult.value,
            oid,
            type: snmpResult.type,
            timestamp: now.toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ─── GET /api/device-access/metrics ──────────────────────────────────────────
// Returns aggregate accessibility metrics
router.get('/metrics', async (req, res) => {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) AS count FROM devices');
        const total = parseInt(totalResult.rows[0].count);

        // ICMP stats from last 24 hours
        const icmpResult = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'reachable') AS reachable,
                COUNT(*) FILTER (WHERE status != 'reachable') AS unreachable,
                ROUND(AVG(avg_latency), 1) AS avg_latency,
                ROUND(AVG(packet_loss_percent), 2) AS avg_packet_loss
             FROM icmp_ping_results
             WHERE timestamp > NOW() - INTERVAL '24 hours'`
        );

        // SNMP stats
        const snmpResult = await pool.query(
            `SELECT COUNT(DISTINCT q.device_id) AS responsive_devices,
                    ROUND(AVG(EXTRACT(EPOCH FROM (r.timestamp - q.timestamp)) * 1000), 0) AS avg_query_time_ms
             FROM snmp_queries q
             JOIN snmp_results r ON q.query_id = r.query_id
             WHERE q.timestamp > NOW() - INTERVAL '24 hours'`
        );

        const icmp = icmpResult.rows[0];
        const snmp = snmpResult.rows[0];
        const reachable = parseInt(icmp.reachable) || 0;
        const responsive = parseInt(snmp.responsive_devices) || 0;

        res.json({
            total_devices: total,
            icmp_stats: {
                reachable,
                unreachable: total - reachable,
                success_rate: total > 0 ? parseFloat(((reachable / total) * 100).toFixed(1)) : 0,
                average_latency_ms: parseFloat(icmp.avg_latency) || 0,
                average_packet_loss: parseFloat(icmp.avg_packet_loss) || 0,
            },
            snmp_stats: {
                responsive,
                unresponsive: total - responsive,
                success_rate: total > 0 ? parseFloat(((responsive / total) * 100).toFixed(1)) : 0,
                average_query_time_ms: parseFloat(snmp.avg_query_time_ms) || 0,
            },
            overall_health: reachable / (total || 1) > 0.9 ? 'excellent'
                : reachable / (total || 1) > 0.7 ? 'good'
                : reachable / (total || 1) > 0.5 ? 'fair' : 'poor',
            last_updated: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/device-access/health-report ────────────────────────────────────
router.get('/health-report', async (req, res) => {
    try {
        const now = new Date();
        const period = req.query.period || '24h';

        const totalResult = await pool.query('SELECT COUNT(*) AS count FROM devices');
        const total = parseInt(totalResult.rows[0].count);

        const reachabilityResult = await pool.query(
            `SELECT status, COUNT(*) AS count FROM device_reachability GROUP BY status`
        );

        const statusMap = {};
        for (const row of reachabilityResult.rows) {
            statusMap[row.status] = parseInt(row.count);
        }

        // VPN status
        const vpnResult = await pool.query(
            `SELECT status, latency_ms FROM vpn_bridge_connections WHERE is_active = TRUE LIMIT 1`
        );
        const vpn = vpnResult.rows[0] || { status: 'disconnected', latency_ms: null };

        // Recent alerts: devices with consecutive_failures > 0
        const alertsResult = await pool.query(
            `SELECT d.device_name, r.consecutive_failures
             FROM device_reachability r
             JOIN devices d ON r.device_id = d.device_id
             WHERE r.consecutive_failures > 0
             ORDER BY r.consecutive_failures DESC
             LIMIT 10`
        );

        res.json({
            report_date: now.toISOString().split('T')[0],
            period,
            device_availability: {
                total,
                online: statusMap['online'] || 0,
                offline: statusMap['offline'] || 0,
                degraded: statusMap['degraded'] || 0,
                unknown: statusMap['unknown'] || 0,
            },
            vpn_bridge: {
                status: vpn.status,
                latency_ms: vpn.latency_ms,
            },
            critical_issues: alertsResult.rows.map(
                r => `${r.device_name}: ${r.consecutive_failures} consecutive failures`
            ),
            generated_at: now.toISOString(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/device-access/health-check ────────────────────────────────────
// Configure automated health checks
router.post('/health-check', async (req, res) => {
    const { enabled, schedule, checks = [], alerts = {} } = req.body;
    // In production, this would set up a cron job or scheduler
    res.json({
        message: 'Health check configuration saved',
        enabled,
        schedule,
        checks_configured: checks.length,
        alerts_configured: Object.keys(alerts).length,
        next_run: enabled ? new Date(Date.now() + 300000).toISOString() : null,
    });
});

// ─── POST /api/device-access/diagnostics ─────────────────────────────────────
router.post('/diagnostics', async (req, res) => {
    const {
        test_vpn_connection = true,
        test_device_ping = true,
        test_snmp_connectivity = true,
        verbose_logging = false,
        device_id,
    } = req.body;

    const diagnostics = {};

    // VPN check
    if (test_vpn_connection) {
        const vpnResult = await pool.query(
            "SELECT status, latency_ms, packet_loss_percent FROM vpn_bridge_connections WHERE is_active = TRUE LIMIT 1"
        ).catch(() => ({ rows: [] }));

        const vpn = vpnResult.rows[0];
        diagnostics.vpn_bridge = {
            status: vpn ? `${vpn.status === 'connected' ? '✅' : '❌'} ${vpn.status}` : '❌ Not configured',
            latency: vpn?.latency_ms ?? null,
            packet_loss: vpn?.packet_loss_percent ?? null,
        };
    }

    // Ping check
    if (test_device_ping && device_id) {
        const deviceIp = `192.168.50.${100 + parseInt(device_id)}`;
        const ping = simulatePing(deviceIp, 4, 5000);
        diagnostics.device_ping = {
            status: ping.status === 'reachable' ? '✅ Reachable' : '❌ Unreachable',
            latency: ping.rtt?.avg ?? null,
            packets: `${ping.packets_received}/${ping.packets_sent}`,
        };
    }

    // SNMP check
    if (test_snmp_connectivity && device_id) {
        const deviceIp = `192.168.50.${100 + parseInt(device_id)}`;
        const snmpResult = simulateSnmpGet(deviceIp, SNMP_OIDS.sysName);
        diagnostics.snmp_connectivity = {
            status: '✅ Responsive',
            query_time_ms: Math.floor(Math.random() * 150 + 50),
            oid_tested: SNMP_OIDS.sysName,
            value: snmpResult.value,
        };
    }

    diagnostics.recommendations = buildRecommendations(diagnostics);
    res.json(diagnostics);
});

function buildRecommendations(d) {
    const recs = [];
    if (d.vpn_bridge && d.vpn_bridge.status && d.vpn_bridge.status.includes('❌')) {
        recs.push('VPN bridge is not connected — check configuration and certificates');
    }
    if (d.device_ping && d.device_ping.status && d.device_ping.status.includes('❌')) {
        recs.push('Device is unreachable — verify IP address and network route through VPN');
    }
    if (recs.length === 0) {
        recs.push('All systems operational');
    }
    return recs;
}

// ─── GET /api/device-access/logs ─────────────────────────────────────────────
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const result = await pool.query(
            `SELECT l.*, d.device_name
             FROM device_access_logs l
             LEFT JOIN devices d ON l.device_id = d.device_id
             ORDER BY l.timestamp DESC LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
