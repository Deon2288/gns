const express = require('express');
const router = express.Router();
const simcontrolService = require('../services/simcontrolService');

// -----------------------------------------------------------------------
// GET /api/sim/devices  – list all GNS devices with their linked SIM info
// -----------------------------------------------------------------------
router.get('/devices', async (req, res) => {
    try {
        const result = await req.pool.query(`
            SELECT d.*, sd.id AS sim_device_id, sd.sim_control_id, sd.phone_number,
                   sd.iccid, sd.imsi, sd.last_synced,
                   sm.data_used_mb, sm.data_limit_mb, sm.balance,
                   sm.signal_strength, sm.status AS sim_status, sm.operator, sm.last_updated
            FROM devices d
            LEFT JOIN sim_devices sd ON sd.device_id = d.device_id
            LEFT JOIN LATERAL (
                SELECT * FROM sim_metrics
                WHERE sim_device_id = sd.id
                ORDER BY timestamp DESC
                LIMIT 1
            ) sm ON TRUE
            ORDER BY d.device_id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch devices with SIM info' });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/devices/:deviceId  – get one device + its SIM details
// -----------------------------------------------------------------------
router.get('/devices/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const result = await req.pool.query(`
            SELECT d.*, sd.id AS sim_device_id, sd.sim_control_id, sd.phone_number,
                   sd.iccid, sd.imsi, sd.last_synced,
                   sm.data_used_mb, sm.data_limit_mb, sm.balance,
                   sm.signal_strength, sm.status AS sim_status, sm.operator, sm.last_updated
            FROM devices d
            LEFT JOIN sim_devices sd ON sd.device_id = d.device_id
            LEFT JOIN LATERAL (
                SELECT * FROM sim_metrics
                WHERE sim_device_id = sd.id
                ORDER BY timestamp DESC
                LIMIT 1
            ) sm ON TRUE
            WHERE d.device_id = $1
        `, [deviceId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch device SIM info' });
    }
});

// -----------------------------------------------------------------------
// POST /api/sim/devices/:deviceId/link  – link a device to a SimControl SIM
// -----------------------------------------------------------------------
router.post('/devices/:deviceId/link', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { sim_control_id, phone_number, iccid, imsi } = req.body;

        if (!sim_control_id) {
            return res.status(400).json({ error: 'sim_control_id is required' });
        }

        const deviceCheck = await req.pool.query(
            'SELECT device_id FROM devices WHERE device_id = $1', [deviceId]
        );
        if (deviceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }

        const result = await req.pool.query(`
            INSERT INTO sim_devices (device_id, sim_control_id, phone_number, iccid, imsi, last_synced, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (sim_control_id) DO UPDATE
                SET device_id    = EXCLUDED.device_id,
                    phone_number = COALESCE(EXCLUDED.phone_number, sim_devices.phone_number),
                    iccid        = COALESCE(EXCLUDED.iccid, sim_devices.iccid),
                    imsi         = COALESCE(EXCLUDED.imsi, sim_devices.imsi),
                    last_synced  = NOW()
            RETURNING *
        `, [deviceId, sim_control_id, phone_number, iccid, imsi]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to link SIM to device' });
    }
});

// -----------------------------------------------------------------------
// DELETE /api/sim/devices/:deviceId/unlink  – unlink SIM from device
// -----------------------------------------------------------------------
router.delete('/devices/:deviceId/unlink', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const result = await req.pool.query(
            'DELETE FROM sim_devices WHERE device_id = $1 RETURNING *',
            [deviceId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No SIM linked to this device' });
        }
        res.json({ message: 'SIM unlinked successfully', sim_device: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to unlink SIM' });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/sync  – manually trigger a sync from SimControl
// NOTE: must be defined before /:simId to avoid route shadowing
// -----------------------------------------------------------------------
router.get('/sync', async (req, res) => {
    try {
        simcontrolService.clearCache();
        const sims = await simcontrolService.getAllSims();

        const linked = await req.pool.query('SELECT * FROM sim_devices');
        let updated = 0;

        for (const row of linked.rows) {
            try {
                const usage = await simcontrolService.getSimUsage(row.sim_control_id);
                const details = await simcontrolService.getSimDetails(row.sim_control_id);
                await req.pool.query(`
                    INSERT INTO sim_metrics
                        (sim_device_id, data_used_mb, data_limit_mb, balance, signal_strength, status, operator, last_updated, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                `, [
                    row.id,
                    usage.data_used_mb ?? usage.usedMB ?? null,
                    usage.data_limit_mb ?? usage.limitMB ?? null,
                    details.balance ?? null,
                    details.signal_strength ?? details.signalStrength ?? null,
                    details.status ?? null,
                    details.operator ?? null,
                ]);
                await req.pool.query(
                    'UPDATE sim_devices SET last_synced = NOW() WHERE id = $1',
                    [row.id]
                );
                updated++;
            } catch (e) {
                console.error(`Failed to sync SIM ${row.sim_control_id}:`, e.message);
            }
        }

        res.json({ message: 'Sync complete', total_sims: sims.length || 0, updated });
    } catch (err) {
        console.error(err);
        res.status(502).json({ error: 'Sync failed: ' + err.message });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/metrics/dashboard  – aggregated SIM metrics for the dashboard
// NOTE: must be defined before /:simId to avoid route shadowing
// -----------------------------------------------------------------------
router.get('/metrics/dashboard', async (req, res) => {
    try {
        const summary = await req.pool.query(`
            SELECT
                COUNT(sd.id)                                         AS total_linked,
                COUNT(d.device_id) FILTER (WHERE sd.id IS NULL)     AS devices_without_sim,
                SUM(sm.data_used_mb)                                 AS total_data_used_mb,
                SUM(sm.balance)                                      AS total_balance,
                COUNT(*) FILTER (WHERE sm.status = 'active')        AS active_sims,
                COUNT(*) FILTER (WHERE sm.status = 'suspended')     AS suspended_sims
            FROM devices d
            LEFT JOIN sim_devices sd ON sd.device_id = d.device_id
            LEFT JOIN LATERAL (
                SELECT * FROM sim_metrics WHERE sim_device_id = sd.id ORDER BY timestamp DESC LIMIT 1
            ) sm ON TRUE
        `);

        const recent = await req.pool.query(`
            SELECT sd.sim_control_id, sd.phone_number, sm.status, sm.data_used_mb,
                   sm.data_limit_mb, sm.balance, sm.operator, sm.last_updated
            FROM sim_devices sd
            JOIN LATERAL (
                SELECT * FROM sim_metrics WHERE sim_device_id = sd.id ORDER BY timestamp DESC LIMIT 1
            ) sm ON TRUE
            ORDER BY sm.last_updated DESC
            LIMIT 20
        `);

        res.json({
            summary: summary.rows[0],
            recent_sims: recent.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch SIM dashboard metrics' });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/:simId  – fetch live SIM details from SimControl
// -----------------------------------------------------------------------
router.get('/:simId', async (req, res) => {
    try {
        const data = await simcontrolService.getSimDetails(req.params.simId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 502).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/:simId/usage  – live usage from SimControl
// -----------------------------------------------------------------------
router.get('/:simId/usage', async (req, res) => {
    try {
        const data = await simcontrolService.getSimUsage(req.params.simId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 502).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/:simId/history  – usage history from SimControl
// -----------------------------------------------------------------------
router.get('/:simId/history', async (req, res) => {
    try {
        const data = await simcontrolService.getSimHistory(req.params.simId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 502).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// GET /api/sim/:simId/balance  – balance/billing from SimControl
// -----------------------------------------------------------------------
router.get('/:simId/balance', async (req, res) => {
    try {
        const data = await simcontrolService.getSimBalance(req.params.simId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 502).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// POST /api/sim/:simId/suspend  – suspend a SIM via SimControl
// -----------------------------------------------------------------------
router.post('/:simId/suspend', async (req, res) => {
    try {
        const data = await simcontrolService.suspendSim(req.params.simId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 502).json({ error: err.message });
    }
});

// -----------------------------------------------------------------------
// POST /api/sim/:simId/reactivate  – reactivate a SIM via SimControl
// -----------------------------------------------------------------------
router.post('/:simId/reactivate', async (req, res) => {
    try {
        const data = await simcontrolService.reactivateSim(req.params.simId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 502).json({ error: err.message });
    }
});

module.exports = router;
