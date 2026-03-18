const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

// Lazily resolve the shared pool from the app (set via middleware in index.js)
function getPool(req) {
    return req.pool || null;
}

/**
 * POST /api/discovery/scan
 * Scan network for active devices using nmap
 */
router.post('/scan', async (req, res) => {
    try {
        const { ipRange = '172.28.0.0/24' } = req.body;

        // Validate CIDR notation to prevent command injection
        const cidrRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;
        const cidrMatch = ipRange.match(cidrRegex);
        if (!cidrMatch ||
            cidrMatch.slice(1, 5).some(o => parseInt(o, 10) > 255) ||
            parseInt(cidrMatch[5], 10) > 32) {
            return res.status(400).json({ error: 'Invalid CIDR IP range' });
        }

        // Reconstruct CIDR from validated parts to prevent injection
        const safeRange = `${cidrMatch.slice(1, 5).join('.')}/${cidrMatch[5]}`;
        const pool = getPool(req);

        let scanId = null;
        if (pool) {
            const scanResult = await pool.query(
                'INSERT INTO discovery_scans (ip_range, status, created_at) VALUES ($1, $2, NOW()) RETURNING id',
                [safeRange, 'in_progress']
            );
            scanId = scanResult.rows[0].id;
        }

        // Run nmap scan asynchronously using validated safe range
        exec(`nmap -sn ${safeRange}`, async (error, stdout) => {
            if (error) {
                if (pool && scanId) {
                    await pool.query('UPDATE discovery_scans SET status = $1 WHERE id = $2', ['failed', scanId]);
                }
                return;
            }

            const devices = [];
            const lines = stdout.split('\n');
            lines.forEach(line => {
                const match = line.match(/Nmap scan report for (\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    devices.push({ ip: match[1], discovered_at: new Date() });
                }
            });

            if (pool && scanId) {
                await pool.query(
                    'UPDATE discovery_scans SET status = $1, results_count = $2, results = $3 WHERE id = $4',
                    ['completed', devices.length, JSON.stringify(devices), scanId]
                );
            }
        });

        res.json({ scanId, status: 'scanning', ipRange: safeRange });
    } catch (error) {
        console.error('Discovery scan error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/discovery/results/:scanId
 * Get results from a discovery scan
 */
router.get('/results/:scanId', async (req, res) => {
    try {
        const { scanId } = req.params;
        const pool = getPool(req);

        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }

        const result = await pool.query(
            'SELECT * FROM discovery_scans WHERE id = $1',
            [scanId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/discovery/register
 * Register discovered devices into the database
 */
router.post('/register', async (req, res) => {
    try {
        const { devices } = req.body;
        const pool = getPool(req);

        if (!pool) {
            return res.status(503).json({ error: 'Database not available' });
        }

        if (!Array.isArray(devices) || devices.length === 0) {
            return res.status(400).json({ error: 'devices array is required' });
        }

        const registeredDevices = [];
        for (const device of devices) {
            const result = await pool.query(
                `INSERT INTO devices (ip_address, name, device_type, model, snmp_community, status, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
                 ON CONFLICT (ip_address) DO UPDATE SET updated_at = NOW()
                 RETURNING *`,
                [device.ip, device.name || `Device-${device.ip}`, device.type || 'teltonika', device.model || 'RUTX12', 'public', 'online']
            );
            registeredDevices.push(result.rows[0]);
        }

        res.json({
            message: `${registeredDevices.length} devices registered`,
            devices: registeredDevices
        });
    } catch (error) {
        console.error('Device registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/discovery/status/:ip
 * Check device status using ICMP ping
 */
router.get('/status/:ip', async (req, res) => {
    try {
        const { ip } = req.params;

        // Validate IP address: each octet must be 0-255
        const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(ipRegex);
        if (!match || match.slice(1).some(o => parseInt(o, 10) > 255)) {
            return res.status(400).json({ error: 'Invalid IP address' });
        }

        // Reconstruct IP from validated octets to prevent injection
        const safeIp = match.slice(1).join('.');
        exec(`ping -c 1 -W 1 ${safeIp}`, (error) => {
            res.json({
                ip: safeIp,
                status: error ? 'offline' : 'online'
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;