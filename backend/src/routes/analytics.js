const express = require('express');
const router = express.Router();

// Get system overview stats
router.get('/overview', async (req, res) => {
    try {
        const devicesResult = await req.pool.query('SELECT COUNT(*) as count FROM devices');
        const alertsResult = await req.pool.query('SELECT COUNT(*) as count FROM alerts WHERE acknowledged = false');
        const gpsResult = await req.pool.query('SELECT COUNT(*) as count FROM gps_data');

        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const activeDevicesResult = await req.pool.query(
            `SELECT COUNT(DISTINCT d.device_id) as count FROM devices d
             LEFT JOIN gps_data g ON d.device_id = g.device_id
             WHERE g.timestamp > $1`,
            [fiveMinutesAgo.toISOString()]
        );

        res.json({
            totalDevices: parseInt(devicesResult.rows[0].count),
            activeDevices: parseInt(activeDevicesResult.rows[0].count),
            totalAlerts: parseInt(alertsResult.rows[0].count),
            totalGPSRecords: parseInt(gpsResult.rows[0].count),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch overview' });
    }
});

// Get speed distribution
router.get('/speed-distribution', async (req, res) => {
    try {
        const result = await req.pool.query(`
            SELECT 
                CASE 
                    WHEN speed < 20 THEN '0-20 km/h'
                    WHEN speed < 50 THEN '20-50 km/h'
                    WHEN speed < 100 THEN '50-100 km/h'
                    ELSE '100+ km/h'
                END as range,
                COUNT(*) as count
            FROM gps_data
            WHERE timestamp > NOW() - INTERVAL '24 hours'
            GROUP BY range
            ORDER BY range
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch speed distribution' });
    }
});

// Get device activity over time
router.get('/activity', async (req, res) => {
    try {
        const hours = req.query.hours || 24;
        const result = await req.pool.query(`
            SELECT 
                DATE_TRUNC('hour', timestamp) as hour,
                COUNT(*) as records,
                COUNT(DISTINCT device_id) as active_devices
            FROM gps_data
            WHERE timestamp > NOW() - INTERVAL '1 hour' * $1
            GROUP BY DATE_TRUNC('hour', timestamp)
            ORDER BY hour DESC
        `, [hours]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch activity data' });
    }
});

// Get device metrics
router.get('/device-metrics', async (req, res) => {
    try {
        const result = await req.pool.query(`
            SELECT 
                d.device_id,
                d.device_name,
                COUNT(g.gps_id) as total_records,
                MAX(g.speed) as max_speed,
                AVG(g.speed) as avg_speed,
                MAX(g.timestamp) as last_update
            FROM devices d
            LEFT JOIN gps_data g ON d.device_id = g.device_id
            GROUP BY d.device_id, d.device_name
            ORDER BY last_update DESC NULLS LAST
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch device metrics' });
    }
});

module.exports = router;
