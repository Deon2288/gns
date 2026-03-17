'use strict';

const simcontrolConfig = require('../config/simcontrol');

async function checkBalanceAlerts(pool) {
  try {
    const threshold = simcontrolConfig.balanceThreshold;
    const result = await pool.query(
      `SELECT sm.*, sd.sim_control_id, sd.phone_number
       FROM sim_metrics sm
       JOIN sim_devices sd ON sm.sim_device_id = sd.id
       WHERE sm.balance < $1 AND sm.balance IS NOT NULL`,
      [threshold]
    );

    for (const row of result.rows) {
      await pool
        .query(
          `INSERT INTO alerts (device_id, alert_type, message, severity, created_at)
           SELECT sd.device_id, 'low_balance',
                  'SIM ' || $1 || ' balance R' || $2 || ' is below threshold R' || $3,
                  'warning', NOW()
           FROM sim_devices sd WHERE sd.id = $4 AND sd.device_id IS NOT NULL
           ON CONFLICT DO NOTHING`,
          [row.sim_control_id, row.balance, threshold, row.sim_device_id]
        )
        .catch(() => {});
    }

    return result.rows.length;
  } catch (err) {
    console.error('[simAlertService] checkBalanceAlerts error:', err.message);
    return 0;
  }
}

async function checkDataUsageAlerts(pool) {
  try {
    const result = await pool.query(
      `SELECT sm.*, sd.sim_control_id, sd.phone_number
       FROM sim_metrics sm
       JOIN sim_devices sd ON sm.sim_device_id = sd.id
       WHERE sm.data_limit_mb > 0
         AND sm.data_used_mb IS NOT NULL
         AND sm.data_limit_mb IS NOT NULL
         AND (sm.data_used_mb / sm.data_limit_mb) >= 0.8`
    );

    for (const row of result.rows) {
      const pct = ((row.data_used_mb / row.data_limit_mb) * 100).toFixed(1);
      await pool
        .query(
          `INSERT INTO alerts (device_id, alert_type, message, severity, created_at)
           SELECT sd.device_id, 'high_data_usage',
                  'SIM ' || $1 || ' data usage at ' || $2 || '% (' || $3 || 'MB / ' || $4 || 'MB)',
                  'warning', NOW()
           FROM sim_devices sd WHERE sd.id = $5 AND sd.device_id IS NOT NULL
           ON CONFLICT DO NOTHING`,
          [row.sim_control_id, pct, row.data_used_mb, row.data_limit_mb, row.sim_device_id]
        )
        .catch(() => {});
    }

    return result.rows.length;
  } catch (err) {
    console.error('[simAlertService] checkDataUsageAlerts error:', err.message);
    return 0;
  }
}

async function processWebhookEvent(event, pool) {
  const { type, sim_id, data } = event;

  try {
    switch (type) {
      case 'status_change':
        await pool.query(
          `UPDATE sim_devices SET status=$1, updated_at=NOW() WHERE sim_control_id=$2`,
          [data.status, sim_id]
        );
        break;

      case 'balance_update':
        await pool.query(
          `UPDATE sim_metrics sm SET balance=$1, last_updated=NOW()
           FROM sim_devices sd
           WHERE sm.sim_device_id = sd.id AND sd.sim_control_id=$2`,
          [data.balance, sim_id]
        );
        await checkBalanceAlerts(pool);
        break;

      case 'data_warning':
        await pool.query(
          `UPDATE sim_metrics sm SET data_used_mb=$1, last_updated=NOW()
           FROM sim_devices sd
           WHERE sm.sim_device_id = sd.id AND sd.sim_control_id=$2`,
          [data.data_used_mb, sim_id]
        );
        await checkDataUsageAlerts(pool);
        break;

      default:
        console.warn(`[simAlertService] Unknown webhook event type: ${type}`);
    }
  } catch (err) {
    console.error(`[simAlertService] processWebhookEvent error (${type}):`, err.message);
    throw err;
  }
}

module.exports = { checkBalanceAlerts, checkDataUsageAlerts, processWebhookEvent };
