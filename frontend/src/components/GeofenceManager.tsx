import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../store/useStore';
import { Geofence } from '../types';

const GeofenceManager: React.FC = () => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', shape_type: 'circle', center_lat: '', center_lon: '', radius_meters: '', speed_limit: '', alert_on_entry: true, alert_on_exit: true });
  const [error, setError] = useState('');

  const fetchGeofences = useCallback(async () => {
    try {
      const { data } = await api.get('/api/geofences');
      setGeofences(data);
    } catch { setError('Failed to load geofences'); }
  }, []);

  useEffect(() => { fetchGeofences(); }, [fetchGeofences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: form.name, description: form.description, shape_type: form.shape_type,
        alert_on_entry: form.alert_on_entry, alert_on_exit: form.alert_on_exit,
      };
      if (form.shape_type === 'circle') {
        payload.center_lat = parseFloat(form.center_lat);
        payload.center_lon = parseFloat(form.center_lon);
        payload.radius_meters = parseFloat(form.radius_meters);
      }
      if (form.speed_limit) payload.speed_limit = parseFloat(form.speed_limit);
      await api.post('/api/geofences', payload);
      setShowForm(false);
      setForm({ name: '', description: '', shape_type: 'circle', center_lat: '', center_lon: '', radius_meters: '', speed_limit: '', alert_on_entry: true, alert_on_exit: true });
      fetchGeofences();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create geofence');
    }
  };

  const toggleActive = async (g: Geofence) => {
    await api.put(`/api/geofences/${g.geofence_id}`, { active: !g.active });
    fetchGeofences();
  };

  const deleteGeofence = async (id: number) => {
    if (!window.confirm('Delete this geofence?')) return;
    await api.delete(`/api/geofences/${id}`);
    fetchGeofences();
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>📍 Geofence Manager</h2>
        <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>+ Add Geofence</button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <h3 style={{ margin: '0 0 16px' }}>New Geofence</h3>
          <div style={styles.formRow}>
            <Input label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
            <Input label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
          </div>
          <div style={styles.formRow}>
            <Select label="Shape" value={form.shape_type} onChange={(v) => setForm((f) => ({ ...f, shape_type: v }))}
              options={[{ value: 'circle', label: 'Circle' }, { value: 'polygon', label: 'Polygon' }]} />
            <Input label="Speed Limit (km/h)" value={form.speed_limit} onChange={(v) => setForm((f) => ({ ...f, speed_limit: v }))} type="number" />
          </div>
          {form.shape_type === 'circle' && (
            <div style={styles.formRow}>
              <Input label="Center Latitude *" value={form.center_lat} onChange={(v) => setForm((f) => ({ ...f, center_lat: v }))} type="number" required />
              <Input label="Center Longitude *" value={form.center_lon} onChange={(v) => setForm((f) => ({ ...f, center_lon: v }))} type="number" required />
              <Input label="Radius (meters) *" value={form.radius_meters} onChange={(v) => setForm((f) => ({ ...f, radius_meters: v }))} type="number" required />
            </div>
          )}
          <div style={styles.checkRow}>
            <label style={styles.checkLabel}><input type="checkbox" checked={form.alert_on_entry} onChange={(e) => setForm((f) => ({ ...f, alert_on_entry: e.target.checked }))} /> Alert on Entry</label>
            <label style={styles.checkLabel}><input type="checkbox" checked={form.alert_on_exit} onChange={(e) => setForm((f) => ({ ...f, alert_on_exit: e.target.checked }))} /> Alert on Exit</label>
          </div>
          <div style={styles.formActions}>
            <button type="submit" style={styles.saveBtn}>Save Geofence</button>
            <button type="button" onClick={() => setShowForm(false)} style={styles.cancelBtn}>Cancel</button>
          </div>
        </form>
      )}

      <div style={styles.grid}>
        {geofences.length === 0 && <div style={styles.empty}>No geofences defined yet</div>}
        {geofences.map((g) => (
          <div key={g.geofence_id} style={{ ...styles.card, opacity: g.active ? 1 : 0.6 }}>
            <div style={styles.cardHeader}>
              <span style={styles.geoName}>{g.name}</span>
              <span style={{ ...styles.shapeBadge, background: g.shape_type === 'circle' ? '#1976d2' : '#7b1fa2' }}>{g.shape_type}</span>
            </div>
            {g.description && <div style={styles.desc}>{g.description}</div>}
            <div style={styles.meta}>
              {g.shape_type === 'circle' && <span>📍 R={g.radius_meters}m</span>}
              {g.speed_limit && <span>⚡ {g.speed_limit} km/h</span>}
              <span>{g.alert_on_entry ? '🔔 Entry' : ''} {g.alert_on_exit ? '🔔 Exit' : ''}</span>
            </div>
            <div style={styles.cardActions}>
              <button onClick={() => toggleActive(g)} style={{ ...styles.actionBtn, background: g.active ? '#ff9800' : '#4caf50' }}>
                {g.active ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => deleteGeofence(g.geofence_id)} style={{ ...styles.actionBtn, background: '#f44336' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }> = ({ label, value, onChange, type = 'text', required = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <label style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }} />
  </div>
);

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ label, value, onChange, options }) => (
  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
    <label style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { margin: 0, color: '#1a1a2e' },
  addBtn: { background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  error: { background: '#ffebee', color: '#c62828', padding: '10px 16px', borderRadius: 6, marginBottom: 16 },
  form: { background: '#fff', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  formRow: { display: 'flex', gap: 12, marginBottom: 12 },
  checkRow: { display: 'flex', gap: 20, marginBottom: 16 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' },
  formActions: { display: 'flex', gap: 8 },
  saveBtn: { background: '#388e3c', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 13 },
  cancelBtn: { background: '#fff', color: '#555', border: '1px solid #ccc', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  empty: { textAlign: 'center', color: '#888', padding: 40, gridColumn: '1/-1' },
  card: { background: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  geoName: { fontWeight: 700, fontSize: 15, color: '#1a1a2e' },
  shapeBadge: { color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11 },
  desc: { color: '#666', fontSize: 12, marginBottom: 8 },
  meta: { display: 'flex', gap: 8, fontSize: 12, color: '#555', marginBottom: 12, flexWrap: 'wrap' },
  cardActions: { display: 'flex', gap: 8 },
  actionBtn: { color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
};

export default GeofenceManager;
