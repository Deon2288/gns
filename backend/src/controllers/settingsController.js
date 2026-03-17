'use strict';

const pool = require('../db');
const SimControlClient = require('../services/simcontrolService');
const simcontrolConfig = require('../config/simcontrol');

// GET /api/settings/simcontrol
async function getSettings(req, res) {
  try {
    const result = await pool.query(`SELECT key, value FROM sim_settings`);
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    // Never expose the API key
    res.json({
      apiUrl: settings.api_url || simcontrolConfig.apiUrl,
      syncInterval: settings.sync_interval || String(simcontrolConfig.syncInterval / 1000),
      balanceThreshold: settings.balance_threshold || String(simcontrolConfig.balanceThreshold),
      webhookUrl: settings.webhook_url || simcontrolConfig.webhookUrl,
      apiKeyConfigured: !!simcontrolConfig.apiKey,
    });
  } catch (err) {
    console.error('[settingsController] getSettings:', err.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

// POST /api/settings/simcontrol
async function updateSettings(req, res) {
  try {
    const { apiUrl, syncInterval, balanceThreshold, webhookUrl } = req.body;
    const updates = [
      ['api_url', apiUrl],
      ['sync_interval', syncInterval],
      ['balance_threshold', balanceThreshold],
      ['webhook_url', webhookUrl],
    ].filter(([, v]) => v !== undefined);

    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO sim_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [key, String(value)]
      );
    }

    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('[settingsController] updateSettings:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

// POST /api/settings/simcontrol/test
async function testConnection(req, res) {
  try {
    const client = new SimControlClient(simcontrolConfig.apiKey, simcontrolConfig.apiUrl);
    const result = await client.validateConnection();
    res.json(result);
  } catch (err) {
    console.error('[settingsController] testConnection:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/settings/simcontrol/sync-logs
async function getSyncLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);
    const result = await pool.query(
      `SELECT * FROM sim_sync_logs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[settingsController] getSyncLogs:', err.message);
    res.status(500).json({ error: 'Failed to fetch sync logs' });
  }
}

module.exports = { getSettings, updateSettings, testConnection, getSyncLogs };
