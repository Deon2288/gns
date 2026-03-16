import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { devices as devicesApi, alerts, trips as tripsApi } from '../services/api';
import { Device, AlertHistory, Trip, AlertSummary } from '../types';
import DeviceMap from '../components/DeviceMap';

const COLORS = { online: '#22c55e', idle: '#eab308', offline: '#ef4444' };
const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6',
  warning: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const StatCard: React.FC<{ label: string; value: number | string; color?: string; icon: string }> = ({
  label, value, color = '#e94560', icon,
}) => (
  <div style={{
    background: '#0f3460',
    borderRadius: 10,
    padding: '20px 24px',
    flex: 1,
    minWidth: 160,
    borderLeft: `4px solid ${color}`,
  }}>
    <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
    <div style={{ color: '#8892b0', fontSize: 12, marginBottom: 4 }}>{label}</div>
    <div style={{ color: '#ccd6f6', fontSize: 28, fontWeight: 700 }}>{value}</div>
  </div>
);

const Dashboard: React.FC = () => {
  const [deviceList, setDeviceList] = useState<Device[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AlertHistory[]>([]);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      devicesApi.getAll(),
      alerts.getHistory({ limit: 10 }),
      tripsApi.getAll({ limit: 5 }),
      alerts.getSummary(),
    ])
      .then(([d, a, t, s]) => {
        setDeviceList(Array.isArray(d) ? d : d.devices || []);
        setRecentAlerts(Array.isArray(a) ? a : a.alerts || []);
        setRecentTrips(Array.isArray(t) ? t : t.trips || []);
        setSummary(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const online = deviceList.filter((d) => d.status === 'online').length;
  const idle = deviceList.filter((d) => d.status === 'idle').length;
  const offline = deviceList.filter((d) => d.status === 'offline').length;
  const pieData = [
    { name: 'Online', value: online },
    { name: 'Idle', value: idle },
    { name: 'Offline', value: offline },
  ].filter((d) => d.value > 0);

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    subtitle: { color: '#8892b0', fontSize: 13, marginTop: 4 },
    statsRow: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' as const },
    row: { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' as const },
    card: { background: '#0f3460', borderRadius: 10, padding: 20, flex: 1, minWidth: 280 },
    cardTitle: { color: '#ccd6f6', fontWeight: 600, marginBottom: 14, fontSize: 15 },
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th: { color: '#8892b0', textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #1a1a2e' },
    td: { padding: '8px 8px', borderBottom: '1px solid #1a1a2e', color: '#ccd6f6' },
  };

  if (loading) {
    return <div style={{ ...s.page, color: '#8892b0' }}>Loading dashboard...</div>;
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Dashboard</h2>
        <div style={s.subtitle}>Fleet overview and quick stats</div>
      </div>

      <div style={s.statsRow}>
        <StatCard label="Total Devices" value={deviceList.length} color="#0ea5e9" icon="📡" />
        <StatCard label="Online" value={online} color="#22c55e" icon="🟢" />
        <StatCard label="Offline" value={offline} color="#ef4444" icon="🔴" />
        <StatCard label="Active Alerts" value={summary?.unacknowledged ?? 0} color="#e94560" icon="🔔" />
      </div>

      <div style={s.row}>
        <div style={{ ...s.card, flex: 2, minWidth: 320 }}>
          <div style={s.cardTitle}>Live Map</div>
          <div style={{ height: 280, borderRadius: 8, overflow: 'hidden' }}>
            <DeviceMap devices={deviceList} height="280px" />
          </div>
        </div>

        <div style={{ ...s.card, flex: 1, minWidth: 220 }}>
          <div style={s.cardTitle}>Device Status</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {pieData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] || '#8892b0'}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 12 }}>
            {pieData.map((d) => (
              <span key={d.name} style={{ color: COLORS[d.name.toLowerCase() as keyof typeof COLORS] }}>
                ● {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={s.row}>
        <div style={{ ...s.card, flex: 3 }}>
          <div style={s.cardTitle}>Recent Alerts</div>
          {recentAlerts.length === 0 ? (
            <div style={{ color: '#8892b0', fontSize: 13 }}>No recent alerts</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Device</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>Message</th>
                  <th style={s.th}>Severity</th>
                  <th style={s.th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.slice(0, 10).map((a) => (
                  <tr key={a.alert_id}>
                    <td style={s.td}>{a.device_name || '—'}</td>
                    <td style={s.td}>{a.alert_type}</td>
                    <td style={s.td}>{a.message}</td>
                    <td style={s.td}>
                      <span style={{
                        background: SEVERITY_COLORS[a.severity] + '33',
                        color: SEVERITY_COLORS[a.severity],
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                        textTransform: 'capitalize',
                      }}>
                        {a.severity}
                      </span>
                    </td>
                    <td style={s.td}>{new Date(a.triggered_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...s.card, flex: 1, minWidth: 220 }}>
          <div style={s.cardTitle}>Recent Trips</div>
          {recentTrips.length === 0 ? (
            <div style={{ color: '#8892b0', fontSize: 13 }}>No recent trips</div>
          ) : (
            recentTrips.map((t) => (
              <div key={t.trip_id} style={{
                padding: '8px 0',
                borderBottom: '1px solid #1a1a2e',
                fontSize: 13,
              }}>
                <div style={{ color: '#ccd6f6', fontWeight: 500 }}>
                  {t.device_name || `Device #${t.device_id}`}
                </div>
                <div style={{ color: '#8892b0', fontSize: 12 }}>
                  {t.distance_km != null ? `${t.distance_km.toFixed(1)} km` : '—'}
                  {' · '}
                  <span style={{
                    color: t.status === 'active' ? '#22c55e' : '#8892b0',
                    textTransform: 'capitalize',
                  }}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
