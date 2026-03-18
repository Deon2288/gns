import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface Firmware {
  id: string;
  version: string;
  filename: string;
  file_size: number;
  checksum: string;
  changelog: string;
  device_type: string | null;
  compatible_devices: string[];
  upload_status: string;
  created_at: string;
}

const FirmwareManager: React.FC = () => {
  const [firmwareList, setFirmwareList] = useState<Firmware[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFirmware, setSelectedFirmware] = useState<Firmware | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    version: '',
    changelog: '',
    deviceType: '',
    compatibleDevices: '',
    minVersion: '',
    maxVersion: '',
  });

  const fetchFirmware = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Firmware[]>(`${API}/api/ota/firmware`);
      setFirmwareList(res.data);
    } catch (err: any) {
      setError('Failed to load firmware list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirmware();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Please select a firmware file');
      return;
    }
    if (!form.version.trim()) {
      setError('Firmware version is required');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', form.version.trim());
    formData.append('changelog', form.changelog);
    formData.append('deviceType', form.deviceType);
    formData.append('compatibleDevices', form.compatibleDevices);
    formData.append('minVersion', form.minVersion);
    formData.append('maxVersion', form.maxVersion);

    setUploading(true);
    setUploadProgress(0);
    try {
      await axios.post(`${API}/api/ota/firmware/upload`, formData, {
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      setSuccess('Firmware uploaded successfully');
      setForm({ version: '', changelog: '', deviceType: '', compatibleDevices: '', minVersion: '', maxVersion: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFirmware();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string, version: string) => {
    if (!window.confirm(`Delete firmware version "${version}"?`)) return;
    try {
      await axios.delete(`${API}/api/ota/firmware/${id}`);
      setSuccess(`Firmware ${version} deleted`);
      fetchFirmware();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>📦 Firmware Manager</h2>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Upload Form */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Upload Firmware</h3>
        <form onSubmit={handleUpload} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>Firmware File *</label>
            <input type="file" ref={fileInputRef} accept=".bin,.hex,.img,.fw,.ota,.zip" style={styles.input} />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Version *</label>
            <input
              style={styles.input}
              placeholder="e.g. 1.2.3"
              value={form.version}
              onChange={e => setForm({ ...form, version: e.target.value })}
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Device Type</label>
            <input
              style={styles.input}
              placeholder="e.g. GNS-100"
              value={form.deviceType}
              onChange={e => setForm({ ...form, deviceType: e.target.value })}
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Compatible Devices</label>
            <input
              style={styles.input}
              placeholder="Comma-separated device IDs"
              value={form.compatibleDevices}
              onChange={e => setForm({ ...form, compatibleDevices: e.target.value })}
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Min Version</label>
            <input
              style={styles.input}
              placeholder="e.g. 1.0.0"
              value={form.minVersion}
              onChange={e => setForm({ ...form, minVersion: e.target.value })}
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Max Version</label>
            <input
              style={styles.input}
              placeholder="e.g. 1.9.9"
              value={form.maxVersion}
              onChange={e => setForm({ ...form, maxVersion: e.target.value })}
            />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>Changelog</label>
            <textarea
              style={{ ...styles.input, height: 80, resize: 'vertical' }}
              placeholder="Describe changes in this release..."
              value={form.changelog}
              onChange={e => setForm({ ...form, changelog: e.target.value })}
            />
          </div>

          {uploading && (
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }} />
              <span style={styles.progressText}>{uploadProgress}%</span>
            </div>
          )}

          <button type="submit" disabled={uploading} style={styles.btn}>
            {uploading ? 'Uploading...' : '⬆ Upload Firmware'}
          </button>
        </form>
      </section>

      {/* Firmware List */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Firmware Versions</h3>
        {loading && <p style={styles.muted}>Loading...</p>}
        {!loading && firmwareList.length === 0 && (
          <p style={styles.muted}>No firmware versions uploaded yet.</p>
        )}
        <table style={styles.table}>
          <thead>
            <tr>
              {['Version', 'File', 'Size', 'Device Type', 'Status', 'Uploaded', 'Actions'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firmwareList.map(fw => (
              <tr key={fw.id} style={styles.tr}>
                <td style={styles.td}><strong>{fw.version}</strong></td>
                <td style={styles.td}>{fw.filename}</td>
                <td style={styles.td}>{formatSize(fw.file_size)}</td>
                <td style={styles.td}>{fw.device_type || '—'}</td>
                <td style={styles.td}>
                  <span style={statusBadge(fw.upload_status)}>{fw.upload_status}</span>
                </td>
                <td style={styles.td}>{new Date(fw.created_at).toLocaleString()}</td>
                <td style={styles.td}>
                  <button style={styles.btnSm} onClick={() => setSelectedFirmware(fw)}>Details</button>
                  {' '}
                  <button style={{ ...styles.btnSm, background: '#c0392b' }} onClick={() => handleDelete(fw.id, fw.version)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Firmware Details Modal */}
      {selectedFirmware && (
        <div style={styles.overlay} onClick={() => setSelectedFirmware(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.cardTitle}>Firmware v{selectedFirmware.version}</h3>
            <p><strong>File:</strong> {selectedFirmware.filename}</p>
            <p><strong>Size:</strong> {formatSize(selectedFirmware.file_size)}</p>
            <p style={{ wordBreak: 'break-all' }}><strong>SHA256:</strong> {selectedFirmware.checksum}</p>
            <p><strong>Device Type:</strong> {selectedFirmware.device_type || '—'}</p>
            <p><strong>Compatible Devices:</strong> {selectedFirmware.compatible_devices?.join(', ') || 'All'}</p>
            <p><strong>Status:</strong> {selectedFirmware.upload_status}</p>
            {selectedFirmware.changelog && (
              <>
                <p><strong>Changelog:</strong></p>
                <pre style={styles.pre}>{selectedFirmware.changelog}</pre>
              </>
            )}
            <button style={styles.btn} onClick={() => setSelectedFirmware(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

const statusBadge = (status: string): React.CSSProperties => ({
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 12,
  background: status === 'verified' ? '#27ae60' : status === 'failed' ? '#c0392b' : '#f39c12',
  color: '#fff',
  fontWeight: 600,
});

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
  heading: { color: '#e94560', marginBottom: '1rem' },
  card: { background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle: { marginTop: 0, marginBottom: '1rem', color: '#1a1a2e' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  row: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  label: { minWidth: 160, paddingTop: 8, fontWeight: 500, color: '#555' },
  input: { flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 },
  btn: { padding: '10px 20px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 14, alignSelf: 'flex-start' },
  btnSm: { padding: '4px 10px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f5f5f5', borderBottom: '2px solid #e0e0e0', fontSize: 13 },
  td: { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: 13 },
  tr: {},
  muted: { color: '#888', fontStyle: 'italic' },
  error: { background: '#fdecea', color: '#c0392b', padding: '10px 16px', borderRadius: 4, marginBottom: 16 },
  success: { background: '#eafaf1', color: '#27ae60', padding: '10px 16px', borderRadius: 4, marginBottom: 16 },
  progressBar: { height: 20, background: '#eee', borderRadius: 10, overflow: 'hidden', position: 'relative' },
  progressFill: { height: '100%', background: '#27ae60', transition: 'width 0.2s' },
  progressText: { position: 'absolute', right: 8, top: 2, fontSize: 12, color: '#555' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 8, padding: '2rem', maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' },
  pre: { background: '#f5f5f5', padding: '1rem', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};

export default FirmwareManager;
