const express = require('express');
const router = express.Router();

// Get all devices
router.get('/', async (req, res) => {
    try {
        const result = await req.pool.query('SELECT * FROM devices ORDER BY device_id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Get single device
router.get('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const result = await req.pool.query(
            'SELECT * FROM devices WHERE device_id = $1',
            [deviceId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch device' });
    }
});

// Create device
router.post('/', async (req, res) => {
    try {
        const { user_id, device_name, imei, status } = req.body;
        
        // Validate required fields
        if (!user_id || !device_name || !imei) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await req.pool.query(
            `INSERT INTO devices (user_id, device_name, imei, status, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING *`,
            [user_id, device_name, imei, status || 'active']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'IMEI already exists' });
        }
        res.status(500).json({ error: 'Failed to create device' });
    }
});

// Update device
router.put('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { device_name, status } = req.body;

        const result = await req.pool.query(
            `UPDATE devices 
             SET device_name = COALESCE($1, device_name),
                 status = COALESCE($2, status)
             WHERE device_id = $3
             RETURNING *`,
            [device_name, status, deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update device' });
    }
});

// Delete device
router.delete('/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Delete associated GPS data first
        await req.pool.query('DELETE FROM gps_data WHERE device_id = $1', [deviceId]);
        
        // Delete associated alerts
        await req.pool.query('DELETE FROM alerts WHERE device_id = $1', [deviceId]);
        
        // Delete the device
        const result = await req.pool.query(
            'DELETE FROM devices WHERE device_id = $1 RETURNING *',
            [deviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({ message: 'Device deleted successfully', device: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

// Get device statistics
router.get('/:deviceId/stats', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        const deviceResult = await req.pool.query(
            'SELECT * FROM devices WHERE device_id = $1',
            [deviceId]
        );

        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const gpsResult = await req.pool.query(
            `SELECT 
                COUNT(*) as total_records,
                MAX(speed) as max_speed,
                AVG(speed) as avg_speed,
                MAX(altitude) as max_altitude,
                MIN(timestamp) as first_record,
                MAX(timestamp) as last_record
             FROM gps_data WHERE device_id = $1`,
            [deviceId]
        );

        const alertResult = await req.pool.query(
            `SELECT COUNT(*) as total_alerts FROM alerts WHERE device_id = $1`,
            [deviceId]
        );

        res.json({
            device: deviceResult.rows[0],
            gps_stats: gpsResult.rows[0],
            alert_stats: alertResult.rows[0],
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch device statistics' });
    }
});

module.exports = router;
