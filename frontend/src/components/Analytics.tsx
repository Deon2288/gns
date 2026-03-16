import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../store/useStore';

const Analytics: React.FC = () => {
  const [tripData, setTripData] = useState<any[]>([]);
  const [alertData, setAlertData] = useState<any[]>([]);
  const [fuelData, setFuelData] = useState<any[]>([]);
  const [fleetData, setFleetData] = useState<any[]>([]);
  const [tab, setTab] = useState<'trips' | 'alerts' | 'fuel' | 'fleet'>('trips');

  const fetchAll = useCallback(async () => {
    try {
      const [trips, alerts, fuel, fleet] = await Promise.all([
        api.get('/api/analytics/trips', { params: { group_by: 'day' } }),
        api.get('/api/analytics/alerts'),
        api.get('/api/analytics/fuel'),
        api.get('/api/analytics/fleet'),
      ]);
      setTripData(trips.data.slice(0, 14).reverse());
      setAlertData(alerts.data.slice(0, 10));
      setFuelData(fuel.data.slice(0, 14).reverse());
      setFleetData(fleet.data.slice(0, 10));
    } catch (err) { console.error('Analytics fetch error', err); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>📈 Analytics & Reports</h2>

      <div style={styles.tabs}>
        {(['trips', 'alerts', 'fuel', 'fleet'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...styles.tab, ...(tab === t ? styles.activeTab : {}) }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div style={styles.chartBox}>
        {tab === 'trips' && (
          <>
            <h3 style={styles.chartTitle}>Daily Trips & Distance (Last 14 days)</h3>
            {tripData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tripData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickFormatter={(v) => new Date(v).toLocaleDateString()} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="trip_count" name="Trips" fill="#1976d2" />
                  <Bar yAxisId="right" dataKey="total_km" name="Distance (km)" fill="#43a047" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {tab === 'alerts' && (
          <>
            <h3 style={styles.chartTitle}>Alert Distribution by Type</h3>
            {alertData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alertData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="alert_type" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Count" fill="#f44336" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {tab === 'fuel' && (
          <>
            <h3 style={styles.chartTitle}>Daily Fuel Consumption (Last 14 days)</h3>
            {fuelData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fuelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString()} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="fuel_used" name="Fuel (L)" stroke="#ff9800" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="l_per_100km" name="L/100km" stroke="#7b1fa2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {tab === 'fleet' && (
          <>
            <h3 style={styles.chartTitle}>Fleet Utilization (Last 7 days)</h3>
            {fleetData.length === 0 ? <Empty /> : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      {['Device', 'Status', 'Trips', 'Distance (km)', 'Fuel (L)', 'Safety Score'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fleetData.map((d) => (
                      <tr key={d.device_id}>
                        <td style={styles.td}>{d.device_name}</td>
                        <td style={styles.td}>{d.status}</td>
                        <td style={styles.td}>{d.trips}</td>
                        <td style={styles.td}>{parseFloat(d.distance_km).toFixed(1)}</td>
                        <td style={styles.td}>{parseFloat(d.fuel_used).toFixed(1)}</td>
                        <td style={styles.td}>{d.avg_safety_score ? parseFloat(d.avg_safety_score).toFixed(0) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Empty: React.FC = () => <div style={{ textAlign: 'center', color: '#888', padding: 60 }}>No data available yet</div>;

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  title: { margin: '0 0 20px', color: '#1a1a2e' },
  tabs: { display: 'flex', gap: 4, marginBottom: 16 },
  tab: { padding: '8px 20px', border: 'none', borderRadius: 6, cursor: 'pointer', background: '#e0e0e0', color: '#555', fontSize: 13 },
  activeTab: { background: '#1976d2', color: '#fff' },
  chartBox: { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  chartTitle: { margin: '0 0 16px', fontSize: 15, color: '#1a1a2e' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f5f5f5' },
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0' },
  td: { padding: '10px 12px', color: '#333', borderBottom: '1px solid #f0f0f0' },
};

export default Analytics;
