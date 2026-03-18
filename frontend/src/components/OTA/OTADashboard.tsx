import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';

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
  updated_at: string;
}

interface UpdateWithLogs {
  update: OTAUpdate;
  logs: any[];
}

type StatusFilter = 'all' | 'pending' | 'scheduled' | 'downloading' | 'installing' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
type SortKey = 'device_id' | 'progress_percentage' | 'status' | 'updated_at';

const OTADashboard: React.FC = () => {
  const [updates, setUpdates] = useState<OTAUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<OTAUpdate[]>(`${API}/api/ota/updates/history`);
      setUpdates(res.data);
    } catch {
      // silently fail; ws will keep updates fresh
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket connection for live updates
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        setWsStatus('connecting');

        ws.onopen = () => setWsStatus('connected');
        ws.onclose = () => {
          setWsStatus('disconnected');
          // Reconnect after 5 seconds
          setTimeout(connect, 5000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (['update_scheduled', 'update_started', 'update_progress'].includes(msg.event)) {
              const incoming: OTAUpdate = msg.data;
              setUpdates(prev => {
                const idx = prev.findIndex(u => u.id === incoming.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = incoming;
                  return next;
                }
                return [incoming, ...prev];
              });
            }
          } catch { /* ignore parse errors */ }
        };
      } catch {
        setWsStatus('disconnected');
      }
    };

    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleCancel = async (deviceId: string) => {
    try {
      await axios.post(`${API}/api/ota/updates/${deviceId}/cancel`);
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Cancel failed');
    }
  };

  const handleRollback = async (deviceId: string) => {
    if (!window.confirm(`Rollback device "${deviceId}" to previous firmware?`)) return;
    try {
      await axios.post(`${API}/api/ota/updates/${deviceId}/rollback`);
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rollback failed');
    }
  };

  const filtered = updates.filter(
    u => statusFilter === 'all' || u.status === statusFilter
  );

  const sorted = [...filtered].sort((a, b) => {
    let av: any = a[sortKey];
    let bv: any = b[sortKey];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const sortArrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.heading}>🔄 OTA Dashboard</h2>
        <div style={styles.wsIndicator}>
          <span style={{ ...styles.wsDot, background: wsStatus === 'connected' ? '#27ae60' : wsStatus === 'connecting' ? '#f39c12' : '#c0392b' }} />
          {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
          <button style={styles.refreshBtn} onClick={fetchHistory}>↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <label style={styles.filterLabel}>Status:</label>
        {(['all', 'pending', 'scheduled', 'downloading', 'installing', 'completed', 'failed', 'cancelled'] as StatusFilter[]).map(s => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(statusFilter === s ? styles.filterBtnActive : {}) }}
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {(['pending', 'downloading', 'installing', 'completed', 'failed'] as StatusFilter[]).map(s => (
          <div key={s} style={styles.statCard}>
            <div style={{ ...styles.statNum, color: statusColor(s) }}>{updates.filter(u => u.status === s).length}</div>
            <div style={styles.statLabel}>{s}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <section style={styles.card}>
        {loading && <p style={styles.muted}>Loading...</p>}
        {!loading && sorted.length === 0 && <p style={styles.muted}>No updates found.</p>}
        {sorted.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th} onClick={() => handleSort('device_id')}>Device{sortArrow('device_id')}</th>
                <th style={styles.th}>Firmware</th>
                <th style={styles.th} onClick={() => handleSort('status')}>Status{sortArrow('status')}</th>
                <th style={styles.th} onClick={() => handleSort('progress_percentage')}>Progress{sortArrow('progress_percentage')}</th>
                <th style={styles.th}>Current Step</th>
                <th style={styles.th} onClick={() => handleSort('updated_at')}>Updated{sortArrow('updated_at')}</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(u => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}><code>{u.device_id.slice(0, 8)}…</code></td>
                  <td style={styles.td}><code>{u.firmware_id.slice(0, 8)}…</code></td>
                  <td style={styles.td}><span style={statusBadge(u.status)}>{u.status}</span></td>
                  <td style={styles.td}>
                    <div style={styles.miniBar}>
                      <div style={{ ...styles.miniFill, width: `${u.progress_percentage}%`, background: progressColor(u.progress_percentage, u.status) }} />
                    </div>
                    <span style={styles.pct}>{u.progress_percentage}%</span>
                  </td>
                  <td style={styles.td}>{u.current_step || '—'}</td>
                  <td style={styles.td}>{new Date(u.updated_at).toLocaleTimeString()}</td>
                  <td style={styles.td}>
                    {['pending', 'scheduled', 'downloading', 'installing'].includes(u.status) && (
                      <button style={{ ...styles.actionBtn, background: '#e67e22' }} onClick={() => handleCancel(u.device_id)}>Cancel</button>
                    )}
                    {u.status === 'completed' && (
                      <button style={{ ...styles.actionBtn, background: '#8e44ad' }} onClick={() => handleRollback(u.device_id)}>Rollback</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

const statusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#27ae60';
    case 'failed': return '#c0392b';
    case 'installing': return '#2980b9';
    case 'downloading': return '#f39c12';
    case 'pending': return '#95a5a6';
    default: return '#555';
  }
};

const progressColor = (progress: number, status: string) => {
  if (status === 'failed') return '#c0392b';
  if (status === 'completed') return '#27ae60';
  return progress > 60 ? '#27ae60' : progress > 30 ? '#f39c12' : '#2980b9';
};

const statusBadge = (status: string): React.CSSProperties => ({
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 11,
  background: statusColor(status),
  color: '#fff',
  fontWeight: 600,
  whiteSpace: 'nowrap',
});

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  heading: { color: '#e94560', margin: 0 },
  wsIndicator: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555' },
  wsDot: { width: 10, height: 10, borderRadius: '50%', display: 'inline-block' },
  refreshBtn: { marginLeft: 12, padding: '4px 12px', background: '#2980b9', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  filterBar: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' },
  filterLabel: { fontWeight: 600, color: '#555', fontSize: 13 },
  filterBtn: { padding: '4px 12px', border: '1px solid #ddd', borderRadius: 16, cursor: 'pointer', fontSize: 12, background: '#fff', color: '#555' },
  filterBtnActive: { background: '#e94560', color: '#fff', border: '1px solid #e94560', fontWeight: 600 },
  statsRow: { display: 'flex', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' },
  statCard: { background: '#fff', borderRadius: 8, padding: '12px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', textAlign: 'center', minWidth: 90 },
  statNum: { fontSize: 28, fontWeight: 700 },
  statLabel: { fontSize: 12, color: '#888', textTransform: 'capitalize' },
  card: { background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '1.5rem', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', background: '#f5f5f5', borderBottom: '2px solid #e0e0e0', fontSize: 13, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: 13, verticalAlign: 'middle' },
  tr: {},
  miniBar: { display: 'inline-block', width: 80, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', verticalAlign: 'middle', marginRight: 6 },
  miniFill: { height: '100%', transition: 'width 0.3s' },
  pct: { fontSize: 12, color: '#555' },
  actionBtn: { padding: '3px 10px', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  muted: { color: '#888', fontStyle: 'italic' },
};

export default OTADashboard;
