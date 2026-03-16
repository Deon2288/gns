import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';

const SEVERITY_COLOR: Record<string, string> = { critical: '#f44336', warning: '#ff9800', info: '#2196f3' };

const Dashboard: React.FC = () => {
  const { kpis, fetchKPIs, alertSummary, fetchAlertSummary, devices, fetchDevices } = useStore();

  useEffect(() => {
    fetchKPIs();
    fetchAlertSummary();
    fetchDevices();
    const interval = setInterval(() => { fetchKPIs(); fetchAlertSummary(); fetchDevices(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchKPIs, fetchAlertSummary, fetchDevices]);

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const idleCount = devices.filter((d) => d.status === 'idle').length;

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Fleet Dashboard</h2>

      {/* KPI Cards */}
      <div style={styles.grid}>
        <KPICard title="Total Devices" value={kpis?.devices.total ?? '-'} sub={`${onlineCount} online · ${idleCount} idle`} color="#1976d2" icon="🚗" />
        <KPICard title="Active Alerts" value={kpis?.alerts.unacknowledged ?? '-'} sub={`${kpis?.alerts.total ?? 0} in last 24h`} color="#f44336" icon="🚨" />
        <KPICard title="Trips Today" value={kpis?.trips.total ?? '-'} sub={`${(kpis?.trips.total_km ?? 0).toFixed(1)} km total`} color="#388e3c" icon="🗺️" />
        <KPICard title="Avg Safety Score" value={kpis?.drivers.avg_score ?? '-'} sub="Driver performance" color="#7b1fa2" icon="⭐" />
        <KPICard title="Fuel Used Today" value={kpis ? `${kpis.trips.total_fuel.toFixed(1)} L` : '-'} sub="All vehicles" color="#f57c00" icon="⛽" />
      </div>

      {/* Alert Summary */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Alert Summary (Unacknowledged)</h3>
        <div style={styles.alertRow}>
          {(['critical', 'warning', 'info'] as const).map((sev) => (
            <div key={sev} style={{ ...styles.alertPill, background: SEVERITY_COLOR[sev] }}>
              <span style={styles.alertCount}>{alertSummary[sev]}</span>
              <span style={styles.alertLabel}>{sev.charAt(0).toUpperCase() + sev.slice(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Device Status Table */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Device Overview</h3>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.theadRow}>
                {['Device', 'Status', 'Speed', 'Fuel', 'Last Seen'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, 10).map((d) => (
                <tr key={d.device_id} style={styles.tr}>
                  <td style={styles.td}>{d.device_name}</td>
                  <td style={styles.td}><StatusBadge status={d.status} /></td>
                  <td style={styles.td}>{d.speed != null ? `${d.speed.toFixed(1)} km/h` : '—'}</td>
                  <td style={styles.td}>{d.fuel_level != null ? `${d.fuel_level.toFixed(0)}%` : '—'}</td>
                  <td style={styles.td}>{d.last_seen ? new Date(d.last_seen).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr><td colSpan={5} style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No devices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: number | string; sub: string; color: string; icon: string }> = ({ title, value, sub, color, icon }) => (
  <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
    <div style={styles.cardIcon}>{icon}</div>
    <div style={styles.cardValue}>{value}</div>
    <div style={styles.cardTitle}>{title}</div>
    <div style={styles.cardSub}>{sub}</div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = { online: '#4caf50', offline: '#9e9e9e', idle: '#ff9800' };
  return <span style={{ background: colors[status] || '#9e9e9e', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>{status}</span>;
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  title: { margin: '0 0 20px', color: '#1a1a2e', fontSize: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center' },
  cardIcon: { fontSize: 28, marginBottom: 8 },
  cardValue: { fontSize: 32, fontWeight: 700, color: '#1a1a2e' },
  cardTitle: { fontSize: 13, color: '#666', marginTop: 4 },
  cardSub: { fontSize: 11, color: '#999', marginTop: 2 },
  section: { background: '#fff', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  sectionTitle: { margin: '0 0 16px', fontSize: 16, color: '#1a1a2e' },
  alertRow: { display: 'flex', gap: 12 },
  alertPill: { borderRadius: 8, padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 },
  alertCount: { fontSize: 28, fontWeight: 700, color: '#fff' },
  alertLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  theadRow: { background: '#f5f5f5' },
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 12px', color: '#333' },
};

export default Dashboard;
