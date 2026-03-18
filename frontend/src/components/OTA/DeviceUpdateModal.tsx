import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface Firmware {
  id: string;
  version: string;
  filename: string;
  device_type: string | null;
  checksum: string;
}

interface Props {
  deviceIds: string[];
  onClose: () => void;
  onSuccess?: (updates: any[]) => void;
}

const DeviceUpdateModal: React.FC<Props> = ({ deviceIds, onClose, onSuccess }) => {
  const [firmwareList, setFirmwareList] = useState<Firmware[]>([]);
  const [selectedFirmwareId, setSelectedFirmwareId] = useState('');
  const [timing, setTiming] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get<Firmware[]>(`${API}/api/ota/firmware`).then(res => {
      setFirmwareList(res.data);
      if (res.data.length > 0) setSelectedFirmwareId(res.data[0].id);
    });
  }, []);

  const selectedFirmware = firmwareList.find(f => f.id === selectedFirmwareId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedFirmwareId) {
      setError('Please select a firmware version');
      return;
    }
    if (timing === 'scheduled' && !scheduledAt) {
      setError('Please set a scheduled date/time');
      return;
    }

    setLoading(true);
    try {
      if (timing === 'immediate' && deviceIds.length === 1) {
        // Single device immediate start
        const res = await axios.post(`${API}/api/ota/updates/${deviceIds[0]}/start`, {
          firmwareId: selectedFirmwareId,
        });
        onSuccess?.([res.data.update]);
      } else {
        // Batch schedule (immediate or timed)
        const res = await axios.post(`${API}/api/ota/updates/schedule`, {
          deviceIds,
          firmwareId: selectedFirmwareId,
          scheduledAt: timing === 'scheduled' ? scheduledAt : null,
        });
        onSuccess?.(res.data.updates);
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule update');
    } finally {
      setLoading(false);
    }
  };

  const estimatedMinutes = deviceIds.length * 5;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.title}>🔄 Schedule Firmware Update</h3>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Affected devices */}
          <div style={styles.section}>
            <label style={styles.label}>Affected Devices ({deviceIds.length})</label>
            <div style={styles.deviceList}>
              {deviceIds.map(id => (
                <span key={id} style={styles.deviceChip}>{id.slice(0, 12)}…</span>
              ))}
            </div>
          </div>

          {/* Firmware selection */}
          <div style={styles.section}>
            <label style={styles.label}>Target Firmware *</label>
            {firmwareList.length === 0 ? (
              <p style={styles.muted}>No firmware versions available. Upload one first.</p>
            ) : (
              <select
                style={styles.select}
                value={selectedFirmwareId}
                onChange={e => setSelectedFirmwareId(e.target.value)}
              >
                {firmwareList.map(fw => (
                  <option key={fw.id} value={fw.id}>
                    v{fw.version} — {fw.filename} {fw.device_type ? `(${fw.device_type})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Firmware details */}
          {selectedFirmware && (
            <div style={styles.fwPreview}>
              <span>📦 {selectedFirmware.filename}</span>
              <span style={styles.muted}>SHA256: {selectedFirmware.checksum.slice(0, 16)}…</span>
            </div>
          )}

          {/* Timing */}
          <div style={styles.section}>
            <label style={styles.label}>Update Timing</label>
            <div style={styles.radioGroup}>
              <label style={styles.radioLabel}>
                <input type="radio" value="immediate" checked={timing === 'immediate'} onChange={() => setTiming('immediate')} />
                {' '}Immediate
              </label>
              <label style={styles.radioLabel}>
                <input type="radio" value="scheduled" checked={timing === 'scheduled'} onChange={() => setTiming('scheduled')} />
                {' '}Scheduled
              </label>
            </div>
            {timing === 'scheduled' && (
              <input
                type="datetime-local"
                style={styles.input}
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
              />
            )}
          </div>

          {/* Estimated time */}
          <div style={styles.estimate}>
            ⏱ Estimated update time: ~{estimatedMinutes} min for {deviceIds.length} device{deviceIds.length !== 1 ? 's' : ''}
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.confirmBtn} disabled={loading || firmwareList.length === 0}>
              {loading ? 'Starting…' : timing === 'immediate' ? '🚀 Start Update' : '📅 Schedule Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { background: '#fff', borderRadius: 10, padding: '2rem', width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  title: { margin: '0 0 1.25rem', color: '#1a1a2e', fontSize: '1.2rem' },
  section: { marginBottom: '1rem' },
  label: { display: 'block', fontWeight: 600, marginBottom: 6, color: '#444', fontSize: 13 },
  select: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, marginTop: 8, boxSizing: 'border-box' },
  deviceList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  deviceChip: { background: '#f0f0f0', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontFamily: 'monospace' },
  fwPreview: { background: '#f8f9fa', borderRadius: 6, padding: '10px 14px', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 },
  radioGroup: { display: 'flex', gap: 20 },
  radioLabel: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 },
  estimate: { background: '#eaf4fb', padding: '10px 14px', borderRadius: 6, marginBottom: '1.25rem', fontSize: 13, color: '#2980b9' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '10px 20px', background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 },
  confirmBtn: { padding: '10px 20px', background: '#e94560', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  error: { background: '#fdecea', color: '#c0392b', padding: '10px 16px', borderRadius: 4, marginBottom: 16 },
  muted: { color: '#888', fontSize: 12 },
};

export default DeviceUpdateModal;
