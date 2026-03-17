'use strict';

const SimControlClient = require('./simcontrolService');
const simcontrolConfig = require('../config/simcontrol');

let _syncInterval = null;

async function syncSIMs(pool, syncType = 'manual') {
  const startedAt = new Date();
  let synced = 0;
  let failed = 0;
  let syncLogId = null;

  try {
    const logResult = await pool.query(
      `INSERT INTO sim_sync_logs (sync_type, status, started_at)
       VALUES ($1, 'running', NOW()) RETURNING id`,
      [syncType]
    );
    syncLogId = logResult.rows[0].id;
  } catch (_) {
    // Table may not exist yet; proceed without logging
  }

  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const sims = await client.getSIMs();
    const simList = Array.isArray(sims) ? sims : sims.data || sims.sims || [];

    for (const sim of simList) {
      try {
        await pool.query(
          `INSERT INTO sim_devices
             (sim_control_id, phone_number, iccid, imsi, operator, status, last_synced, sync_error, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL, NOW())
           ON CONFLICT (sim_control_id) DO UPDATE SET
             phone_number = EXCLUDED.phone_number,
             iccid        = EXCLUDED.iccid,
             imsi         = EXCLUDED.imsi,
             operator     = EXCLUDED.operator,
             status       = EXCLUDED.status,
             last_synced  = NOW(),
             sync_error   = NULL,
             updated_at   = NOW()`,
          [
            sim.id || sim.sim_control_id,
            sim.phone_number || sim.msisdn || null,
            sim.iccid || null,
            sim.imsi || null,
            sim.operator || sim.network || null,
            sim.status || 'active',
          ]
        );
        synced++;
      } catch (err) {
        console.error(`[simSyncService] Failed to upsert SIM ${sim.id}: ${err.message}`);
        failed++;
      }
    }
  } catch (err) {
    console.error(`[simSyncService] Sync failed: ${err.message}`);
    const duration = Date.now() - startedAt.getTime();
    if (syncLogId) {
      await pool
        .query(
          `UPDATE sim_sync_logs SET status='failed', error_message=$1, duration_ms=$2, completed_at=NOW()
           WHERE id=$3`,
          [err.message, duration, syncLogId]
        )
        .catch(() => {});
    }
    return { synced, failed, duration };
  }

  const duration = Date.now() - startedAt.getTime();
  if (syncLogId) {
    await pool
      .query(
        `UPDATE sim_sync_logs
         SET status='success', items_synced=$1, items_failed=$2, duration_ms=$3, completed_at=NOW()
         WHERE id=$4`,
        [synced, failed, duration, syncLogId]
      )
      .catch(() => {});
  }

  console.log(`[simSyncService] Sync complete: ${synced} synced, ${failed} failed in ${duration}ms`);
  return { synced, failed, duration };
}

function startAutoSync(pool, intervalMs) {
  const ms = intervalMs || simcontrolConfig.syncInterval;
  console.log(`[simSyncService] Auto-sync started every ${ms / 1000}s`);
  _syncInterval = setInterval(() => {
    syncSIMs(pool, 'automatic').catch((err) => console.error('[simSyncService] Auto-sync error:', err.message));
  }, ms);
}

function stopAutoSync() {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
    console.log('[simSyncService] Auto-sync stopped');
  }
}

module.exports = { syncSIMs, startAutoSync, stopAutoSync };
