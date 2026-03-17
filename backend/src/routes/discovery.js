const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const snmp = require('net-snmp');
const ping = require('ping');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gns_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

const community = 'public';

/**
 * POST /api/discovery/scan
 * Scan network for active devices using nmap
 */
router.post('/scan', async (req, res) => {
    try {
        const { ipRange = '172.28.0.0/24', ports = [80, 161] } = req.body;
        
        // Create scan record
        const scanResult = await pool.query(
            'INSERT INTO discovery_scans (ip_range, status, created_at) VALUES ($1, $2, NOW()) RETURNING id',
            [ipRange, 'in_progress']
        );
        const scanId = scanResult.rows[0].id;

        // Run nmap scan asynchronously
        exec(`nmap -sn ${ipRange}`, async (error, stdout, stderr) => {
            if (error) {
                await pool.query('UPDATE discovery_scans SET status = $1 WHERE id = $2', ['failed', scanId]);
                return;
            }

            // Parse nmap output
            const devices = [];
            const lines = stdout.split('\n');
            lines.forEach(line => {
                const match = line.match(/Nmap scan report for (\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    devices.push({ ip: match[1], discovered_at: new Date() });
                }
            });

            // Update scan record
            await pool.query(
                'UPDATE discovery_scans SET status = $1, results_count = $2, results = $3 WHERE id = $4',
                ['completed', devices.length, JSON.stringify(devices), scanId]
            );
        });

        res.json({ scanId, status: 'scanning', ipRange });
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
        const { devices } = req.body; // Array of {ip, name, model, ...}
        
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
        
        const result = await ping.promise.probe(ip);
        
        res.json({
            ip,
            status: result.alive ? 'online' : 'offline',
            time: result.time
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;