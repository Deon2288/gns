import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Alert {
  alert_id: number;
  device_id: number;
  device_name: string;
  alert_type: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  acknowledged: boolean;
  created_at: string;
}

type Filter = 'all' | 'unread' | 'critical';

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  warning:  '#d97706',
  info:     '#2563eb',
};

const SEVERITY_BG: Record<string, string> = {
  critical: '#450a0a',
  warning:  '#431407',
  info:     '#0c1a3a',
};

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '20px 24px',
  marginBottom: 24,
};

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 16px',
  border: 'none',
  borderRadius: 6,
  background: active ? '#2563eb' : '#334155',
  color: active ? '#fff' : '#94a3b8',
  fontWeight: 600,
  fontSize: 13,
  marginRight: 8,
  cursor: 'pointer',
  transition: 'background 0.15s',
});

// ── Component ─────────────────────────────────────────────────────────────────

const AlertsPanel: React.FC = () => {
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<Filter>('all');
  const [acking, setAcking]     = useState<Set<number>>(new Set());

  const token = localStorage.getItem('gns_token') || '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('gns_token') || ''}` };
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<Alert[]>(`${API}/alerts`, { headers });
      setAlerts(data);
    } catch {
      setError('Failed to load alerts. Are you logged in?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id: number) => {
    setAcking((prev) => new Set(prev).add(id));
    try {
      const { data } = await axios.patch<Alert>(`${API}/alerts/${id}/acknowledge`, {}, { headers });
      setAlerts((prev) => prev.map((a) => a.alert_id === id ? data : a));
    } catch {
      setError('Failed to acknowledge alert.');
    } finally {
      setAcking((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const visible = alerts.filter((a) => {
    if (filter === 'unread')   return !a.acknowledged;
    if (filter === 'critical') return a.severity === 'critical';
    return true;
  });

  const unreadCount   = alerts.filter((a) => !a.acknowledged).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div>
      <h2 style={{ marginTop: 0, color: '#f1f5f9', fontSize: 20 }}>Alerts</h2>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total',         value: alerts.length,  color: '#38bdf8' },
          { label: 'Unacknowledged', value: unreadCount,   color: '#f59e0b' },
          { label: 'Critical',      value: criticalCount,  color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} style={{ ...cardStyle, flex: 1, marginBottom: 0, textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        {(['all', 'unread', 'critical'] as Filter[]).map((f) => (
          <button key={f} style={filterBtnStyle(filter === f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unread'   && unreadCount   > 0 && ` (${unreadCount})`}
            {f === 'critical' && criticalCount > 0 && ` (${criticalCount})`}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>No alerts to show.</div>
        ) : (
          visible.map((a) => (
            <div
              key={a.alert_id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 0',
                borderBottom: '1px solid #334155',
                opacity: a.acknowledged ? 0.55 : 1,
                background: a.acknowledged ? 'transparent' : SEVERITY_BG[a.severity] ?? 'transparent',
                borderRadius: 6,
                paddingLeft: 10,
                paddingRight: 10,
                marginBottom: 2,
              }}
            >
              {/* Severity badge */}
              <div style={{
                flexShrink: 0,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SEVERITY_COLORS[a.severity] ?? '#64748b',
                marginTop: 5,
              }} />

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    background: SEVERITY_COLORS[a.severity] ?? '#475569',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                  }}>
                    {a.severity}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{a.alert_type}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>— {a.device_name}</span>
                </div>
                <div style={{ fontSize: 13, color: '#cbd5e1' }}>{a.message}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>

              {!a.acknowledged && (
                <button
                  onClick={() => acknowledge(a.alert_id)}
                  disabled={acking.has(a.alert_id)}
                  style={{
                    flexShrink: 0,
                    padding: '5px 12px',
                    background: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: acking.has(a.alert_id) ? 0.6 : 1,
                  }}
                >
                  {acking.has(a.alert_id) ? '…' : '✓ Ack'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
