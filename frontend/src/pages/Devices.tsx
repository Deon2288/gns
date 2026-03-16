import React, { useEffect, useState } from 'react';
import { devices as devicesApi, deviceGroups as groupsApi } from '../services/api';
import { Device, DeviceGroup } from '../types';

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  offline: '#ef4444',
};

const emptyForm = {
  device_name: '',
  imei: '',
  model: '',
  sim_number: '',
  group_id: '',
  speed_limit: '',
};

const Devices: React.FC = () => {
  const [list, setList] = useState<Device[]>([]);
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([devicesApi.getAll(), groupsApi.getAll()])
      .then(([d, g]) => {
        setList(Array.isArray(d) ? d : d.devices || []);
        setGroups(Array.isArray(g) ? g : g.groups || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({
      device_name: d.device_name,
      imei: d.imei,
      model: d.model || '',
      sim_number: d.sim_number || '',
      group_id: d.group_id ? String(d.group_id) : '',
      speed_limit: d.speed_limit ? String(d.speed_limit) : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        group_id: form.group_id ? Number(form.group_id) : null,
        speed_limit: form.speed_limit ? Number(form.speed_limit) : null,
      };
      if (editing) {
        await devicesApi.update(editing.device_id, payload);
      } else {
        await devicesApi.create(payload);
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await devicesApi.delete(deleteId);
      setDeleteId(null);
      load();
    } catch {}
  };

  const filtered = list.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterGroup && String(d.group_id) !== filterGroup) return false;
    return true;
  });

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    filters: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const },
    select: { padding: '8px 12px', background: '#0f3460', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse' as const, background: '#0f3460', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '12px 14px', background: '#1a1a2e', color: '#8892b0', fontSize: 12, textAlign: 'left' as const, textTransform: 'uppercase' as const },
    td: { padding: '12px 14px', borderBottom: '1px solid #1a1a2e', fontSize: 13 },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#0f3460', borderRadius: 12, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    modalTitle: { color: '#ccd6f6', fontSize: 18, fontWeight: 600, marginBottom: 20 },
    field: { marginBottom: 16 },
    label: { display: 'block', color: '#8892b0', fontSize: 12, marginBottom: 6 },
    input: { width: '100%', padding: '9px 12px', background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' },
    modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
    cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #8892b0', borderRadius: 6, color: '#8892b0', cursor: 'pointer', fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Devices</h2>
        <button style={s.btn} onClick={openAdd}>+ Add Device</button>
      </div>

      <div style={s.filters}>
        <select style={s.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="online">Online</option>
          <option value="idle">Idle</option>
          <option value="offline">Offline</option>
        </select>
        <select style={s.select} value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
          <option value="">All Groups</option>
          {groups.map((g) => (
            <option key={g.group_id} value={String(g.group_id)}>{g.group_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ color: '#8892b0' }}>Loading...</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Name', 'IMEI', 'Model', 'Group', 'Status', 'Speed', 'Last Seen', 'Actions'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.device_id}>
                <td style={s.td}>{d.device_name}</td>
                <td style={{ ...s.td, color: '#8892b0', fontFamily: 'monospace', fontSize: 12 }}>{d.imei}</td>
                <td style={s.td}>{d.model || '—'}</td>
                <td style={s.td}>{d.group_name || '—'}</td>
                <td style={s.td}>
                  <span style={{
                    color: STATUS_COLOR[d.status],
                    background: STATUS_COLOR[d.status] + '22',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 12,
                    textTransform: 'capitalize',
                  }}>
                    {d.status}
                  </span>
                </td>
                <td style={s.td}>{d.last_speed != null ? `${d.last_speed} km/h` : '—'}</td>
                <td style={{ ...s.td, color: '#8892b0', fontSize: 12 }}>
                  {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                </td>
                <td style={s.td}>
                  <button
                    onClick={() => openEdit(d)}
                    style={{ ...s.btn, background: '#0ea5e9', padding: '4px 10px', fontSize: 12, marginRight: 6 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(d.device_id)}
                    style={{ ...s.btn, background: '#ef4444', padding: '4px 10px', fontSize: 12 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{editing ? 'Edit Device' : 'Add Device'}</h3>
            {(['device_name', 'imei', 'model', 'sim_number'] as const).map((field) => (
              <div key={field} style={s.field}>
                <label style={s.label}>{field.replace('_', ' ').toUpperCase()}</label>
                <input
                  style={s.input}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                />
              </div>
            ))}
            <div style={s.field}>
              <label style={s.label}>GROUP</label>
              <select style={{ ...s.input, cursor: 'pointer' }} value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
                <option value="">No Group</option>
                {groups.map((g) => <option key={g.group_id} value={String(g.group_id)}>{g.group_name}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>SPEED LIMIT (km/h)</label>
              <input style={s.input} type="number" value={form.speed_limit} onChange={(e) => setForm({ ...form, speed_limit: e.target.value })} />
            </div>
            {error && <div style={{ color: '#e94560', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={s.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: 360 }}>
            <h3 style={s.modalTitle}>Confirm Delete</h3>
            <p style={{ color: '#8892b0', fontSize: 14 }}>Are you sure you want to delete this device?</p>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setDeleteId(null)}>Cancel</button>
              <button style={{ ...s.btn, background: '#ef4444' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;
