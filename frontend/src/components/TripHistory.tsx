import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../store/useStore';
import { Trip } from '../types';

function fmtDuration(secs?: number) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const TripHistory: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filter, setFilter] = useState({ device_id: '', from: '', to: '' });

  const fetchTrips = useCallback(async () => {
    try {
      const params: Record<string, string> = { limit: '50' };
      if (filter.device_id) params.device_id = filter.device_id;
      if (filter.from) params.from = filter.from;
      if (filter.to) params.to = filter.to;
      const { data } = await api.get('/api/trips', { params });
      setTrips(data);
    } catch (err) { console.error('Failed to fetch trips', err); }
  }, [filter]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const totalKm = trips.reduce((s, t) => s + (t.distance_km || 0), 0);
  const totalFuel = trips.reduce((s, t) => s + (t.fuel_used || 0), 0);

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>🚗 Trip History</h2>

      {/* Summary */}
      <div style={styles.summaryRow}>
        <div style={styles.kpi}><span style={styles.kpiVal}>{trips.length}</span><span style={styles.kpiLabel}>Trips</span></div>
        <div style={styles.kpi}><span style={styles.kpiVal}>{totalKm.toFixed(1)}</span><span style={styles.kpiLabel}>Total km</span></div>
        <div style={styles.kpi}><span style={styles.kpiVal}>{totalFuel.toFixed(1)} L</span><span style={styles.kpiLabel}>Fuel Used</span></div>
        <div style={styles.kpi}><span style={styles.kpiVal}>{trips.length > 0 ? (totalKm / trips.length).toFixed(1) : '—'}</span><span style={styles.kpiLabel}>Avg km/trip</span></div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input placeholder="Device ID" value={filter.device_id} onChange={(e) => setFilter((f) => ({ ...f, device_id: e.target.value }))} style={styles.input} />
        <input type="date" value={filter.from} onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} style={styles.input} />
        <input type="date" value={filter.to} onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} style={styles.input} />
        <button onClick={fetchTrips} style={styles.filterBtn}>🔍 Search</button>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              {['Device', 'Status', 'Start', 'End', 'Duration', 'Distance', 'Fuel', 'Max Speed', 'Avg Speed'].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trips.length === 0 && (
              <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#888' }}>No trips found</td></tr>
            )}
            {trips.map((t) => (
              <tr key={t.trip_id} style={styles.tr}>
                <td style={styles.td}>{t.device_name || `#${t.device_id}`}</td>
                <td style={styles.td}><StatusBadge status={t.status} /></td>
                <td style={styles.td}>{new Date(t.start_time).toLocaleString()}</td>
                <td style={styles.td}>{t.end_time ? new Date(t.end_time).toLocaleString() : '—'}</td>
                <td style={styles.td}>{fmtDuration(t.duration_seconds)}</td>
                <td style={styles.td}>{t.distance_km?.toFixed(2) ?? '0'} km</td>
                <td style={styles.td}>{t.fuel_used?.toFixed(1) ?? '0'} L</td>
                <td style={styles.td}>{t.max_speed?.toFixed(0) ?? '—'} km/h</td>
                <td style={styles.td}>{t.avg_speed?.toFixed(0) ?? '—'} km/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = { active: '#4caf50', completed: '#1976d2', cancelled: '#9e9e9e' };
  return <span style={{ background: colors[status] || '#9e9e9e', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 }}>{status}</span>;
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  title: { margin: '0 0 20px', color: '#1a1a2e' },
  summaryRow: { display: 'flex', gap: 16, marginBottom: 20 },
  kpi: { background: '#fff', borderRadius: 8, padding: '16px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: 100, display: 'flex', flexDirection: 'column' },
  kpiVal: { fontSize: 24, fontWeight: 700, color: '#1a1a2e' },
  kpiLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  input: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 },
  filterBtn: { background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13 },
  tableWrap: { background: '#fff', borderRadius: 8, padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  thead: { background: '#f5f5f5' },
  th: { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '1px solid #e0e0e0', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 12px', color: '#333', whiteSpace: 'nowrap' },
};

export default TripHistory;
