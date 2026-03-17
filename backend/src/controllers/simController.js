'use strict';

const pool = require('../db');
const SimControlClient = require('../services/simcontrolService');
const { syncSIMs } = require('../services/simSyncService');
const simcontrolConfig = require('../config/simcontrol');

// GET /api/sim/devices
async function listDevicesWithSIM(req, res) {
  try {
    const result = await pool.query(
      `SELECT d.*, sd.sim_control_id, sd.phone_number, sd.iccid, sd.operator,
              sd.status AS sim_status, sd.last_synced,
              sm.data_used_mb, sm.data_limit_mb, sm.balance, sm.signal_strength
       FROM devices d
       LEFT JOIN sim_devices sd ON sd.device_id = d.device_id
       LEFT JOIN LATERAL (
         SELECT data_used_mb, data_limit_mb, balance, signal_strength
         FROM sim_metrics WHERE sim_device_id = sd.id ORDER BY created_at DESC LIMIT 1
       ) sm ON true
       ORDER BY d.device_id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[simController] listDevicesWithSIM:', err.message);
    res.status(500).json({ error: 'Failed to fetch devices with SIM info' });
  }
}

// GET /api/sim/devices/:deviceId
async function getDeviceWithSIM(req, res) {
  try {
    const { deviceId } = req.params;
    const result = await pool.query(
      `SELECT d.*, sd.id AS sim_device_id, sd.sim_control_id, sd.phone_number,
              sd.iccid, sd.imsi, sd.operator, sd.status AS sim_status, sd.last_synced,
              sm.data_used_mb, sm.data_limit_mb, sm.balance, sm.signal_strength
       FROM devices d
       LEFT JOIN sim_devices sd ON sd.device_id = d.device_id
       LEFT JOIN LATERAL (
         SELECT data_used_mb, data_limit_mb, balance, signal_strength
         FROM sim_metrics WHERE sim_device_id = sd.id ORDER BY created_at DESC LIMIT 1
       ) sm ON true
       WHERE d.device_id = $1`,
      [deviceId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Device not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[simController] getDeviceWithSIM:', err.message);
    res.status(500).json({ error: 'Failed to fetch device SIM info' });
  }
}

// GET /api/sim/:simControlId
async function getSIMFromProvider(req, res) {
  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const data = await client.getSIMById(req.params.simControlId);
    res.json(data);
  } catch (err) {
    console.error('[simController] getSIMFromProvider:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sim/devices/:deviceId/link
async function linkDeviceToSIM(req, res) {
  try {
    const { deviceId } = req.params;
    const { simControlId } = req.body;
    if (!simControlId) return res.status(400).json({ error: 'simControlId is required' });

    await pool.query(
      `UPDATE sim_devices SET device_id=$1, updated_at=NOW() WHERE sim_control_id=$2`,
      [deviceId, simControlId]
    );
    res.json({ message: 'SIM linked to device' });
  } catch (err) {
    console.error('[simController] linkDeviceToSIM:', err.message);
    res.status(500).json({ error: 'Failed to link SIM' });
  }
}

// DELETE /api/sim/devices/:deviceId/unlink
async function unlinkDeviceFromSIM(req, res) {
  try {
    const { deviceId } = req.params;
    await pool.query(
      `UPDATE sim_devices SET device_id=NULL, updated_at=NOW() WHERE device_id=$1`,
      [deviceId]
    );
    res.json({ message: 'SIM unlinked from device' });
  } catch (err) {
    console.error('[simController] unlinkDeviceFromSIM:', err.message);
    res.status(500).json({ error: 'Failed to unlink SIM' });
  }
}

// GET /api/sim/:simControlId/usage
async function getSIMUsage(req, res) {
  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const data = await client.getSIMUsage(req.params.simControlId);
    res.json(data);
  } catch (err) {
    console.error('[simController] getSIMUsage:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/sim/:simControlId/balance
async function getSIMBalance(req, res) {
  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const data = await client.getSIMBalance(req.params.simControlId);
    res.json(data);
  } catch (err) {
    console.error('[simController] getSIMBalance:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sim/:simControlId/suspend
async function suspendSIM(req, res) {
  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const data = await client.suspendSIM(req.params.simControlId);
    await pool.query(
      `UPDATE sim_devices SET status='suspended', updated_at=NOW() WHERE sim_control_id=$1`,
      [req.params.simControlId]
    ).catch(() => {});
    res.json(data);
  } catch (err) {
    console.error('[simController] suspendSIM:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sim/:simControlId/reactivate
async function reactivateSIM(req, res) {
  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const data = await client.reactivateSIM(req.params.simControlId);
    await pool.query(
      `UPDATE sim_devices SET status='active', updated_at=NOW() WHERE sim_control_id=$1`,
      [req.params.simControlId]
    ).catch(() => {});
    res.json(data);
  } catch (err) {
    console.error('[simController] reactivateSIM:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/sim/sync/status
async function getSyncStatus(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM sim_sync_logs ORDER BY started_at DESC LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('[simController] getSyncStatus:', err.message);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
}

// POST /api/sim/sync/now
async function triggerSync(req, res) {
  try {
    const result = await syncSIMs(pool);
    res.json(result);
  } catch (err) {
    console.error('[simController] triggerSync:', err.message);
    res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
}

// GET /api/sim/metrics/dashboard
async function getDashboardMetrics(req, res) {
  try {
    const totals = await pool.query(
      `SELECT
         COUNT(*) AS total_sims,
         COUNT(*) FILTER (WHERE status = 'active') AS active_sims,
         COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_sims
       FROM sim_devices`
    );
    const balanceLow = await pool.query(
      `SELECT COUNT(*) AS low_balance_count
       FROM sim_metrics sm
       JOIN sim_devices sd ON sm.sim_device_id = sd.id
       WHERE sm.balance < $1 AND sm.balance IS NOT NULL`,
      [simcontrolConfig.balanceThreshold]
    );
    const highUsage = await pool.query(
      `SELECT COUNT(*) AS high_usage_count
       FROM sim_metrics
       WHERE data_limit_mb > 0
         AND data_used_mb IS NOT NULL
         AND (data_used_mb / data_limit_mb) >= 0.8`
    );

    res.json({
      ...totals.rows[0],
      ...balanceLow.rows[0],
      ...highUsage.rows[0],
    });
  } catch (err) {
    console.error('[simController] getDashboardMetrics:', err.message);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
}

module.exports = {
  listDevicesWithSIM,
  getDeviceWithSIM,
  getSIMFromProvider,
  linkDeviceToSIM,
  unlinkDeviceFromSIM,
  getSIMUsage,
  getSIMBalance,
  suspendSIM,
  reactivateSIM,
  getSyncStatus,
  triggerSync,
  getDashboardMetrics,
};
