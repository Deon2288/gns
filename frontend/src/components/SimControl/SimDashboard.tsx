import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_BASE_URL from '../../config/api';

interface DashboardMetrics {
  total_sims: number;
  active_sims: number;
  suspended_sims: number;
  low_balance_count: number;
  high_usage_count: number;
}

interface SyncStatus {
  id: number;
  sync_type: string;
  status: string;
  items_synced: number;
  items_failed: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
}

interface SimDevice {
  device_id: number | null;
  device_name?: string;
  sim_control_id: string;
  phone_number: string | null;
  iccid: string | null;
  operator: string | null;
  sim_status: string;
  last_synced: string | null;
  data_used_mb: number | null;
  data_limit_mb: number | null;
  balance: number | null;
}

export const SimDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [devices, setDevices] = useState<SimDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [metricsRes, syncRes, devicesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/sim/metrics/dashboard`),
        axios.get(`${API_BASE_URL}/api/sim/sync/status`),
        axios.get(`${API_BASE_URL}/api/sim/devices`),
      ]);
      setMetrics(metricsRes.data);
      setSyncStatus(syncRes.data);
      setDevices(devicesRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load SIM data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_BASE_URL}/api/sim/sync/now`);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'suspended': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  if (loading) return <div className="sim-loading">Loading SIM data...</div>;

  return (
    <div className="sim-dashboard">
      <div className="sim-dashboard-header">
        <h2>📱 SIM Management Dashboard</h2>
        <div className="sim-header-actions">
          {syncStatus && (
            <span className="sim-last-sync">
              Last sync: {syncStatus.started_at ? new Date(syncStatus.started_at).toLocaleString() : 'Never'}
            </span>
          )}
          <button className="btn-sync" onClick={handleSyncNow} disabled={syncing}>
            {syncing ? '🔄 Syncing...' : '🔄 Sync Now'}
          </button>
        </div>
      </div>

      {error && <div className="sim-error">⚠️ {error}</div>}

      {metrics && (
        <div className="sim-stats-grid">
          <div className="sim-stat-card">
            <div className="sim-stat-value">{metrics.total_sims}</div>
            <div className="sim-stat-label">Total SIMs</div>
          </div>
          <div className="sim-stat-card sim-stat-green">
            <div className="sim-stat-value">{metrics.active_sims}</div>
            <div className="sim-stat-label">Active</div>
          </div>
          <div className="sim-stat-card sim-stat-red">
            <div className="sim-stat-value">{metrics.suspended_sims}</div>
            <div className="sim-stat-label">Suspended</div>
          </div>
          <div className="sim-stat-card sim-stat-yellow">
            <div className="sim-stat-value">{metrics.low_balance_count}</div>
            <div className="sim-stat-label">Low Balance</div>
          </div>
          <div className="sim-stat-card sim-stat-orange">
            <div className="sim-stat-value">{metrics.high_usage_count}</div>
            <div className="sim-stat-label">High Usage</div>
          </div>
        </div>
      )}

      <div className="sim-devices-list">
        <h3>SIM Devices</h3>
        {devices.length === 0 ? (
          <p>No SIM devices found. Run a sync to populate data.</p>
        ) : (
          <table className="sim-table">
            <thead>
              <tr>
                <th>SIM ID</th>
                <th>Phone</th>
                <th>Operator</th>
                <th>Status</th>
                <th>Data Usage</th>
                <th>Balance</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.sim_control_id}>
                  <td><code>{d.sim_control_id}</code></td>
                  <td>{d.phone_number || '—'}</td>
                  <td>{d.operator || '—'}</td>
                  <td>
                    <span className="sim-status-badge" style={{ background: statusColor(d.sim_status) }}>
                      {d.sim_status}
                    </span>
                  </td>
                  <td>
                    {d.data_used_mb !== null && d.data_limit_mb ? (
                      <div className="sim-usage-bar-wrap">
                        <div
                          className="sim-usage-bar"
                          style={{ width: `${Math.min(100, (d.data_used_mb / d.data_limit_mb) * 100)}%` }}
                        />
                        <span>{d.data_used_mb?.toFixed(1)} / {d.data_limit_mb} MB</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>{d.balance !== null ? `R${Number(d.balance).toFixed(2)}` : '—'}</td>
                  <td>{d.device_name || (d.device_id ? `#${d.device_id}` : <em>Unlinked</em>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
