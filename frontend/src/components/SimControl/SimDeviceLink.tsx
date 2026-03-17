import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_BASE_URL from '../../config/api';

interface SimDeviceData {
  device_id: number;
  device_name?: string;
  sim_control_id: string | null;
  phone_number: string | null;
  iccid: string | null;
  imsi: string | null;
  operator: string | null;
  sim_status: string | null;
  last_synced: string | null;
  data_used_mb: number | null;
  data_limit_mb: number | null;
  balance: number | null;
  signal_strength: number | null;
}

interface Props {
  deviceId: number;
}

export const SimDeviceLink: React.FC<Props> = ({ deviceId }) => {
  const [data, setData] = useState<SimDeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDevice = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sim/devices/${deviceId}`);
      setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load SIM data');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  const handleSuspend = async () => {
    if (!data?.sim_control_id) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/sim/${data.sim_control_id}/suspend`);
      await fetchDevice();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Suspend failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!data?.sim_control_id) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/sim/${data.sim_control_id}/reactivate`);
      await fetchDevice();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reactivate failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlink = async () => {
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/sim/devices/${deviceId}/unlink`);
      await fetchDevice();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unlink failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="sim-loading">Loading SIM info...</div>;
  if (error) return <div className="sim-error">⚠️ {error}</div>;
  if (!data?.sim_control_id) return <div className="sim-no-sim">No SIM linked to this device.</div>;

  const usagePct =
    data.data_used_mb !== null && data.data_limit_mb
      ? Math.min(100, (data.data_used_mb / data.data_limit_mb) * 100)
      : null;

  const statusColor =
    data.sim_status === 'active' ? '#22c55e' : data.sim_status === 'suspended' ? '#ef4444' : '#f59e0b';

  return (
    <div className="sim-device-link">
      <h4>📱 SIM Details</h4>

      <div className="sim-info-grid">
        <div className="sim-info-item">
          <span className="sim-info-label">Status</span>
          <span className="sim-status-badge" style={{ background: statusColor }}>
            {data.sim_status || 'unknown'}
          </span>
        </div>
        <div className="sim-info-item">
          <span className="sim-info-label">Phone</span>
          <span>{data.phone_number || '—'}</span>
        </div>
        <div className="sim-info-item">
          <span className="sim-info-label">ICCID</span>
          <code>{data.iccid || '—'}</code>
        </div>
        <div className="sim-info-item">
          <span className="sim-info-label">Operator</span>
          <span>{data.operator || '—'}</span>
        </div>
        <div className="sim-info-item">
          <span className="sim-info-label">Balance</span>
          <span>{data.balance !== null ? `R${Number(data.balance).toFixed(2)}` : '—'}</span>
        </div>
      </div>

      {usagePct !== null && (
        <div className="sim-usage-section">
          <div className="sim-usage-label">
            Data: {data.data_used_mb?.toFixed(1)} / {data.data_limit_mb} MB ({usagePct.toFixed(1)}%)
          </div>
          <div className="sim-progress-track">
            <div
              className="sim-progress-fill"
              style={{
                width: `${usagePct}%`,
                background: usagePct >= 80 ? '#ef4444' : usagePct >= 60 ? '#f59e0b' : '#22c55e',
              }}
            />
          </div>
        </div>
      )}

      <div className="sim-actions">
        {data.sim_status === 'active' ? (
          <button onClick={handleSuspend} disabled={actionLoading} className="btn-danger">
            ⏸ Suspend
          </button>
        ) : (
          <button onClick={handleReactivate} disabled={actionLoading} className="btn-success">
            ▶ Reactivate
          </button>
        )}
        <button onClick={handleUnlink} disabled={actionLoading} className="btn-secondary">
          🔗 Unlink SIM
        </button>
      </div>
    </div>
  );
};
