import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface OTAUpdate {
  id: string;
  device_id: string;
  firmware_id: string;
  status: string;
  progress_percentage: number;
  current_step: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'completed' | 'failed' | 'cancelled' | 'rolled_back' | 'pending' | 'installing';

const UpdateHistory: React.FC = () => {
  const [history, setHistory] = useState<OTAUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, any[]>>({});

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<OTAUpdate[]>(`${API}/api/ota/updates/history`);
      setHistory(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchLogs = async (deviceId: string) => {
    try {
      const res = await axios.get(`${API}/api/ota/updates/${deviceId}`);
      setLogs(prev => ({ ...prev, [res.data.update.id]: res.data.logs }));
    } catch { /* ignore */ }
  };

  const toggleExpand = (update: OTAUpdate) => {
    if (expandedId === update.id) {
      setExpandedId(null);
    } else {
      setExpandedId(update.id);
      if (!logs[update.id]) fetchLogs(update.device_id);
    }
  };

  const filtered = history.filter(u => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (deviceFilter && !u.device_id.includes(deviceFilter)) return false;
    if (dateFrom && new Date(u.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(u.created_at) > new Date(dateTo)) return false;
    return true;
  });

  const exportCsv = () => {
    const headers = ['id', 'device_id', 'firmware_id', 'status', 'progress', 'started_at', 'completed_at', 'created_at'];
    const rows = filtered.map(u => [
      u.id, u.device_id, u.firmware_id, u.status,
      u.progress_percentage,
      u.started_at || '', u.completed_at || '', u.created_at,
    ].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ota-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const duration = (u: OTAUpdate) => {
    if (!u.started_at || !u.completed_at) return '—';
    const ms = new Date(u.completed_at).getTime() - new Date(u.started_at).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.heading}>📋 Update History</h2>
        <button style={styles.exportBtn} onClick={exportCsv} disabled={filtered.length === 0}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Status</label>
          <select style={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
            {['all', 'completed', 'failed', 'cancelled', 'rolled_back', 'pending', 'installing'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Device ID</label>
          <input style={styles.input} placeholder="Filter by device ID" value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>From</label>
          <input type="date" style={styles.input} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>To</label>
          <input type="date" style={styles.input} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button style={styles.clearBtn} onClick={() => { setStatusFilter('all'); setDeviceFilter(''); setDateFrom(''); setDateTo(''); }}>
          Clear
        </button>
      </div>

      <p style={styles.count}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>

      {loading && <p style={styles.muted}>Loading...</p>}

      {/* Timeline */}
      <div style={styles.timeline}>
        {!loading && filtered.length === 0 && (
          <p style={styles.muted}>No update history found.</p>
        )}
        {filtered.map(u => (
          <div key={u.id} style={styles.timelineItem}>
            <div style={{ ...styles.timelineDot, background: statusColor(u.status) }} />
            <div style={styles.timelineContent}>
              <div style={styles.timelineHeader} onClick={() => toggleExpand(u)}>
                <div style={styles.timelineMain}>
                  <span style={statusBadge(u.status)}>{u.status}</span>
                  <span style={styles.deviceId}><code>{u.device_id.slice(0, 16)}…</code></span>
                  <span style={styles.fwId}>fw: <code>{u.firmware_id.slice(0, 8)}…</code></span>
                </div>
                <div style={styles.timelineMeta}>
                  <span>⏱ {duration(u)}</span>
                  <span style={styles.dateStr}>{new Date(u.created_at).toLocaleString()}</span>
                  <span style={styles.expandBtn}>{expandedId === u.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {u.error_message && (
                <div style={styles.errorMsg}>⚠ {u.error_message}</div>
              )}

              {expandedId === u.id && (
                <div style={styles.logsSection}>
                  <p style={styles.logsTitle}>Update Logs</p>
                  {(logs[u.id] || []).length === 0 ? (
                    <p style={styles.muted}>No logs available.</p>
                  ) : (
                    <div style={styles.logsList}>
                      {(logs[u.id] || []).map((log: any) => (
                        <div key={log.id} style={{ ...styles.logEntry, ...logLevelStyle(log.level) }}>
                          <span style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span style={styles.logLevel}>[{log.level}]</span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const statusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#27ae60';
    case 'failed': return '#c0392b';
    case 'cancelled': return '#e67e22';
    case 'rolled_back': return '#8e44ad';
    case 'installing': return '#2980b9';
    default: return '#95a5a6';
  }
};

const statusBadge = (status: string): React.CSSProperties => ({
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 11,
  background: statusColor(status),
  color: '#fff',
  fontWeight: 600,
});

const logLevelStyle = (level: string): React.CSSProperties => ({
  color: level === 'error' ? '#c0392b' : level === 'warning' ? '#e67e22' : '#2c3e50',
  background: level === 'error' ? '#fdecea' : level === 'warning' ? '#fef9e7' : 'transparent',
});

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem', maxWidth: 1100, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  heading: { color: '#e94560', margin: 0 },
  exportBtn: { padding: '8px 16px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  filterRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem', background: '#fff', padding: '1rem', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabel: { fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase' },
  select: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 },
  input: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 },
  clearBtn: { padding: '7px 14px', background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, alignSelf: 'flex-end' },
  count: { color: '#888', fontSize: 13, marginBottom: '0.75rem' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 0 },
  timelineItem: { display: 'flex', gap: 16, marginBottom: '0.5rem' },
  timelineDot: { width: 14, height: 14, borderRadius: '50%', marginTop: 14, flexShrink: 0 },
  timelineContent: { flex: 1, background: '#fff', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', overflow: 'hidden' },
  timelineHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' },
  timelineMain: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  timelineMeta: { display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#888' },
  deviceId: { fontSize: 13 },
  fwId: { fontSize: 12, color: '#888' },
  dateStr: { fontSize: 12 },
  expandBtn: { cursor: 'pointer', color: '#aaa', fontSize: 12 },
  errorMsg: { padding: '6px 16px', background: '#fdecea', color: '#c0392b', fontSize: 12 },
  logsSection: { borderTop: '1px solid #eee', padding: '12px 16px' },
  logsTitle: { fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#555' },
  logsList: { display: 'flex', flexDirection: 'column', gap: 3 },
  logEntry: { display: 'flex', gap: 8, fontSize: 12, padding: '3px 6px', borderRadius: 3 },
  logTime: { color: '#aaa', minWidth: 75 },
  logLevel: { fontWeight: 700, minWidth: 60 },
  muted: { color: '#888', fontStyle: 'italic', fontSize: 13 },
};

export default UpdateHistory;
