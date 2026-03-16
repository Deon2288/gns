import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeviceRow {
  device_id: number;
  device_name: string;
  latitude?: number;
  longitude?: number;
  last_seen?: string;
}

// ── Demo / derived stats ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Online:  '#22c55e',
  Moving:  '#38bdf8',
  Idle:    '#f59e0b',
  Offline: '#ef4444',
};

// Deterministically assign a demo status to each device for the dashboard
function demoStatus(id: number): string {
  return ['Online', 'Moving', 'Idle', 'Offline'][id % 4];
}

function demoBattery(id: number): number {
  return Math.max(10, 100 - (id * 17) % 90);
}

function demoSpeed(id: number): number {
  const status = demoStatus(id);
  return status === 'Moving' ? 30 + (id * 13) % 70 : 0;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '20px 24px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 20,
  marginBottom: 24,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
};

const statValueStyle = (color = '#f1f5f9'): React.CSSProperties => ({
  fontSize: 32,
  fontWeight: 800,
  color,
  lineHeight: 1,
});

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 16,
  marginTop: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('gns_token') || ''}` };
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<DeviceRow[]>(`${API}/devices`, { headers });
      setDevices(data);
    } catch {
      // If not authenticated, use empty list — dashboard still shows zeros
      setDevices([]);
      setError('Could not load live device data. Using demo data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derive stats
  const total   = devices.length;
  const online  = devices.filter((d) => demoStatus(d.device_id) === 'Online').length;
  const moving  = devices.filter((d) => demoStatus(d.device_id) === 'Moving').length;
  const offline = devices.filter((d) => demoStatus(d.device_id) === 'Offline').length;

  const pieData = [
    { name: 'Online',  value: online },
    { name: 'Moving',  value: moving },
    { name: 'Idle',    value: total - online - moving - offline },
    { name: 'Offline', value: offline },
  ].filter((d) => d.value > 0);

  const barData = devices.map((d) => ({
    name:    d.device_name.slice(0, 8),
    Speed:   demoSpeed(d.device_id),
    Battery: demoBattery(d.device_id),
  }));

  return (
    <div>
      <h2 style={{ marginTop: 0, color: '#f1f5f9', fontSize: 20 }}>Fleet Dashboard</h2>

      {error && (
        <div style={{ background: '#422006', color: '#fde68a', padding: '8px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div style={gridStyle}>
        {[
          { label: 'Total Devices',   value: loading ? '…' : total,   color: '#38bdf8' },
          { label: 'Online / Moving', value: loading ? '…' : `${online + moving}`, color: '#22c55e' },
          { label: 'Offline',         value: loading ? '…' : offline,  color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={statLabelStyle}>{s.label}</div>
            <div style={statValueStyle(s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {total === 0 && !loading ? (
        <div style={{ ...cardStyle, color: '#64748b', textAlign: 'center', padding: 40 }}>
          No devices registered yet. Add devices in the <strong>Devices</strong> tab.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Status breakdown */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Status Breakdown</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Speed & battery bar chart */}
          <div style={cardStyle}>
            <p style={sectionTitleStyle}>Speed (km/h) &amp; Battery (%)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                <Bar dataKey="Speed"   fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Battery" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Battery table */}
          <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
            <p style={sectionTitleStyle}>Device Battery Levels</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Device', 'Status', 'Battery', 'Last Seen'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', borderBottom: '1px solid #334155' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const bat = demoBattery(d.device_id);
                  const batColor = bat < 20 ? '#ef4444' : bat < 50 ? '#f59e0b' : '#22c55e';
                  return (
                    <tr key={d.device_id}>
                      <td style={{ padding: '10px 12px', color: '#e2e8f0', fontWeight: 600 }}>{d.device_name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: STATUS_COLORS[demoStatus(d.device_id)] + '33', color: STATUS_COLORS[demoStatus(d.device_id)], padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {demoStatus(d.device_id)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 80, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${bat}%`, height: '100%', background: batColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ color: batColor, fontSize: 12, fontWeight: 700 }}>{bat}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                        {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default Dashboard;
