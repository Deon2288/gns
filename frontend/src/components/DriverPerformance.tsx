import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../store/useStore';
import { DriverScore } from '../types';

const DriverPerformance: React.FC = () => {
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [selected, setSelected] = useState<DriverScore | null>(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const { data } = await api.get('/api/drivers/leaderboard');
      setDrivers(data);
    } catch (err) { console.error('Failed to fetch drivers', err); }
  }, []);

  useEffect(() => { fetchDrivers(); const i = setInterval(fetchDrivers, 30000); return () => clearInterval(i); }, [fetchDrivers]);

  const scoreColor = (score: number) => score >= 80 ? '#4caf50' : score >= 60 ? '#ff9800' : '#f44336';
  const scoreLabel = (score: number) => score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor';

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>👨‍💼 Driver Performance</h2>

      <div style={styles.grid}>
        {drivers.length === 0 && <div style={styles.empty}>No driver data available</div>}
        {drivers.map((d, idx) => (
          <div key={d.user_id} onClick={() => setSelected(selected?.user_id === d.user_id ? null : d)}
            style={{ ...styles.card, border: selected?.user_id === d.user_id ? '2px solid #1976d2' : '2px solid transparent' }}>
            <div style={styles.rank}>#{idx + 1}</div>
            <div style={styles.driverName}>{d.username || `Driver #${d.user_id}`}</div>
            <div style={{ ...styles.scoreCircle, background: scoreColor(d.safety_score) }}>
              <div style={styles.scoreValue}>{d.safety_score}</div>
              <div style={styles.scoreLabel}>{scoreLabel(d.safety_score)}</div>
            </div>
            <div style={styles.events}>{d.events_last_30d} incidents (30d)</div>
            <div style={styles.updated}>Updated: {new Date(d.updated_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      {selected && <DriverDetail userId={selected.user_id} name={selected.username || `Driver #${selected.user_id}`} />}
    </div>
  );
};

const DriverDetail: React.FC<{ userId: number; name: string }> = ({ userId, name }) => {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/api/drivers/${userId}/events`, { params: { limit: '20' } })
      .then(({ data }) => setEvents(data))
      .catch(() => {});
  }, [userId]);

  const eventIcon: Record<string, string> = {
    harsh_acceleration: '🚀', harsh_braking: '🛑', harsh_cornering: '↩️',
    speeding: '⚡', excessive_idling: '⏸️', seatbelt: '🔒', phone_usage: '📱',
  };

  return (
    <div style={styles.detail}>
      <h3 style={{ margin: '0 0 12px' }}>Recent Events – {name}</h3>
      {events.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No events recorded</div>}
      {events.map((e) => (
        <div key={e.event_id} style={styles.eventRow}>
          <span style={styles.eventIcon}>{eventIcon[e.event_type] || '⚠️'}</span>
          <span style={styles.eventType}>{e.event_type.replace(/_/g, ' ')}</span>
          <span style={styles.eventDevice}>{e.device_name}</span>
          <span style={styles.eventTime}>{new Date(e.occurred_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  title: { margin: '0 0 20px', color: '#1a1a2e' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  empty: { textAlign: 'center', color: '#888', padding: 40, gridColumn: '1/-1' },
  card: { background: '#fff', borderRadius: 8, padding: 16, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', transition: 'border .2s' },
  rank: { fontSize: 12, color: '#888', marginBottom: 4 },
  driverName: { fontWeight: 700, fontSize: 14, color: '#1a1a2e', marginBottom: 12 },
  scoreCircle: { width: 80, height: 80, borderRadius: '50%', margin: '0 auto 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  scoreValue: { fontSize: 24, fontWeight: 700 },
  scoreLabel: { fontSize: 10, marginTop: 2 },
  events: { fontSize: 12, color: '#666', marginBottom: 4 },
  updated: { fontSize: 11, color: '#999' },
  detail: { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  eventRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 },
  eventIcon: { fontSize: 16 },
  eventType: { flex: 1, fontWeight: 500, textTransform: 'capitalize' },
  eventDevice: { color: '#666' },
  eventTime: { fontSize: 12, color: '#999' },
};

export default DriverPerformance;
