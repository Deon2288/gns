import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeviceRow {
  device_id: number;
  device_name: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  last_seen?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '20px 24px',
  marginBottom: 24,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: '#94a3b8',
  fontWeight: 600,
  borderBottom: '1px solid #334155',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #1e293b',
  color: '#e2e8f0',
};

const inputStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid #475569',
  borderRadius: 6,
  color: '#f1f5f9',
  padding: '7px 12px',
  fontSize: 13,
  outline: 'none',
  width: 220,
};

const btnStyle = (color: string): React.CSSProperties => ({
  padding: '6px 14px',
  background: color,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  marginLeft: 6,
});

// ── Component ─────────────────────────────────────────────────────────────────

const DeviceAdmin: React.FC = () => {
  const [devices, setDevices]       = useState<DeviceRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [newName, setNewName]       = useState('');
  const [adding, setAdding]         = useState(false);
  const [editId, setEditId]         = useState<number | null>(null);
  const [editName, setEditName]     = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const token = localStorage.getItem('gns_token') || '';

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('gns_token') || ''}` };
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<DeviceRow[]>(`${API}/devices`, { headers });
      setDevices(data);
    } catch {
      setError('Failed to load devices. Are you logged in?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const { data } = await axios.post<DeviceRow>(`${API}/devices`, { device_name: newName.trim() }, { headers });
      setDevices((prev) => [...prev, data]);
      setNewName('');
    } catch {
      setError('Failed to add device.');
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    try {
      const { data } = await axios.put<DeviceRow>(`${API}/devices/${id}`, { device_name: editName.trim() }, { headers });
      setDevices((prev) => prev.map((d) => d.device_id === id ? data : d));
      setEditId(null);
    } catch {
      setError('Failed to rename device.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API}/devices/${id}`, { headers });
      setDevices((prev) => prev.filter((d) => d.device_id !== id));
      setConfirmDel(null);
    } catch {
      setError('Failed to delete device.');
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, color: '#f1f5f9', fontSize: 20 }}>Device Management</h2>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Add device */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#94a3b8', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Add New Device
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            style={inputStyle}
            placeholder="Device name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button style={btnStyle('#2563eb')} onClick={handleAdd} disabled={adding}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Device table */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>Loading…</div>
        ) : devices.length === 0 ? (
          <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>No devices yet. Add one above.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Last Position</th>
                <th style={thStyle}>Last Seen</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.device_id}>
                  <td style={{ ...tdStyle, color: '#64748b', fontSize: 11 }}>{d.device_id}</td>
                  <td style={tdStyle}>
                    {editId === d.device_id ? (
                      <input
                        style={{ ...inputStyle, width: 160 }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(d.device_id)}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{d.device_name}</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>
                    {d.latitude != null ? `${d.latitude.toFixed(5)}, ${d.longitude!.toFixed(5)}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#94a3b8' }}>
                    {d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#94a3b8' }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    {editId === d.device_id ? (
                      <>
                        <button style={btnStyle('#16a34a')} onClick={() => handleRename(d.device_id)}>Save</button>
                        <button style={btnStyle('#475569')} onClick={() => setEditId(null)}>Cancel</button>
                      </>
                    ) : confirmDel === d.device_id ? (
                      <>
                        <span style={{ color: '#f87171', fontSize: 12, marginRight: 8 }}>Delete?</span>
                        <button style={btnStyle('#dc2626')} onClick={() => handleDelete(d.device_id)}>Yes</button>
                        <button style={btnStyle('#475569')} onClick={() => setConfirmDel(null)}>No</button>
                      </>
                    ) : (
                      <>
                        <button style={btnStyle('#2563eb')} onClick={() => { setEditId(d.device_id); setEditName(d.device_name); }}>Rename</button>
                        <button style={btnStyle('#dc2626')} onClick={() => setConfirmDel(d.device_id)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DeviceAdmin;
