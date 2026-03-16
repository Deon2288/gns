import React, { useEffect, useState } from 'react';
import { driverBehavior as behaviorApi, devices as devicesApi } from '../services/api';
import { DriverBehavior as DriverBehaviorEvent, Device } from '../types';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#ef4444',
};

const EVENT_ICONS: Record<string, string> = {
  harsh_braking: '🛑',
  harsh_acceleration: '⚡',
  speeding: '🚀',
  sharp_turn: '↩',
  idle: '💤',
};

const DriverBehavior: React.FC = () => {
  const [events, setEvents] = useState<DriverBehaviorEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDevice, setFilterDevice] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = () => {
    Promise.all([
      behaviorApi.getEvents({
        device_id: filterDevice || undefined,
        from: filterFrom || undefined,
        to: filterTo || undefined,
      }),
      devicesApi.getAll(),
    ])
      .then(([e, d]) => {
      setEvents(Array.isArray(e) ? e : e.events || []);
        setDevices(Array.isArray(d) ? d : d.devices || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const summary = events.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.event_type] = (acc[ev.event_type] || 0) + 1;
    return acc;
  }, {});

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    filters: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const },
    select: { padding: '8px 12px', background: '#0f3460', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    input: { padding: '8px 12px', background: '#0f3460', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    summaryRow: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const },
    summaryCard: { background: '#0f3460', borderRadius: 8, padding: '12px 20px', minWidth: 130 },
    table: { width: '100%', borderCollapse: 'collapse' as const, background: '#0f3460', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '12px 14px', background: '#1a1a2e', color: '#8892b0', fontSize: 12, textAlign: 'left' as const, textTransform: 'uppercase' as const },
    td: { padding: '11px 14px', borderBottom: '1px solid #1a1a2e', fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Driver Behavior</h2>
        <div style={{ color: '#8892b0', fontSize: 13, marginTop: 4 }}>Monitor harsh driving events</div>
      </div>

      <div style={s.filters}>
        <select style={s.select} value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
          <option value="">All Devices</option>
          {devices.map((d) => <option key={d.device_id} value={String(d.device_id)}>{d.device_name}</option>)}
        </select>
        <input type="date" style={s.input} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        <input type="date" style={s.input} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        <button style={s.btn} onClick={() => { setLoading(true); load(); }}>Apply</button>
      </div>

      {Object.keys(summary).length > 0 && (
        <div style={s.summaryRow}>
          {Object.entries(summary).map(([type, count]) => (
            <div key={type} style={s.summaryCard}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{EVENT_ICONS[type] || '⚠'}</div>
              <div style={{ color: '#8892b0', fontSize: 11 }}>{type.replace(/_/g, ' ')}</div>
              <div style={{ color: '#ccd6f6', fontSize: 24, fontWeight: 700 }}>{count}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ color: '#8892b0' }}>Loading...</div> : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Device', 'Event Type', 'Severity', 'Speed', 'Time'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.behavior_id}>
                <td style={s.td}>{ev.device_name || `Device #${ev.device_id}`}</td>
                <td style={s.td}>
                  <span style={{ marginRight: 6 }}>{EVENT_ICONS[ev.event_type] || '⚠'}</span>
                  {ev.event_type.replace(/_/g, ' ')}
                </td>
                <td style={s.td}>
                  <span style={{
                    background: (SEVERITY_COLORS[ev.severity] || '#8892b0') + '33',
                    color: SEVERITY_COLORS[ev.severity] || '#8892b0',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                    textTransform: 'capitalize',
                  }}>
                    {ev.severity}
                  </span>
                </td>
                <td style={s.td}>{ev.speed != null ? `${ev.speed} km/h` : '—'}</td>
                <td style={{ ...s.td, color: '#8892b0', fontSize: 12 }}>{new Date(ev.recorded_at).toLocaleString()}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} style={{ ...s.td, color: '#8892b0', textAlign: 'center' }}>No events found</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DriverBehavior;
