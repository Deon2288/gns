const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');

// In-memory scan store (fallback if DB unavailable)
const scanStore = new Map();

function detectDeviceType(sysDescr, hostname) {
  const desc = (sysDescr + ' ' + hostname).toLowerCase();
  if (desc.includes('rutx') || desc.includes('teltonika') || desc.includes('rut')) return 'teltonika';
  if (desc.includes('mikrotik') || desc.includes('routeros')) return 'mikrotik';
  if (desc.includes('cisco')) return 'cisco';
  if (desc.includes('linux')) return 'linux';
  return 'unknown';
}

function cidrHostCount(ipRange) {
  const match = ipRange.match(/\/(\d+)$/);
  if (!match) return 1;
  const prefix = parseInt(match[1]);
  return Math.max(1, Math.pow(2, 32 - prefix) - 2);
}

function parseNmapOutput(output) {
  const devices = [];
  const lines = output.split('\n');
  let currentDevice = null;

  for (const line of lines) {
    const reportMatch = line.match(/Nmap scan report for (?:([^\s]+) \()?(\d+\.\d+\.\d+\.\d+)\)?/);
    if (reportMatch) {
      if (currentDevice) devices.push(currentDevice);
      currentDevice = {
        hostname: reportMatch[1] || null,
        ip_address: reportMatch[2],
        ports: [],
        status: 'online',
        device_type: 'unknown',
        model: 'Unknown',
      };
    }
    if (currentDevice) {
      const portMatch = line.match(/(\d+)\/(tcp|udp)\s+open\s+(\S+)/);
      if (portMatch) {
        currentDevice.ports.push({
          port: parseInt(portMatch[1]),
          protocol: portMatch[2],
          service: portMatch[3],
        });
      }
      const latencyMatch = line.match(/Host is up \(([^)]+)\)/);
      if (latencyMatch) {
        currentDevice.latency = latencyMatch[1];
      }
    }
  }
  if (currentDevice) devices.push(currentDevice);
  return devices;
}

// POST /api/discovery/scan - Start a network scan
router.post('/scan', async (req, res) => {
  const { ipRange = '172.28.0.0/24', ports = [80, 161], timeout = 5000 } = req.body;

  // Validate IP range (basic validation to prevent injection)
  if (!/^[\d./]+$/.test(ipRange)) {
    return res.status(400).json({ error: 'Invalid IP range format' });
  }

  const scanId = uuidv4();
  const scan = {
    scan_id: scanId,
    ip_range: ipRange,
    status: 'running',
    total_hosts: 0,
    discovered_count: 0,
    results: [],
    created_at: new Date().toISOString(),
  };

  scanStore.set(scanId, scan);

  // Persist to DB if available
  try {
    await pool.query(
      `INSERT INTO discovery_scans (scan_id, ip_range, status) VALUES ($1, $2, 'running')`,
      [scanId, ipRange]
    );
  } catch (err) {
    console.warn('Could not persist scan to DB:', err.message);
  }

  // Respond immediately with scan ID
  res.json({ scan_id: scanId, status: 'running', message: 'Scan started' });

  // Run nmap in background
  const portList = ports.join(',');
  const cmd = `nmap -sn -p ${portList} --open -T4 ${ipRange} 2>/dev/null`;

  exec(cmd, { timeout: 120000 }, async (error, stdout, stderr) => {
    if (error && error.killed) {
      scan.status = 'timeout';
      scan.error = 'Scan timed out';
    } else {
      try {
        const devices = parseNmapOutput(stdout || '');
        scan.results = devices;
        scan.total_hosts = cidrHostCount(ipRange);
        scan.discovered_count = devices.length;
        scan.status = 'completed';
        scan.completed_at = new Date().toISOString();

        // Persist results to DB
        try {
          await pool.query(
            `UPDATE discovery_scans SET status = 'completed', total_hosts = $1, discovered_count = $2, results = $3, completed_at = NOW() WHERE scan_id = $4`,
            [scan.total_hosts, scan.discovered_count, JSON.stringify(devices), scanId]
          );
        } catch (dbErr) {
          console.warn('Could not update scan in DB:', dbErr.message);
        }
      } catch (parseErr) {
        scan.status = 'error';
        scan.error = parseErr.message;
      }
    }
    scanStore.set(scanId, scan);
  });
});

// GET /api/discovery/results/:scanId - Get scan results
router.get('/results/:scanId', async (req, res) => {
  const { scanId } = req.params;

  // Check memory first
  if (scanStore.has(scanId)) {
    return res.json(scanStore.get(scanId));
  }

  // Try DB
  try {
    const result = await pool.query(
      'SELECT * FROM discovery_scans WHERE scan_id = $1',
      [scanId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/discovery/scans - List recent scans
router.get('/scans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT scan_id, ip_range, status, total_hosts, discovered_count, created_at, completed_at FROM discovery_scans ORDER BY created_at DESC LIMIT 20'
    );
    res.json({ scans: result.rows });
  } catch (err) {
    // Fall back to in-memory
    const scans = Array.from(scanStore.values()).map(({ results, ...rest }) => rest);
    res.json({ scans });
  }
});

// POST /api/discovery/register - Bulk register discovered devices
router.post('/register', async (req, res) => {
  const { devices } = req.body;
  if (!devices || !Array.isArray(devices) || devices.length === 0) {
    return res.status(400).json({ error: 'devices array is required' });
  }

  const registered = [];
  const errors = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const device of devices) {
      if (!device.ip_address) {
        errors.push({ device, error: 'ip_address is required' });
        continue;
      }

      const deviceName = device.hostname || `Device-${device.ip_address.replace(/\./g, '-')}`;
      const deviceType = detectDeviceType(device.sysDescr || '', deviceName);

      try {
        const result = await client.query(
          `INSERT INTO devices (device_name, ip_address, mac_address, model, device_type, snmp_community, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, 'online', $7)
           ON CONFLICT (ip_address) DO UPDATE SET
             device_name = EXCLUDED.device_name,
             status = 'online',
             last_seen = NOW(),
             updated_at = NOW()
           RETURNING *`,
          [
            deviceName,
            device.ip_address,
            device.mac_address || null,
            device.model || 'Unknown',
            deviceType,
            device.snmp_community || 'public',
            JSON.stringify({ ports: device.ports || [], latency: device.latency }),
          ]
        );
        registered.push(result.rows[0]);
      } catch (err) {
        errors.push({ device, error: err.message });
      }
    }

    await client.query('COMMIT');
    res.json({
      message: `Registered ${registered.length} devices`,
      registered,
      errors,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
