import React, { useEffect, useState } from 'react';
import { trips as tripsApi, devices as devicesApi, gps as gpsApi } from '../services/api';
import { Trip, Device, GpsPoint } from '../types';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const Trips: React.FC = () => {
  const [list, setList] = useState<Trip[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDevice, setFilterDevice] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [tripPoints, setTripPoints] = useState<GpsPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);

  const load = () => {
    Promise.all([
      tripsApi.getAll({ device_id: filterDevice || undefined, from: filterFrom || undefined, to: filterTo || undefined, status: filterStatus || undefined }),
      devicesApi.getAll(),
    ])
      .then(([t, d]) => {
        setList(Array.isArray(t) ? t : t.trips || []);
        setDevices(Array.isArray(d) ? d : d.devices || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleSelectTrip = async (trip: Trip) => {
    setSelectedTrip(trip);
    setTripPoints([]);
    setLoadingPoints(true);
    try {
      const data = await gpsApi.getHistory(trip.device_id, {
        from: trip.start_time,
        to: trip.end_time || undefined,
        limit: 500,
      });
      setTripPoints(Array.isArray(data) ? data : data.points || []);
    } catch {}
    finally { setLoadingPoints(false); }
  };

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    filters: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const },
    select: { padding: '8px 12px', background: '#0f3460', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    input: { padding: '8px 12px', background: '#0f3460', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse' as const, background: '#0f3460', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '12px 14px', background: '#1a1a2e', color: '#8892b0', fontSize: 12, textAlign: 'left' as const, textTransform: 'uppercase' as const },
    td: { padding: '11px 14px', borderBottom: '1px solid #1a1a2e', fontSize: 13 },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#0f3460', borderRadius: 12, padding: 24, width: '100%', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    modalTitle: { color: '#ccd6f6', fontSize: 18, fontWeight: 600, marginBottom: 16 },
    cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #8892b0', borderRadius: 6, color: '#8892b0', cursor: 'pointer', fontSize: 13 },
  };

  const applyFilters = () => { setLoading(true); load(); };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Trips</h2>
      </div>

      <div style={s.filters}>
        <select style={s.select} value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
          <option value="">All Devices</option>
          {devices.map((d) => <option key={d.device_id} value={String(d.device_id)}>{d.device_name}</option>)}
        </select>
        <select style={s.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <input type="date" style={s.input} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        <input type="date" style={s.input} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        <button style={s.btn} onClick={applyFilters}>Apply</button>
      </div>

      {loading ? <div style={{ color: '#8892b0' }}>Loading...</div> : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Device', 'Start', 'End', 'Distance', 'Duration', 'Avg Speed', 'Max Speed', 'Status'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.trip_id} style={{ cursor: 'pointer' }} onClick={() => handleSelectTrip(t)}>
                <td style={s.td}>{t.device_name || `Device #${t.device_id}`}</td>
                <td style={{ ...s.td, fontSize: 12, color: '#8892b0' }}>{new Date(t.start_time).toLocaleString()}</td>
                <td style={{ ...s.td, fontSize: 12, color: '#8892b0' }}>{t.end_time ? new Date(t.end_time).toLocaleString() : '—'}</td>
                <td style={s.td}>{t.distance_km != null ? `${t.distance_km.toFixed(1)} km` : '—'}</td>
                <td style={s.td}>{t.duration_minutes != null ? `${t.duration_minutes} min` : '—'}</td>
                <td style={s.td}>{t.avg_speed != null ? `${t.avg_speed} km/h` : '—'}</td>
                <td style={s.td}>{t.max_speed != null ? `${t.max_speed} km/h` : '—'}</td>
                <td style={s.td}>
                  <span style={{
                    color: t.status === 'active' ? '#22c55e' : '#8892b0',
                    background: (t.status === 'active' ? '#22c55e' : '#8892b0') + '22',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 11,
                    textTransform: 'capitalize',
                  }}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} style={{ ...s.td, color: '#8892b0', textAlign: 'center' }}>No trips found</td></tr>
            )}
          </tbody>
        </table>
      )}

      {selectedTrip && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={s.modalTitle}>
                Trip #{selectedTrip.trip_id} — {selectedTrip.device_name || `Device #${selectedTrip.device_id}`}
              </h3>
              <button style={s.cancelBtn} onClick={() => setSelectedTrip(null)}>Close</button>
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                ['Distance', selectedTrip.distance_km != null ? `${selectedTrip.distance_km.toFixed(1)} km` : '—'],
                ['Duration', selectedTrip.duration_minutes != null ? `${selectedTrip.duration_minutes} min` : '—'],
                ['Avg Speed', selectedTrip.avg_speed != null ? `${selectedTrip.avg_speed} km/h` : '—'],
                ['Max Speed', selectedTrip.max_speed != null ? `${selectedTrip.max_speed} km/h` : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: '#1a1a2e', borderRadius: 8, padding: '10px 16px', minWidth: 100 }}>
                  <div style={{ color: '#8892b0', fontSize: 11 }}>{label}</div>
                  <div style={{ color: '#ccd6f6', fontWeight: 600, fontSize: 18 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 300, borderRadius: 8, overflow: 'hidden' }}>
              {loadingPoints ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#8892b0' }}>
                  Loading route...
                </div>
              ) : (
                <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                  {tripPoints.length > 0 && (
                    <Polyline
                      positions={tripPoints.map((p) => [p.latitude, p.longitude] as [number, number])}
                      pathOptions={{ color: '#e94560', weight: 3 }}
                    />
                  )}
                </MapContainer>
              )}
            </div>
            {tripPoints.length === 0 && !loadingPoints && (
              <div style={{ color: '#8892b0', fontSize: 12, marginTop: 8 }}>No GPS route data available for this trip</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Trips;
