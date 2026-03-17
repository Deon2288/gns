import React, { useState, useEffect, useRef } from 'react';

const API_BASE = '/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Device {
  device_id: number;
  device_name: string;
  ip_address: string;
  mac_address?: string;
  model?: string;
  firmware?: string;
  device_type?: string;
  status?: string;
  last_seen?: string;
  location?: string;
  snmp_community?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  created_at?: string;
}

interface ScanResult {
  ip_address: string;
  hostname?: string;
  status: string;
  ports?: Array<{ port: number; service: string }>;
  latency?: string;
  device_type?: string;
  model?: string;
}

interface Scan {
  scan_id: string;
  ip_range: string;
  status: string;
  discovered_count: number;
  total_hosts: number;
  results?: ScanResult[];
  created_at: string;
}

interface Metric {
  metric_id: number;
  device_id: number;
  metric_type: string;
  value: number;
  unit: string;
  timestamp: string;
}

interface Alert {
  alert_id: number;
  device_id: number;
  device_name?: string;
  ip_address?: string;
  alert_type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  app: { minHeight: '100vh', background: '#0f0f1a', color: '#e0e0e0' },
  header: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #2a2a4a',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  logo: { fontSize: 22, fontWeight: 700, color: '#00d4ff', letterSpacing: 2 },
  nav: { display: 'flex', gap: 4 },
  navBtn: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: active ? '#00d4ff22' : 'transparent',
    border: active ? '1px solid #00d4ff' : '1px solid transparent',
    borderRadius: 6,
    color: active ? '#00d4ff' : '#aaa',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    transition: 'all 0.2s',
  }),
  content: { padding: 24, maxWidth: 1400, margin: '0 auto' },
  card: {
    background: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: 600, color: '#00d4ff', marginBottom: 16 },
  input: {
    background: '#0f0f1a',
    border: '1px solid #2a2a4a',
    borderRadius: 6,
    color: '#e0e0e0',
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
    width: '100%',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #00d4ff, #0099cc)',
    border: 'none',
    borderRadius: 6,
    color: '#000',
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  },
  btnDanger: {
    background: 'linear-gradient(135deg, #ff4444, #cc0000)',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  btnSuccess: {
    background: 'linear-gradient(135deg, #00cc66, #009944)',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: {
    background: '#0f0f1a',
    padding: '10px 12px',
    textAlign: 'left' as const,
    color: '#00d4ff',
    fontWeight: 600,
    borderBottom: '1px solid #2a2a4a',
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #1a1a2e',
    color: '#ccc',
    verticalAlign: 'middle' as const,
  },
  trHover: {
    background: '#1e1e3a',
  },
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color: color,
    border: '1px solid ' + color + '44',
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  statCard: {
    background: '#1a1a2e',
    border: '1px solid #2a2a4a',
    borderRadius: 10,
    padding: 16,
    textAlign: 'center' as const,
  },
  statValue: { fontSize: 28, fontWeight: 700, color: '#00d4ff' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  row: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const },
  label: { fontSize: 12, color: '#888', marginBottom: 4 },
  formGroup: { marginBottom: 16 },
  checkbox: { marginRight: 8, cursor: 'pointer' },
  progress: (pct: number): React.CSSProperties => ({
    height: 6,
    background: '#2a2a4a',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  }),
  progressBar: (pct: number): React.CSSProperties => ({
    width: `${pct}%`,
    height: '100%',
    background: pct > 80 ? '#ff4444' : pct > 60 ? '#ffaa00' : '#00cc66',
    borderRadius: 3,
    transition: 'width 0.5s',
  }),
  spinnerWrap: { display: 'flex', alignItems: 'center', gap: 10, color: '#00d4ff' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    online: '#00cc66',
    offline: '#ff4444',
    unknown: '#888',
    running: '#00d4ff',
    completed: '#00cc66',
    error: '#ff4444',
    timeout: '#ffaa00',
    pending: '#ffaa00',
  };
  const c = colors[status || 'unknown'] || '#888';
  return <span style={styles.badge(c)}>{status || 'unknown'}</span>;
}

function Spinner() {
  return (
    <div style={styles.spinnerWrap}>
      <div style={{ width: 16, height: 16, border: '2px solid #00d4ff44', borderTopColor: '#00d4ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span>Loading...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ─── Discovery Tab ────────────────────────────────────────────────────────────
function DiscoveryTab({ onDevicesRegistered }: { onDevicesRegistered: () => void }) {
  const [ipRange, setIpRange] = useState('172.28.0.0/24');
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startScan = async () => {
    setScanning(true);
    setMessage('');
    setScan(null);
    setSelected(new Set());
    try {
      const data = await apiFetch('/discovery/scan', {
        method: 'POST',
        body: JSON.stringify({ ipRange, ports: [80, 161], timeout: 5000 }),
      });
      const scanId = data.scan_id;

      // Poll for results
      pollRef.current = setInterval(async () => {
        try {
          const result = await apiFetch(`/discovery/results/${scanId}`);
          setScan(result);
          if (result.status === 'completed' || result.status === 'error' || result.status === 'timeout') {
            if (pollRef.current) clearInterval(pollRef.current);
            setScanning(false);
            setMessage(result.status === 'completed' ? `✅ Found ${result.discovered_count} devices` : `❌ Scan ${result.status}`);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          setScanning(false);
        }
      }, 2000);
    } catch (err: unknown) {
      setScanning(false);
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Scan failed'));
    }
  };

  const toggleSelect = (ip: string) => {
    const next = new Set(selected);
    if (next.has(ip)) next.delete(ip);
    else next.add(ip);
    setSelected(next);
  };

  const selectAll = () => {
    if (!scan?.results) return;
    if (selected.size === scan.results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(scan.results.map(d => d.ip_address)));
    }
  };

  const registerSelected = async () => {
    if (!scan?.results) return;
    const devicesToRegister = scan.results.filter(d => selected.has(d.ip_address));
    setRegistering(true);
    try {
      const data = await apiFetch('/discovery/register', {
        method: 'POST',
        body: JSON.stringify({ devices: devicesToRegister }),
      });
      setMessage(`✅ Registered ${data.registered?.length || 0} devices`);
      onDevicesRegistered();
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Registration failed'));
    } finally {
      setRegistering(false);
    }
  };

  const registerAll = async () => {
    if (!scan?.results) return;
    setSelected(new Set(scan.results.map(d => d.ip_address)));
    setRegistering(true);
    try {
      const data = await apiFetch('/discovery/register', {
        method: 'POST',
        body: JSON.stringify({ devices: scan.results }),
      });
      setMessage(`✅ Registered ${data.registered?.length || 0} devices`);
      onDevicesRegistered();
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Registration failed'));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>🔍 Network Discovery Scanner</div>
        <div style={styles.row}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={styles.label}>IP Range (CIDR)</div>
            <input style={styles.input} value={ipRange} onChange={e => setIpRange(e.target.value)} placeholder="172.28.0.0/24" />
          </div>
          <div style={{ paddingTop: 20 }}>
            <button style={styles.btnPrimary} onClick={startScan} disabled={scanning}>
              {scanning ? '⏳ Scanning...' : '🔍 Scan Network'}
            </button>
          </div>
        </div>
        {message && <div style={{ marginTop: 12, padding: '8px 12px', background: '#ffffff11', borderRadius: 6, fontSize: 13 }}>{message}</div>}
      </div>

      {scanning && !scan && (
        <div style={styles.card}>
          <Spinner />
          <p style={{ marginTop: 10, fontSize: 13, color: '#888' }}>Running nmap scan on {ipRange}... This may take 15-30 seconds.</p>
        </div>
      )}

      {scan && (
        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span style={styles.cardTitle}>Scan Results </span>
              <StatusBadge status={scan.status} />
              {scan.discovered_count > 0 && (
                <span style={{ marginLeft: 12, color: '#888', fontSize: 13 }}>
                  {scan.discovered_count} devices found
                </span>
              )}
            </div>
            {scan.results && scan.results.length > 0 && (
              <div style={styles.row}>
                <button style={{ ...styles.btnPrimary, fontSize: 12 }} onClick={selectAll}>
                  {selected.size === scan.results.length ? 'Deselect All' : 'Select All'}
                </button>
                <button style={{ ...styles.btnSuccess, fontSize: 12 }} onClick={registerSelected} disabled={selected.size === 0 || registering}>
                  {registering ? 'Registering...' : `Register Selected (${selected.size})`}
                </button>
                <button style={{ ...styles.btnPrimary, fontSize: 12 }} onClick={registerAll} disabled={registering}>
                  {registering ? 'Registering...' : 'Register All'}
                </button>
              </div>
            )}
          </div>

          {scan.results && scan.results.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}><input type="checkbox" onChange={selectAll} checked={selected.size === scan.results.length && scan.results.length > 0} /></th>
                  <th style={styles.th}>IP Address</th>
                  <th style={styles.th}>Hostname</th>
                  <th style={styles.th}>Latency</th>
                  <th style={styles.th}>Open Ports</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {scan.results.map(d => (
                  <tr key={d.ip_address} style={selected.has(d.ip_address) ? styles.trHover : {}}>
                    <td style={styles.td}>
                      <input type="checkbox" style={styles.checkbox} checked={selected.has(d.ip_address)} onChange={() => toggleSelect(d.ip_address)} />
                    </td>
                    <td style={styles.td}><code style={{ color: '#00d4ff' }}>{d.ip_address}</code></td>
                    <td style={styles.td}>{d.hostname || '—'}</td>
                    <td style={styles.td}>{d.latency || '—'}</td>
                    <td style={styles.td}>{d.ports?.map(p => `${p.port}/${p.service}`).join(', ') || '—'}</td>
                    <td style={styles.td}><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : scan.status === 'completed' ? (
            <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No devices found in range {scan.ip_range}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Device Management Tab ────────────────────────────────────────────────────
function DeviceManagementTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/devices');
      setDevices(data.devices || []);
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Failed to load devices'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDevices(); }, []);

  const deleteDevice = async (id: number) => {
    if (!window.confirm('Delete this device?')) return;
    try {
      await apiFetch(`/devices/${id}`, { method: 'DELETE' });
      setMessage('✅ Device deleted');
      loadDevices();
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Delete failed'));
    }
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} devices?`)) return;
    try {
      await apiFetch('/devices', { method: 'DELETE', body: JSON.stringify({ ids: Array.from(selected) }) });
      setMessage(`✅ Deleted ${selected.size} devices`);
      setSelected(new Set());
      loadDevices();
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Bulk delete failed'));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const filtered = devices.filter(d =>
    d.device_name.toLowerCase().includes(search.toLowerCase()) ||
    d.ip_address.includes(search) ||
    (d.model || '').toLowerCase().includes(search.toLowerCase())
  );

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;

  return (
    <div>
      <div style={styles.grid}>
        <div style={styles.statCard}><div style={styles.statValue}>{devices.length}</div><div style={styles.statLabel}>Total Devices</div></div>
        <div style={styles.statCard}><div style={{ ...styles.statValue, color: '#00cc66' }}>{online}</div><div style={styles.statLabel}>Online</div></div>
        <div style={styles.statCard}><div style={{ ...styles.statValue, color: '#ff4444' }}>{offline}</div><div style={styles.statLabel}>Offline</div></div>
        <div style={styles.statCard}><div style={{ ...styles.statValue, color: '#888' }}>{devices.length - online - offline}</div><div style={styles.statLabel}>Unknown</div></div>
      </div>

      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={styles.cardTitle}>📋 Device Registry</div>
          <div style={styles.row}>
            <input style={{ ...styles.input, width: 200 }} placeholder="Search devices..." value={search} onChange={e => setSearch(e.target.value)} />
            <button style={styles.btnPrimary} onClick={loadDevices}>🔄 Refresh</button>
            {selected.size > 0 && (
              <button style={styles.btnDanger} onClick={bulkDelete}>🗑 Delete ({selected.size})</button>
            )}
          </div>
        </div>

        {message && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#ffffff11', borderRadius: 6, fontSize: 13 }}>{message}</div>}

        {loading ? <Spinner /> : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}><input type="checkbox" onChange={() => {
                  if (selected.size === filtered.length) setSelected(new Set());
                  else setSelected(new Set(filtered.map(d => d.device_id)));
                }} /></th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>IP Address</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Last Seen</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.device_id}>
                  <td style={styles.td}><input type="checkbox" style={styles.checkbox} checked={selected.has(d.device_id)} onChange={() => toggleSelect(d.device_id)} /></td>
                  <td style={styles.td}><strong style={{ color: '#fff' }}>{d.device_name}</strong></td>
                  <td style={styles.td}><code style={{ color: '#00d4ff' }}>{d.ip_address}</code></td>
                  <td style={styles.td}>{d.model || '—'}</td>
                  <td style={styles.td}>{d.device_type || '—'}</td>
                  <td style={styles.td}><StatusBadge status={d.status} /></td>
                  <td style={styles.td}>{d.last_seen ? new Date(d.last_seen).toLocaleString() : '—'}</td>
                  <td style={styles.td}>
                    <div style={styles.row}>
                      <button style={{ ...styles.btnPrimary, padding: '4px 10px', fontSize: 12 }} onClick={() => setEditDevice(d)}>✏️ Edit</button>
                      <button style={{ ...styles.btnDanger, padding: '4px 10px', fontSize: 12 }} onClick={() => deleteDevice(d.device_id)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No devices found. Use Discovery tab to scan and register devices.</p>}
      </div>

      {editDevice && (
        <EditDeviceModal device={editDevice} onClose={() => setEditDevice(null)} onSaved={() => { setEditDevice(null); loadDevices(); }} />
      )}
    </div>
  );
}

function EditDeviceModal({ device, onClose, onSaved }: { device: Device; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ device_name: device.device_name, model: device.model || '', location: device.location || '', snmp_community: device.snmp_community || 'public', device_type: device.device_type || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/devices/${device.device_id}/update`, { method: 'POST', body: JSON.stringify(form) });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
  const modalStyle: React.CSSProperties = { background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12, padding: 24, width: 400 };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ ...styles.cardTitle, marginBottom: 16 }}>✏️ Edit Device - {device.ip_address}</div>
        {error && <div style={{ color: '#ff4444', marginBottom: 12, fontSize: 13 }}>{error}</div>}
        {(['device_name', 'model', 'location', 'snmp_community', 'device_type'] as const).map(field => (
          <div key={field} style={styles.formGroup}>
            <div style={styles.label}>{field.replace(/_/g, ' ').toUpperCase()}</div>
            <input style={styles.input} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
          </div>
        ))}
        <div style={{ ...styles.row, justifyContent: 'flex-end', marginTop: 8 }}>
          <button style={{ ...styles.btnPrimary, background: '#333', color: '#fff' }} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── SNMP Monitoring Tab ──────────────────────────────────────────────────────
function SNMPMonitoringTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [latestMetrics, setLatestMetrics] = useState<Record<string, Metric>>({});
  const [polling, setPolling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch('/devices').then(d => setDevices(d.devices || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDevice) return;
    loadMetrics(selectedDevice);
  }, [selectedDevice]);

  const loadMetrics = async (deviceId: number) => {
    setLoading(true);
    try {
      const [hist, latest] = await Promise.all([
        apiFetch(`/snmp/metrics/${deviceId}?limit=200`),
        apiFetch(`/snmp/metrics/${deviceId}/latest`),
      ]);
      setMetrics(hist.metrics || []);
      const latestMap: Record<string, Metric> = {};
      for (const m of (latest.metrics || [])) latestMap[m.metric_type] = m;
      setLatestMetrics(latestMap);
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Failed to load metrics'));
    } finally {
      setLoading(false);
    }
  };

  const startPolling = async () => {
    setPolling(true);
    try {
      await apiFetch('/snmp/poll/start', { method: 'POST', body: JSON.stringify({ interval: 300000 }) });
      setMessage('✅ SNMP polling started (every 5 minutes)');
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Failed to start polling'));
      setPolling(false);
    }
  };

  const pollNow = async () => {
    try {
      setMessage('⏳ Polling all devices...');
      const data = await apiFetch('/snmp/poll/now', { method: 'POST' });
      setMessage(`✅ Poll complete: ${data.results?.successes || 0} success, ${data.results?.failures || 0} failed`);
      if (selectedDevice) loadMetrics(selectedDevice);
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Poll failed'));
    }
  };

  const metricColor = (type: string, value: number) => {
    if (type.includes('cpu') || type.includes('memory_used')) {
      return value > 80 ? '#ff4444' : value > 60 ? '#ffaa00' : '#00cc66';
    }
    return '#00d4ff';
  };

  const cpuMetrics = metrics.filter(m => m.metric_type === 'cpu_load_1m').slice(0, 50).reverse();
  const memMetrics = metrics.filter(m => m.metric_type === 'memory_used_pct').slice(0, 50).reverse();

  return (
    <div>
      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: 'space-between' }}>
          <div style={styles.cardTitle}>📊 SNMP Monitoring Control</div>
          <div style={styles.row}>
            <button style={styles.btnPrimary} onClick={pollNow}>⚡ Poll Now</button>
            <button style={{ ...styles.btnSuccess, opacity: polling ? 0.7 : 1 }} onClick={startPolling} disabled={polling}>
              {polling ? '✅ Polling Active' : '▶️ Start Auto-Poll (5min)'}
            </button>
          </div>
        </div>
        {message && <div style={{ marginTop: 12, padding: '8px 12px', background: '#ffffff11', borderRadius: 6, fontSize: 13 }}>{message}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div style={styles.card}>
          <div style={{ ...styles.cardTitle, marginBottom: 12 }}>Devices ({devices.length})</div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {devices.map(d => (
              <div
                key={d.device_id}
                onClick={() => setSelectedDevice(d.device_id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedDevice === d.device_id ? '#00d4ff11' : 'transparent',
                  border: selectedDevice === d.device_id ? '1px solid #00d4ff44' : '1px solid transparent',
                  marginBottom: 4,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{d.device_name}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{d.ip_address}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {selectedDevice ? (
            <>
              <div style={styles.grid}>
                {Object.entries(latestMetrics).map(([type, m]) => (
                  <div key={type} style={styles.statCard}>
                    <div style={{ ...styles.statValue, fontSize: 22, color: metricColor(type, m.value) }}>
                      {m.value?.toFixed(1)}{m.unit !== 'seconds' ? m.unit : ''}
                    </div>
                    <div style={styles.statLabel}>{type.replace(/_/g, ' ')}</div>
                    {type.includes('pct') && (
                      <div style={{ ...styles.progress(m.value), marginTop: 8 }}>
                        <div style={styles.progressBar(m.value)} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {loading && <Spinner />}

              {cpuMetrics.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.cardTitle}>CPU Load (1min) - Last {cpuMetrics.length} readings</div>
                  <SimpleLineChart data={cpuMetrics.map(m => ({ time: new Date(m.timestamp).toLocaleTimeString(), value: m.value }))} color="#00d4ff" unit="%" />
                </div>
              )}

              {memMetrics.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Memory Usage % - Last {memMetrics.length} readings</div>
                  <SimpleLineChart data={memMetrics.map(m => ({ time: new Date(m.timestamp).toLocaleTimeString(), value: m.value }))} color="#00cc66" unit="%" />
                </div>
              )}

              {!loading && Object.keys(latestMetrics).length === 0 && (
                <div style={styles.card}>
                  <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No metrics yet for this device. Click "Poll Now" to collect SNMP data.</p>
                </div>
              )}
            </>
          ) : (
            <div style={styles.card}>
              <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>Select a device from the list to view SNMP metrics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SimpleLineChart({ data, color, unit }: { data: Array<{ time: string; value: number }>; color: string; unit: string }) {
  if (data.length < 2) return <p style={{ color: '#888', fontSize: 13 }}>Not enough data points</p>;
  const width = 600;
  const height = 120;
  const pad = { top: 10, right: 20, bottom: 30, left: 40 };
  const maxV = Math.max(...data.map(d => d.value));
  const minV = Math.min(...data.map(d => d.value));
  const range = maxV - minV || 1;
  const xStep = (width - pad.left - pad.right) / (data.length - 1);
  const yScale = (v: number) => pad.top + ((maxV - v) / range) * (height - pad.top - pad.bottom);
  const points = data.map((d, i) => `${pad.left + i * xStep},${yScale(d.value)}`).join(' ');
  const areaPoints = `${pad.left},${height - pad.bottom} ${points} ${pad.left + (data.length - 1) * xStep},${height - pad.bottom}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 120 }}>
      <polygon points={areaPoints} fill={color} fillOpacity="0.1" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0).map((d, i, arr) => {
        const origIdx = data.findIndex(x => x === d);
        return (
          <text key={i} x={pad.left + origIdx * xStep} y={height - 8} fontSize="9" fill="#666" textAnchor="middle">{d.time}</text>
        );
      })}
      <text x={pad.left - 5} y={yScale(maxV) + 4} fontSize="9" fill="#666" textAnchor="end">{maxV.toFixed(0)}{unit}</text>
      <text x={pad.left - 5} y={yScale(minV) + 4} fontSize="9" fill="#666" textAnchor="end">{minV.toFixed(0)}{unit}</text>
    </svg>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [message, setMessage] = useState('');

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/snmp/alerts?is_resolved=${showResolved}&limit=100`);
      setAlerts(data.alerts || []);
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Failed to load alerts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, [showResolved]);

  const resolveAlert = async (alertId: number) => {
    try {
      await apiFetch(`/snmp/alerts/${alertId}/resolve`, { method: 'POST' });
      setMessage('✅ Alert resolved');
      loadAlerts();
    } catch (err: unknown) {
      setMessage('❌ ' + (err instanceof Error ? err.message : 'Failed to resolve'));
    }
  };

  const severityColor = (severity: string) => ({ critical: '#ff0000', high: '#ff4444', warning: '#ffaa00', info: '#00d4ff' }[severity] || '#888');

  return (
    <div>
      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: 'space-between' }}>
          <div style={styles.cardTitle}>🚨 Device Alerts</div>
          <div style={styles.row}>
            <label style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} style={{ marginRight: 6 }} />
              Show Resolved
            </label>
            <button style={styles.btnPrimary} onClick={loadAlerts}>🔄 Refresh</button>
          </div>
        </div>
        {message && <div style={{ marginTop: 12, padding: '8px 12px', background: '#ffffff11', borderRadius: 6, fontSize: 13 }}>{message}</div>}
      </div>

      <div style={styles.card}>
        {loading ? <Spinner /> : alerts.length === 0 ? (
          <p style={{ color: '#00cc66', textAlign: 'center', padding: 20 }}>✅ No {showResolved ? '' : 'active '}alerts</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Severity</th>
                <th style={styles.th}>Device</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Message</th>
                <th style={styles.th}>Time</th>
                {!showResolved && <th style={styles.th}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {alerts.map(a => (
                <tr key={a.alert_id}>
                  <td style={styles.td}><span style={styles.badge(severityColor(a.severity))}>{a.severity}</span></td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{a.device_name || `Device #${a.device_id}`}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{a.ip_address}</div>
                  </td>
                  <td style={styles.td}>{a.alert_type}</td>
                  <td style={styles.td}>{a.message}</td>
                  <td style={styles.td}>{new Date(a.created_at).toLocaleString()}</td>
                  {!showResolved && (
                    <td style={styles.td}>
                      <button style={{ ...styles.btnSuccess, padding: '4px 10px', fontSize: 12 }} onClick={() => resolveAlert(a.alert_id)}>✓ Resolve</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Health Dashboard Tab ─────────────────────────────────────────────────────
function HealthDashboardTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/devices');
      setDevices(data.devices || []);
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const unknown = devices.length - online - offline;
  const healthPct = devices.length ? Math.round((online / devices.length) * 100) : 0;

  return (
    <div>
      <div style={{ ...styles.card, background: 'linear-gradient(135deg, #1a2a1a, #0f1a0f)', borderColor: '#00cc6644' }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: healthPct > 80 ? '#00cc66' : healthPct > 50 ? '#ffaa00' : '#ff4444' }}>{healthPct}%</div>
          <div style={{ fontSize: 18, color: '#888', marginTop: 4 }}>Network Health</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>Last updated: {lastRefresh.toLocaleTimeString()}</div>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={{ ...styles.statCard, borderColor: '#00cc6644' }}><div style={{ ...styles.statValue, color: '#00cc66' }}>{online}</div><div style={styles.statLabel}>🟢 Online</div></div>
        <div style={{ ...styles.statCard, borderColor: '#ff444444' }}><div style={{ ...styles.statValue, color: '#ff4444' }}>{offline}</div><div style={styles.statLabel}>🔴 Offline</div></div>
        <div style={{ ...styles.statCard, borderColor: '#88888844' }}><div style={{ ...styles.statValue, color: '#888' }}>{unknown}</div><div style={styles.statLabel}>⚪ Unknown</div></div>
        <div style={styles.statCard}><div style={styles.statValue}>{devices.length}</div><div style={styles.statLabel}>📡 Total Devices</div></div>
      </div>

      <div style={styles.card}>
        <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={styles.cardTitle}>🌐 Network Overview - 172.28.0.0/24</div>
          <button style={styles.btnPrimary} onClick={loadData}>🔄 Refresh</button>
        </div>
        {loading ? <Spinner /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {devices.map(d => (
              <div key={d.device_id} style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: d.status === 'online' ? '#00cc6611' : d.status === 'offline' ? '#ff444411' : '#88888811',
                border: `1px solid ${d.status === 'online' ? '#00cc6633' : d.status === 'offline' ? '#ff444433' : '#88888833'}`,
              }}>
                <div style={{ fontSize: 11, color: '#00d4ff', fontFamily: 'monospace' }}>{d.ip_address}</div>
                <div style={{ fontSize: 12, color: '#fff', marginTop: 2, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.device_name}</div>
                <div style={{ marginTop: 4 }}><StatusBadge status={d.status} /></div>
                {d.last_seen && <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{new Date(d.last_seen).toLocaleTimeString()}</div>}
              </div>
            ))}
          </div>
        )}
        {!loading && devices.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No devices registered. Go to Discovery tab to scan and register devices.</p>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    apiFetch('/devices').then(d => setDevices(d.devices || [])).catch(() => {});
  }, []);

  const byType: Record<string, number> = {};
  for (const d of devices) byType[d.device_type || 'unknown'] = (byType[d.device_type || 'unknown'] || 0) + 1;

  return (
    <div>
      <div style={styles.grid}>
        <div style={styles.statCard}><div style={styles.statValue}>{devices.length}</div><div style={styles.statLabel}>Total Devices</div></div>
        <div style={styles.statCard}><div style={{ ...styles.statValue, color: '#00cc66' }}>{devices.filter(d => d.status === 'online').length}</div><div style={styles.statLabel}>Online</div></div>
        {Object.entries(byType).map(([type, count]) => (
          <div key={type} style={styles.statCard}><div style={styles.statValue}>{count}</div><div style={styles.statLabel}>{type}</div></div>
        ))}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>📈 Device Registration Timeline</div>
        {devices.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 20 }}>No data yet</p>
        ) : (
          <p style={{ color: '#888', fontSize: 13, padding: 10 }}>
            Devices registered over time will appear here once GPS trip data is collected.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
type Tab = 'health' | 'discovery' | 'devices' | 'snmp' | 'alerts' | 'analytics';

export default function App() {
  const [tab, setTab] = useState<Tab>('health');
  const [deviceRefresh, setDeviceRefresh] = useState(0);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'health', label: '🏥 Health' },
    { id: 'discovery', label: '🔍 Discovery' },
    { id: 'devices', label: '📋 Devices' },
    { id: 'snmp', label: '📊 SNMP' },
    { id: 'alerts', label: '🚨 Alerts' },
    { id: 'analytics', label: '📈 Analytics' },
  ];

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo}>GNS</div>
        <nav style={styles.nav}>
          {tabs.map(t => (
            <button key={t.id} style={styles.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div style={{ fontSize: 12, color: '#555' }}>
          172.28.0.0/24 · Teltonika RUTX12
        </div>
      </header>
      <main style={styles.content}>
        {tab === 'health' && <HealthDashboardTab key={deviceRefresh} />}
        {tab === 'discovery' && <DiscoveryTab onDevicesRegistered={() => setDeviceRefresh(r => r + 1)} />}
        {tab === 'devices' && <DeviceManagementTab key={deviceRefresh} />}
        {tab === 'snmp' && <SNMPMonitoringTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'analytics' && <AnalyticsTab />}
      </main>
    </div>
  );
}
