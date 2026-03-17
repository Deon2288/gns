import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../../config/api';

interface Settings {
  apiUrl: string;
  syncInterval: string;
  balanceThreshold: string;
  webhookUrl: string;
  apiKeyConfigured: boolean;
}

interface SyncLog {
  id: number;
  sync_type: string;
  status: string;
  items_synced: number;
  items_failed: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const SYNC_INTERVAL_OPTIONS = [
  { label: '15 minutes', value: '900' },
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '6 hours', value: '21600' },
  { label: '24 hours', value: '86400' },
];

export const SimControlSettings: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    apiUrl: 'https://app.simcontrol.co.za/api',
    syncInterval: '3600',
    balanceThreshold: '500',
    webhookUrl: '',
    apiKeyConfigured: false,
  });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, logsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/settings/simcontrol`),
          axios.get(`${API_BASE_URL}/api/settings/simcontrol/sync-logs`),
        ]);
        setSettings(settingsRes.data);
        setSyncLogs(logsRes.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await axios.post(`${API_BASE_URL}/api/settings/simcontrol`, {
        apiUrl: settings.apiUrl,
        syncInterval: settings.syncInterval,
        balanceThreshold: settings.balanceThreshold,
        webhookUrl: settings.webhookUrl,
      });
      setSaveMessage('✅ Settings saved successfully');
    } catch (err: any) {
      setSaveMessage(`❌ ${err.response?.data?.error || 'Save failed'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/settings/simcontrol/test`);
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="sim-loading">Loading settings...</div>;

  return (
    <div className="sim-settings">
      <h2>⚙️ SimControl Settings</h2>

      {error && <div className="sim-error">⚠️ {error}</div>}

      <div className="sim-settings-form">
        <div className="sim-api-status">
          <span>API Key: </span>
          {settings.apiKeyConfigured ? (
            <span className="sim-status-badge" style={{ background: '#22c55e' }}>Configured</span>
          ) : (
            <span className="sim-status-badge" style={{ background: '#ef4444' }}>Not configured (set SIMCONTROL_API_KEY env var)</span>
          )}
        </div>

        <div className="sim-form-group">
          <label>API URL</label>
          <input
            type="text"
            value={settings.apiUrl}
            onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
            placeholder="https://app.simcontrol.co.za/api"
          />
        </div>

        <div className="sim-form-group">
          <label>Sync Interval</label>
          <select
            value={settings.syncInterval}
            onChange={(e) => setSettings({ ...settings, syncInterval: e.target.value })}
          >
            {SYNC_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="sim-form-group">
          <label>Balance Alert Threshold (R)</label>
          <input
            type="number"
            value={settings.balanceThreshold}
            onChange={(e) => setSettings({ ...settings, balanceThreshold: e.target.value })}
            min="0"
            step="10"
          />
        </div>

        <div className="sim-form-group">
          <label>Webhook URL (for SimControl callbacks)</label>
          <input
            type="text"
            value={settings.webhookUrl}
            onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
            placeholder="https://your-gns-domain.com/api/webhooks/simcontrol"
          />
        </div>

        <div className="sim-settings-actions">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button onClick={handleTestConnection} disabled={testing} className="btn-secondary">
            {testing ? 'Testing...' : '🔗 Test Connection'}
          </button>
        </div>

        {saveMessage && <p className="sim-save-msg">{saveMessage}</p>}

        {testResult && (
          <div className={`sim-test-result ${testResult.success ? 'success' : 'failure'}`}>
            {testResult.success ? '✅ Connection successful' : `❌ ${testResult.error}`}
          </div>
        )}
      </div>

      <div className="sim-sync-logs">
        <h3>Sync History</h3>
        {syncLogs.length === 0 ? (
          <p>No sync history yet.</p>
        ) : (
          <table className="sim-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Type</th>
                <th>Status</th>
                <th>Synced</th>
                <th>Failed</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.started_at).toLocaleString()}</td>
                  <td>{log.sync_type}</td>
                  <td>
                    <span
                      className="sim-status-badge"
                      style={{ background: log.status === 'success' ? '#22c55e' : '#ef4444' }}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td>{log.items_synced}</td>
                  <td>{log.items_failed}</td>
                  <td>{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                  <td>{log.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
