const express = require('express');
const router = express.Router();
const pool = require('../db');
let snmp;
try {
  snmp = require('net-snmp');
} catch (e) {
  console.warn('net-snmp not available, SNMP polling disabled');
}

// SNMP OIDs for Teltonika/Linux devices
const OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  sysLocation: '1.3.6.1.2.1.1.6.0',
  cpuLoad1: '1.3.6.1.4.1.2021.10.1.3.1',
  cpuLoad5: '1.3.6.1.4.1.2021.10.1.3.2',
  memTotal: '1.3.6.1.4.1.2021.4.5.0',
  memFree: '1.3.6.1.4.1.2021.4.11.0',
  memAvail: '1.3.6.1.4.1.2021.4.6.0',
};

let pollingInterval = null;

function snmpGet(host, community, oids) {
  return new Promise((resolve, reject) => {
    if (!snmp) {
      return reject(new Error('net-snmp module not available'));
    }
    const session = snmp.createSession(host, community, {
      version: snmp.Version2c,
      timeout: 5000,
      retries: 1,
    });

    session.get(oids, (error, varbinds) => {
      session.close();
      if (error) return reject(error);
      const result = {};
      for (const vb of varbinds) {
        if (snmp.isVarbindError(vb)) {
          result[vb.oid] = null;
        } else {
          result[vb.oid] = vb.value ? vb.value.toString() : null;
        }
      }
      resolve(result);
    });
  });
}

async function pollDevice(device) {
  const community = device.snmp_community || 'public';
  const oidList = Object.values(OIDS);

  try {
    const result = await snmpGet(device.ip_address, community, oidList);

    const metrics = [];

    // Parse uptime (timeticks = 1/100 seconds)
    const uptime = result[OIDS.sysUpTime];
    if (uptime !== null && uptime !== undefined) {
      const uptimeSecs = Math.floor(parseInt(uptime) / 100);
      metrics.push({ type: 'uptime', value: uptimeSecs, unit: 'seconds' });
    }

    // Parse CPU load
    const cpu1 = result[OIDS.cpuLoad1];
    if (cpu1 !== null && cpu1 !== undefined) {
      metrics.push({ type: 'cpu_load_1m', value: parseFloat(cpu1), unit: '%' });
    }

    // Parse memory
    const memTotal = result[OIDS.memTotal];
    const memFree = result[OIDS.memFree];
    if (memTotal && memFree) {
      const total = parseInt(memTotal);
      const free = parseInt(memFree);
      const usedPct = ((total - free) / total) * 100;
      metrics.push({ type: 'memory_total', value: total, unit: 'KB' });
      metrics.push({ type: 'memory_free', value: free, unit: 'KB' });
      metrics.push({ type: 'memory_used_pct', value: Math.round(usedPct * 10) / 10, unit: '%' });
    }

    // System info
    const sysDescr = result[OIDS.sysDescr];
    const sysName = result[OIDS.sysName];

    // Store metrics in DB
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const m of metrics) {
        await client.query(
          `INSERT INTO snmp_metrics (device_id, metric_type, value, unit) VALUES ($1, $2, $3, $4)`,
          [device.device_id, m.type, m.value, m.unit]
        );
      }

      // Update device status and last_seen
      await client.query(
        `UPDATE devices SET status = 'online', last_seen = NOW(), updated_at = NOW()
         WHERE device_id = $1`,
        [device.device_id]
      );

      // Update device model/firmware from SNMP if available
      if (sysDescr || sysName) {
        await client.query(
          `UPDATE devices SET
            metadata = metadata || $1,
            device_name = COALESCE(NULLIF($2, ''), device_name),
            updated_at = NOW()
           WHERE device_id = $3`,
          [
            JSON.stringify({ sysDescr: sysDescr, sysName: sysName }),
            sysName || null,
            device.device_id,
          ]
        );
      }

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    return { success: true, device_id: device.device_id, metrics };
  } catch (err) {
    // Mark device as offline on SNMP failure
    try {
      await pool.query(
        `UPDATE devices SET status = 'offline', updated_at = NOW() WHERE device_id = $1`,
        [device.device_id]
      );
    } catch (dbErr) {
      // ignore
    }
    return { success: false, device_id: device.device_id, error: err.message };
  }
}

async function pollAllDevices() {
  try {
    const result = await pool.query("SELECT * FROM devices WHERE status != 'disabled'");
    const devices = result.rows;
    console.log(`SNMP polling ${devices.length} devices...`);

    const results = await Promise.allSettled(devices.map(d => pollDevice(d)));
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failures = results.length - successes;
    console.log(`SNMP poll complete: ${successes} success, ${failures} failures`);

    return { total: devices.length, successes, failures };
  } catch (err) {
    console.error('SNMP poll error:', err.message);
    return { error: err.message };
  }
}

// POST /api/snmp/poll/start - Start SNMP polling
router.post('/poll/start', async (req, res) => {
  const { interval = 300000 } = req.body; // default 5 minutes

  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Run immediately
  pollAllDevices().catch(console.error);

  pollingInterval = setInterval(() => {
    pollAllDevices().catch(console.error);
  }, interval);

  res.json({
    message: 'SNMP polling started',
    interval_ms: interval,
    interval_minutes: interval / 60000,
  });
});

// POST /api/snmp/poll/stop - Stop SNMP polling
router.post('/poll/stop', (req, res) => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    res.json({ message: 'SNMP polling stopped' });
  } else {
    res.json({ message: 'SNMP polling was not running' });
  }
});

// POST /api/snmp/poll/now - Poll all devices immediately
router.post('/poll/now', async (req, res) => {
  try {
    const results = await pollAllDevices();
    res.json({ message: 'Poll completed', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/snmp/metrics/:deviceId - Get device metrics
router.get('/metrics/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const { limit = 100, metric_type, since } = req.query;

  try {
    let query = 'SELECT * FROM snmp_metrics WHERE device_id = $1';
    const params = [deviceId];

    if (metric_type) {
      params.push(metric_type);
      query += ` AND metric_type = $${params.length}`;
    }

    if (since) {
      params.push(since);
      query += ` AND timestamp >= $${params.length}`;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json({ metrics: result.rows, device_id: deviceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/snmp/metrics/:deviceId/latest - Get latest metrics per type
router.get('/metrics/:deviceId/latest', async (req, res) => {
  const { deviceId } = req.params;
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (metric_type) *
       FROM snmp_metrics
       WHERE device_id = $1
       ORDER BY metric_type, timestamp DESC`,
      [deviceId]
    );
    res.json({ metrics: result.rows, device_id: deviceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/snmp/alerts - Get device alerts
router.get('/alerts', async (req, res) => {
  const { is_resolved = false, limit = 50 } = req.query;
  try {
    const result = await pool.query(
      `SELECT a.*, d.device_name, d.ip_address
       FROM device_alerts a
       LEFT JOIN devices d ON a.device_id = d.device_id
       WHERE a.is_resolved = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [is_resolved === 'true', parseInt(limit)]
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/snmp/alerts/:alertId/resolve - Resolve an alert
router.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE device_alerts SET is_resolved = TRUE, resolved_at = NOW() WHERE alert_id = $1 RETURNING *`,
      [req.params.alertId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
