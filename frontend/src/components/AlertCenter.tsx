import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Alert, AlertSeverity, AlertType } from '../types';

const SEV_COLOR: Record<AlertSeverity, string> = { critical: '#f44336', warning: '#ff9800', info: '#2196f3' };
const TYPE_LABELS: Record<AlertType, string> = {
  geofence: '📍 Geofence', speed: '⚡ Speed', harsh_driving: '⚠️ Harsh Driving',
  engine_on: '🔑 Engine On', engine_off: '🔌 Engine Off', fuel_level: '⛽ Fuel',
  temperature: '🌡️ Temp', offline: '📡 Offline', sos: '🆘 SOS', custom: '🔔 Custom',
};

const AlertCenter: React.FC = () => {
  const { alerts, fetchAlerts, acknowledgeAlert, acknowledgeAll, alertSummary, fetchAlertSummary } = useStore();
  const [filter, setFilter] = useState<{ severity?: AlertSeverity; type?: AlertType; acknowledged?: string }>({});

  useEffect(() => {
    const params: Record<string, string> = { limit: '100' };
    if (filter.severity) params.severity = filter.severity;
    if (filter.type) params.type = filter.type;
    if (filter.acknowledged !== undefined) params.acknowledged = filter.acknowledged;
    fetchAlerts(params);
    fetchAlertSummary();
    const interval = setInterval(() => { fetchAlerts(params); fetchAlertSummary(); }, 15000);
    return () => clearInterval(interval);
  }, [filter, fetchAlerts, fetchAlertSummary]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>🚨 Alert Center</h2>
        <button onClick={acknowledgeAll} style={styles.ackAllBtn}>✓ Acknowledge All</button>
      </div>

      {/* Summary pills */}
      <div style={styles.summaryRow}>
        {(['critical', 'warning', 'info'] as AlertSeverity[]).map((sev) => (
          <button key={sev} onClick={() => setFilter((f) => ({ ...f, severity: f.severity === sev ? undefined : sev }))}
            style={{ ...styles.pill, background: SEV_COLOR[sev], opacity: filter.severity && filter.severity !== sev ? 0.4 : 1 }}>
            {alertSummary[sev]} {sev}
          </button>
        ))}
        <button onClick={() => setFilter({})} style={styles.clearBtn}>Clear Filters</button>
      </div>

      {/* Filters */}
      <div style={styles.filtersRow}>
        <select value={filter.type || ''} onChange={(e) => setFilter((f) => ({ ...f, type: (e.target.value as AlertType) || undefined }))} style={styles.select}>
          <option value="">All Types</option>
          {(Object.keys(TYPE_LABELS) as AlertType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filter.acknowledged ?? ''} onChange={(e) => setFilter((f) => ({ ...f, acknowledged: e.target.value || undefined }))} style={styles.select}>
          <option value="">All Status</option>
          <option value="false">Unacknowledged</option>
          <option value="true">Acknowledged</option>
        </select>
      </div>

      {/* Alerts List */}
      <div style={styles.list}>
        {alerts.length === 0 && <div style={styles.empty}>No alerts found</div>}
        {alerts.map((alert) => (
          <AlertRow key={alert.alert_id} alert={alert} onAck={() => acknowledgeAlert(alert.alert_id)} />
        ))}
      </div>
    </div>
  );
};

const AlertRow: React.FC<{ alert: Alert; onAck: () => void }> = ({ alert, onAck }) => (
  <div style={{ ...styles.row, opacity: alert.acknowledged ? 0.6 : 1, borderLeft: `4px solid ${SEV_COLOR[alert.severity]}` }}>
    <div style={styles.rowMain}>
      <span style={{ ...styles.sevBadge, background: SEV_COLOR[alert.severity] }}>{alert.severity}</span>
      <span style={styles.type}>{TYPE_LABELS[alert.alert_type] || alert.alert_type}</span>
      <span style={styles.device}>{alert.device_name || `Device #${alert.device_id}`}</span>
    </div>
    <div style={styles.message}>{alert.message}</div>
    <div style={styles.rowFooter}>
      <span style={styles.time}>{new Date(alert.triggered_at).toLocaleString()}</span>
      {!alert.acknowledged && (
        <button onClick={onAck} style={styles.ackBtn}>✓ Acknowledge</button>
      )}
      {alert.acknowledged && <span style={styles.acked}>✓ Acknowledged</span>}
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, color: '#1a1a2e' },
  ackAllBtn: { background: '#388e3c', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  summaryRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  pill: { color: '#fff', border: 'none', borderRadius: 20, padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'opacity .2s' },
  clearBtn: { background: '#fff', border: '1px solid #ccc', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
  filtersRow: { display: 'flex', gap: 12, marginBottom: 16 },
  select: { padding: '7px 10px', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  empty: { textAlign: 'center', color: '#888', padding: 40 },
  row: { background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  rowMain: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 },
  sevBadge: { color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  type: { fontWeight: 600, fontSize: 14, color: '#333' },
  device: { color: '#666', fontSize: 13 },
  message: { color: '#444', fontSize: 13, margin: '4px 0' },
  rowFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  time: { fontSize: 11, color: '#999' },
  ackBtn: { background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12 },
  acked: { fontSize: 12, color: '#4caf50' },
};

export default AlertCenter;
