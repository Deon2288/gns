import React, { useEffect, useState } from 'react';
import { deviceGroups as groupsApi } from '../services/api';
import { DeviceGroup } from '../types';

const PRESET_COLORS = ['#e94560', '#0ea5e9', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4'];

const emptyForm = { group_name: '', description: '', color: '#0ea5e9' };

const DeviceGroups: React.FC = () => {
  const [list, setList] = useState<DeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DeviceGroup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    groupsApi.getAll()
      .then((d: any) => setList(Array.isArray(d) ? d : d.groups || []))
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

  const openEdit = (g: DeviceGroup) => {
    setEditing(g);
    setForm({ group_name: g.group_name, description: g.description || '', color: g.color });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await groupsApi.update(editing.group_id, form);
      } else {
        await groupsApi.create(form);
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
      await groupsApi.delete(deleteId);
      setDeleteId(null);
      load();
    } catch {}
  };

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
    card: { background: '#0f3460', borderRadius: 10, padding: 20, position: 'relative' as const },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#0f3460', borderRadius: 12, padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
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
        <h2 style={s.title}>Device Groups</h2>
        <button style={s.btn} onClick={openAdd}>+ New Group</button>
      </div>

      {loading ? (
        <div style={{ color: '#8892b0' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ color: '#8892b0' }}>No groups yet. Create one to organize your devices.</div>
      ) : (
        <div style={s.grid}>
          {list.map((g) => (
            <div key={g.group_id} style={{ ...s.card, borderTop: `4px solid ${g.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color: '#ccd6f6', fontWeight: 600, fontSize: 16 }}>{g.group_name}</div>
                  {g.description && (
                    <div style={{ color: '#8892b0', fontSize: 12, marginTop: 4 }}>{g.description}</div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      background: g.color + '33',
                      color: g.color,
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 12,
                    }}>
                      {g.device_count} device{g.device_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => openEdit(g)}
                    style={{ ...s.btn, background: '#0ea5e9', padding: '4px 10px', fontSize: 12 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(g.group_id)}
                    style={{ ...s.btn, background: '#ef4444', padding: '4px 10px', fontSize: 12 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{editing ? 'Edit Group' : 'New Group'}</h3>
            <div style={s.field}>
              <label style={s.label}>GROUP NAME</label>
              <input style={s.input} value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>DESCRIPTION</label>
              <input style={s.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>COLOR</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      border: form.color === c ? '3px solid #fff' : '2px solid transparent',
                    }}
                  />
                ))}
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  style={{ width: 28, height: 28, border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'none' }} />
              </div>
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
            <p style={{ color: '#8892b0', fontSize: 14 }}>Delete this group? Devices in this group will not be deleted.</p>
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

export default DeviceGroups;
