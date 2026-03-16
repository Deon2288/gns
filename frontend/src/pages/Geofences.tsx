import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { geofences as geofencesApi, devices as devicesApi } from '../services/api';
import { Geofence, Device } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TYPE_COLORS: Record<string, string> = { circle: '#0ea5e9', polygon: '#a855f7', route: '#22c55e' };

const emptyForm = {
  name: '',
  description: '',
  geofence_type: 'circle' as 'circle' | 'polygon' | 'route',
  coordinates: '',
  radius: '',
  color: '#0ea5e9',
};

const emptyAssign = { device_id: '', alert_on_enter: true, alert_on_exit: true };

const Geofences: React.FC = () => {
  const [list, setList] = useState<Geofence[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showAssign, setShowAssign] = useState<Geofence | null>(null);
  const [assignForm, setAssignForm] = useState(emptyAssign);

  const load = () => {
    Promise.all([geofencesApi.getAll(), devicesApi.getAll()])
      .then(([g, d]) => {
        setList(Array.isArray(g) ? g : g.geofences || []);
        setDevices(Array.isArray(d) ? d : d.devices || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (g: Geofence) => {
    setEditing(g);
    setForm({
      name: g.name,
      description: g.description || '',
      geofence_type: g.geofence_type,
      coordinates: JSON.stringify(g.coordinates),
      radius: g.radius != null ? String(g.radius) : '',
      color: g.color,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      let coords: Array<{ lat: number; lon: number }> = [];
      if (form.coordinates.trim()) {
        coords = JSON.parse(form.coordinates);
      }
      const payload = {
        name: form.name,
        description: form.description || null,
        geofence_type: form.geofence_type,
        coordinates: coords,
        radius: form.radius ? Number(form.radius) : null,
        color: form.color,
      };
      if (editing) {
        await geofencesApi.update(editing.geofence_id, payload);
      } else {
        await geofencesApi.create(payload);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Invalid coordinates JSON or save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this geofence?')) return;
    try { await geofencesApi.delete(id); load(); } catch {}
  };

  const handleAssign = async () => {
    if (!showAssign || !assignForm.device_id) return;
    try {
      await geofencesApi.assign(showAssign.geofence_id, {
        device_id: Number(assignForm.device_id),
        alert_on_enter: assignForm.alert_on_enter,
        alert_on_exit: assignForm.alert_on_exit,
      });
      setShowAssign(null);
    } catch {}
  };

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    layout: { display: 'flex', gap: 16, height: 'calc(100vh - 120px)' },
    listPanel: { width: 340, flexShrink: 0, overflowY: 'auto' as const },
    mapPanel: { flex: 1, borderRadius: 10, overflow: 'hidden' },
    card: { background: '#0f3460', borderRadius: 8, padding: 14, marginBottom: 10, cursor: 'pointer' },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#0f3460', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' as const },
    modalTitle: { color: '#ccd6f6', fontSize: 18, fontWeight: 600, marginBottom: 20 },
    field: { marginBottom: 14 },
    label: { display: 'block', color: '#8892b0', fontSize: 12, marginBottom: 6 },
    input: { width: '100%', padding: '9px 12px', background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' },
    modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
    cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #8892b0', borderRadius: 6, color: '#8892b0', cursor: 'pointer', fontSize: 13 },
  };

  const mapCenter: [number, number] = [20, 0];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Geofences</h2>
        <button style={s.btn} onClick={openAdd}>+ New Geofence</button>
      </div>

      {loading ? <div style={{ color: '#8892b0' }}>Loading...</div> : (
        <div style={s.layout}>
          <div style={s.listPanel}>
            {list.map((g) => (
              <div key={g.geofence_id} style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#ccd6f6', fontWeight: 600 }}>{g.name}</div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                      <span style={{
                        background: (TYPE_COLORS[g.geofence_type] || '#8892b0') + '33',
                        color: TYPE_COLORS[g.geofence_type] || '#8892b0',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11,
                      }}>
                        {g.geofence_type}
                      </span>
                      {g.radius != null && (
                        <span style={{ color: '#8892b0', fontSize: 11 }}>r={g.radius}m</span>
                      )}
                    </div>
                    {g.description && <div style={{ color: '#8892b0', fontSize: 12, marginTop: 4 }}>{g.description}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setShowAssign(g)} style={{ ...s.btn, background: '#22c55e', padding: '3px 8px', fontSize: 11 }}>Assign</button>
                    <button onClick={() => openEdit(g)} style={{ ...s.btn, background: '#0ea5e9', padding: '3px 8px', fontSize: 11 }}>Edit</button>
                    <button onClick={() => handleDelete(g.geofence_id)} style={{ ...s.btn, background: '#ef4444', padding: '3px 8px', fontSize: 11 }}>Del</button>
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && <div style={{ color: '#8892b0', fontSize: 13 }}>No geofences yet</div>}
          </div>

          <div style={s.mapPanel}>
            <MapContainer center={mapCenter} zoom={2} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {list.map((g) => {
                if (g.geofence_type === 'circle' && g.coordinates.length > 0 && g.radius) {
                  return (
                    <Circle
                      key={g.geofence_id}
                      center={[g.coordinates[0].lat, g.coordinates[0].lon]}
                      radius={g.radius}
                      pathOptions={{ color: g.color, fillColor: g.color, fillOpacity: 0.2 }}
                    />
                  );
                }
                if ((g.geofence_type === 'polygon' || g.geofence_type === 'route') && g.coordinates.length > 0) {
                  return (
                    <Polygon
                      key={g.geofence_id}
                      positions={g.coordinates.map((c) => [c.lat, c.lon] as [number, number])}
                      pathOptions={{ color: g.color, fillColor: g.color, fillOpacity: 0.2 }}
                    />
                  );
                }
                return null;
              })}
            </MapContainer>
          </div>
        </div>
      )}

      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{editing ? 'Edit Geofence' : 'New Geofence'}</h3>
            {(['name', 'description'] as const).map((field) => (
              <div key={field} style={s.field}>
                <label style={s.label}>{field.toUpperCase()}</label>
                <input style={s.input} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div style={s.field}>
              <label style={s.label}>TYPE</label>
              <select style={{ ...s.input, cursor: 'pointer' }} value={form.geofence_type} onChange={(e) => setForm({ ...form, geofence_type: e.target.value as any })}>
                <option value="circle">Circle</option>
                <option value="polygon">Polygon</option>
                <option value="route">Route</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>COLOR</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                style={{ width: 40, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
            </div>
            {form.geofence_type === 'circle' && (
              <div style={s.field}>
                <label style={s.label}>RADIUS (meters)</label>
                <input style={s.input} type="number" value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} />
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>
                COORDINATES (JSON array of {'{'}lat, lon{'}'} objects)
              </label>
              <textarea
                style={{ ...s.input, height: 80, resize: 'vertical' as const }}
                value={form.coordinates}
                onChange={(e) => setForm({ ...form, coordinates: e.target.value })}
                placeholder='[{"lat": 51.505, "lon": -0.09}]'
              />
            </div>
            {formError && <div style={{ color: '#e94560', fontSize: 13, marginBottom: 12 }}>{formError}</div>}
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={s.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showAssign && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 380 }}>
            <h3 style={s.modalTitle}>Assign Device to "{showAssign.name}"</h3>
            <div style={s.field}>
              <label style={s.label}>DEVICE</label>
              <select style={{ ...s.input, cursor: 'pointer' }} value={assignForm.device_id} onChange={(e) => setAssignForm({ ...assignForm, device_id: e.target.value })}>
                <option value="">Select device</option>
                {devices.map((d) => <option key={d.device_id} value={String(d.device_id)}>{d.device_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ccd6f6', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={assignForm.alert_on_enter} onChange={(e) => setAssignForm({ ...assignForm, alert_on_enter: e.target.checked })} />
                Alert on Enter
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#ccd6f6', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={assignForm.alert_on_exit} onChange={(e) => setAssignForm({ ...assignForm, alert_on_exit: e.target.checked })} />
                Alert on Exit
              </label>
            </div>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowAssign(null)}>Cancel</button>
              <button style={s.btn} onClick={handleAssign}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Geofences;
