const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const ping = require('ping');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gns_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

router.post('/scan', async (req, res) => {
    try {
        const { ipRange = '172.28.0.0/24' } = req.body;
        res.json({ message: 'Scan started', ipRange });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
