import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/device-access';
const DEVICES_API = '/devices';

interface Device {
  device_id: number;
  device_name: string;
  status?: string;
  latency?: number | null;
  packet_loss?: number;
  snmp_name?: string;
  last_ping?: string;
}

interface Metrics {
  total_devices: number;
  icmp_stats: { reachable: number; unreachable: number; success_rate: number; average_latency_ms: number };
  snmp_stats: { responsive: number; unresponsive: number; success_rate: number };
  overall_health: string;
  last_updated: string;
}

interface SnmpQueryResult {
  oid: string;
  value: string | number;
  type: string;
}

const DeviceAccessDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pingResults, setPingResults] = useState<Record<number, Device>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ping' | 'snmp' | 'config' | 'diagnostics'>('dashboard');

  // SNMP query form
  const [snmpDeviceId, setSnmpDeviceId] = useState('');
  const [snmpOid, setSnmpOid] = useState('1.3.6.1.2.1.1.5.0');
  const [snmpResults, setSnmpResults] = useState<SnmpQueryResult[] | null>(null);

  // Diagnostics
  const [diagDeviceId, setDiagDeviceId] = useState('');
  const [diagResults, setDiagResults] = useState<Record<string, unknown> | null>(null);

  // Ping config
  const [pingConfig, setPingConfig] = useState({
    enabled: true, method: 'icmp', interval: 60, timeout: 5000,
    packet_size: 56, ttl: 64, parallel_pings: 10,
    alert_on_timeout: true, alert_threshold: 3, packet_loss_threshold: 10,
  });

  // SNMP config
  const [snmpConfig, setSnmpConfig] = useState({
    enabled: true, version: '2c', community_string: 'public',
    timeout: 5000, retries: 3, port: 161,
    poll_interval: 300, parallel_queries: 10,
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      if (res.ok) setMetrics(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch(DEVICES_API, {
        headers: { authorization: localStorage.getItem('token') || '' },
      });
      if (res.ok) setDevices(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const [pc, sc] = await Promise.all([
        fetch(`${API_BASE}/ping-config`),
        fetch(`${API_BASE}/snmp-config`),
      ]);
      if (pc.ok) {
        const d = await pc.json();
        setPingConfig({
          enabled: d.enabled ?? true,
          method: d.method ?? 'icmp',
          interval: d.interval_seconds ?? 60,
          timeout: d.timeout_ms ?? 5000,
          packet_size: d.packet_size ?? 56,
          ttl: d.ttl ?? 64,
          parallel_pings: d.parallel_pings ?? 10,
          alert_on_timeout: d.alert_on_timeout ?? true,
          alert_threshold: d.alert_threshold ?? 3,
          packet_loss_threshold: parseFloat(d.packet_loss_threshold) ?? 10,
        });
      }
      if (sc.ok) {
        const d = await sc.json();
        setSnmpConfig({
          enabled: d.enabled ?? true,
          version: d.version ?? '2c',
          community_string: d.community_string ?? 'public',
          timeout: d.timeout_ms ?? 5000,
          retries: d.retries ?? 3,
          port: d.port ?? 161,
          poll_interval: d.poll_interval_seconds ?? 300,
          parallel_queries: d.parallel_queries ?? 10,
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchDevices();
    fetchConfigs();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchDevices, fetchConfigs]);

  const pingDevice = async (deviceId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ping/${deviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 4, timeout: 5000 }),
      });
      const data = await res.json();
      if (res.ok) {
        setPingResults(prev => ({ ...prev, [deviceId]: data }));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const pingAll = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/ping-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 2, timeout: 3000 }),
      });
      const data = await res.json();
      if (res.ok) {
        const resultsMap: Record<number, Device> = {};
        for (const detail of data.details || []) {
          resultsMap[detail.device_id] = detail;
        }
        setPingResults(resultsMap);
        setMessage(`✅ Pinged ${data.total_devices} devices — ${data.reachable} reachable, ${data.unreachable} unreachable`);
        fetchMetrics();
      }
    } catch {
      setMessage('❌ Ping-all failed');
    } finally {
      setLoading(false);
    }
  };

  const runSnmpQuery = async () => {
    if (!snmpDeviceId || !snmpOid) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/snmp/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: parseInt(snmpDeviceId), oid: snmpOid }),
      });
      const data = await res.json();
      if (res.ok) {
        setSnmpResults([{ oid: data.oid, value: data.value, type: data.type }]);
      } else {
        setMessage(`❌ SNMP Error: ${data.error}`);
      }
    } catch {
      setMessage('❌ SNMP query failed');
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setDiagResults(null);
    try {
      const res = await fetch(`${API_BASE}/diagnostics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_vpn_connection: true,
          test_device_ping: !!diagDeviceId,
          test_snmp_connectivity: !!diagDeviceId,
          device_id: diagDeviceId ? parseInt(diagDeviceId) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) setDiagResults(data);
    } catch {
      setMessage('❌ Diagnostics failed');
    } finally {
      setLoading(false);
    }
  };

  const savePingConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ping-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pingConfig),
      });
      setMessage(res.ok ? '✅ Ping configuration saved' : '❌ Failed to save ping config');
    } catch {
      setMessage('❌ Request failed');
    } finally {
      setLoading(false);
    }
  };

  const saveSnmpConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/snmp-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snmpConfig),
      });
      setMessage(res.ok ? '✅ SNMP configuration saved' : '❌ Failed to save SNMP config');
    } catch {
      setMessage('❌ Request failed');
    } finally {
      setLoading(false);
    }
  };

  const healthColor = (health?: string) => {
    switch (health) {
      case 'excellent': return '#22c55e';
      case 'good': return '#84cc16';
      case 'fair': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  const statusIcon = (status?: string) => {
    if (!status) return '⬜';
    if (status === 'reachable' || status === 'online') return '✅';
    if (status === 'timeout' || status === 'offline') return '❌';
    return '⚠️';
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📡 Device Accessibility Dashboard</h2>

      {message && (
        <div style={{ ...styles.alert, backgroundColor: message.startsWith('✅') ? '#dcfce7' : '#fee2e2' }}>
          {message}
          <button style={styles.closeBtn} onClick={() => setMessage('')}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {([
          ['dashboard', '📊 Overview'],
          ['ping', '🔍 ICMP Ping'],
          ['snmp', '📋 SNMP'],
          ['config', '⚙️ Config'],
          ['diagnostics', '🔧 Diagnostics'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'dashboard' && (
        <div>
          {metrics ? (
            <>
              <div style={styles.metricsGrid}>
                <StatCard label="Total Devices" value={metrics.total_devices} />
                <StatCard
                  label="ICMP Reachable"
                  value={`${metrics.icmp_stats.reachable} / ${metrics.total_devices}`}
                  sub={`${metrics.icmp_stats.success_rate}%`}
                />
                <StatCard
                  label="Avg Latency"
                  value={`${metrics.icmp_stats.average_latency_ms} ms`}
                />
                <StatCard
                  label="SNMP Responsive"
                  value={`${metrics.snmp_stats.responsive} / ${metrics.total_devices}`}
                  sub={`${metrics.snmp_stats.success_rate}%`}
                />
                <div style={{ ...styles.statCard, borderTop: `4px solid ${healthColor(metrics.overall_health)}` }}>
                  <span style={styles.statLabel}>Overall Health</span>
                  <span style={{ ...styles.statValue, color: healthColor(metrics.overall_health), textTransform: 'capitalize' }}>
                    {metrics.overall_health}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' }}>
                Last updated: {new Date(metrics.last_updated).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>
              No metrics available yet. Run a ping or SNMP query to populate data.
            </p>
          )}

          {/* Device table */}
          {devices.length > 0 && (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['ID', 'Name', 'IP', 'Ping Status', 'Latency', 'Packet Loss', 'Action'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map(device => {
                  const pr = pingResults[device.device_id];
                  return (
                    <tr key={device.device_id} style={styles.tr}>
                      <td style={styles.td}>{device.device_id}</td>
                      <td style={styles.td}>{device.device_name}</td>
                      <td style={styles.td}>{`192.168.50.${100 + device.device_id}`}</td>
                      <td style={styles.td}>
                        {pr ? `${statusIcon(pr.status)} ${pr.status}` : '—'}
                      </td>
                      <td style={styles.td}>{pr?.latency != null ? `${pr.latency} ms` : '—'}</td>
                      <td style={styles.td}>{pr?.packet_loss != null ? `${pr.packet_loss}%` : '—'}</td>
                      <td style={styles.td}>
                        <button
                          style={{ ...styles.btnSm, background: '#3b82f6', color: '#fff' }}
                          onClick={() => pingDevice(device.device_id)}
                          disabled={loading}
                        >
                          Ping
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── PING TAB ── */}
      {activeTab === 'ping' && (
        <div>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>🔍 Bulk ICMP Ping</h3>
            <p style={{ color: '#6b7280', marginBottom: 12 }}>
              Ping all registered devices through the VPN tunnel to the core network.
            </p>
            <button
              style={{ ...styles.btn, background: '#3b82f6', color: '#fff' }}
              onClick={pingAll}
              disabled={loading}
            >
              {loading ? 'Pinging...' : '▶ Ping All Devices'}
            </button>
          </div>

          {Object.keys(pingResults).length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Ping Results</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Device ID', 'Name', 'IP', 'Status', 'Latency', 'Packet Loss'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(pingResults).map((pr: Device) => (
                    <tr key={pr.device_id} style={styles.tr}>
                      <td style={styles.td}>{pr.device_id}</td>
                      <td style={styles.td}>{pr.device_name || '—'}</td>
                      <td style={styles.td}>{`192.168.50.${100 + pr.device_id}`}</td>
                      <td style={styles.td}>{statusIcon(pr.status)} {pr.status}</td>
                      <td style={styles.td}>{pr.latency != null ? `${pr.latency} ms` : '—'}</td>
                      <td style={styles.td}>{pr.packet_loss != null ? `${pr.packet_loss}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SNMP TAB ── */}
      {activeTab === 'snmp' && (
        <div>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>📋 SNMP Query</h3>
            <div style={styles.formRow}>
              <label style={styles.label}>
                Device ID
                <input
                  style={styles.input}
                  type="number"
                  placeholder="e.g. 1"
                  value={snmpDeviceId}
                  onChange={e => setSnmpDeviceId(e.target.value)}
                />
              </label>
              <label style={styles.label}>
                OID
                <input
                  style={styles.input}
                  placeholder="1.3.6.1.2.1.1.5.0"
                  value={snmpOid}
                  onChange={e => setSnmpOid(e.target.value)}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {[
                ['sysName', '1.3.6.1.2.1.1.5.0'],
                ['sysDescr', '1.3.6.1.2.1.1.1.0'],
                ['sysUpTime', '1.3.6.1.2.1.1.3.0'],
                ['sysLocation', '1.3.6.1.2.1.1.6.0'],
              ].map(([label, oid]) => (
                <button
                  key={oid}
                  style={{ ...styles.btnSm, background: '#e2e8f0', color: '#374151' }}
                  onClick={() => setSnmpOid(oid)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              style={{ ...styles.btn, background: '#7c3aed', color: '#fff', marginTop: 12 }}
              onClick={runSnmpQuery}
              disabled={loading || !snmpDeviceId}
            >
              {loading ? 'Querying...' : '▶ Run Query'}
            </button>
          </div>

          {snmpResults && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Results</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['OID', 'Value', 'Type'].map(h => <th key={h} style={styles.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {snmpResults.map((r, i) => (
                    <tr key={i} style={styles.tr}>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12 }}>{r.oid}</td>
                      <td style={styles.td}>{String(r.value)}</td>
                      <td style={styles.td}>{r.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIG TAB ── */}
      {activeTab === 'config' && (
        <div>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>🔍 ICMP Ping Configuration</h3>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Enabled
                <select style={styles.input} value={String(pingConfig.enabled)}
                  onChange={e => setPingConfig(c => ({ ...c, enabled: e.target.value === 'true' }))}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label style={styles.label}>
                Method
                <select style={styles.input} value={pingConfig.method}
                  onChange={e => setPingConfig(c => ({ ...c, method: e.target.value }))}>
                  <option value="icmp">ICMP</option>
                  <option value="tcp-syn">TCP SYN</option>
                  <option value="udp">UDP</option>
                </select>
              </label>
              <label style={styles.label}>
                Interval (sec)
                <input style={styles.input} type="number" value={pingConfig.interval}
                  onChange={e => setPingConfig(c => ({ ...c, interval: parseInt(e.target.value) || 60 }))} />
              </label>
              <label style={styles.label}>
                Timeout (ms)
                <input style={styles.input} type="number" value={pingConfig.timeout}
                  onChange={e => setPingConfig(c => ({ ...c, timeout: parseInt(e.target.value) || 5000 }))} />
              </label>
              <label style={styles.label}>
                Parallel Pings
                <input style={styles.input} type="number" value={pingConfig.parallel_pings}
                  onChange={e => setPingConfig(c => ({ ...c, parallel_pings: parseInt(e.target.value) || 10 }))} />
              </label>
              <label style={styles.label}>
                Alert Threshold (failures)
                <input style={styles.input} type="number" value={pingConfig.alert_threshold}
                  onChange={e => setPingConfig(c => ({ ...c, alert_threshold: parseInt(e.target.value) || 3 }))} />
              </label>
            </div>
            <button style={{ ...styles.btn, background: '#22c55e', color: '#fff', marginTop: 12 }}
              onClick={savePingConfig} disabled={loading}>
              💾 Save Ping Config
            </button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>📋 SNMP Configuration</h3>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Enabled
                <select style={styles.input} value={String(snmpConfig.enabled)}
                  onChange={e => setSnmpConfig(c => ({ ...c, enabled: e.target.value === 'true' }))}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label style={styles.label}>
                SNMP Version
                <select style={styles.input} value={snmpConfig.version}
                  onChange={e => setSnmpConfig(c => ({ ...c, version: e.target.value }))}>
                  <option value="1">v1</option>
                  <option value="2c">v2c</option>
                  <option value="3">v3</option>
                </select>
              </label>
              <label style={styles.label}>
                Community String
                <input style={styles.input} value={snmpConfig.community_string}
                  onChange={e => setSnmpConfig(c => ({ ...c, community_string: e.target.value }))} />
              </label>
              <label style={styles.label}>
                Timeout (ms)
                <input style={styles.input} type="number" value={snmpConfig.timeout}
                  onChange={e => setSnmpConfig(c => ({ ...c, timeout: parseInt(e.target.value) || 5000 }))} />
              </label>
              <label style={styles.label}>
                Retries
                <input style={styles.input} type="number" value={snmpConfig.retries}
                  onChange={e => setSnmpConfig(c => ({ ...c, retries: parseInt(e.target.value) || 3 }))} />
              </label>
              <label style={styles.label}>
                Port
                <input style={styles.input} type="number" value={snmpConfig.port}
                  onChange={e => setSnmpConfig(c => ({ ...c, port: parseInt(e.target.value) || 161 }))} />
              </label>
              <label style={styles.label}>
                Poll Interval (sec)
                <input style={styles.input} type="number" value={snmpConfig.poll_interval}
                  onChange={e => setSnmpConfig(c => ({ ...c, poll_interval: parseInt(e.target.value) || 300 }))} />
              </label>
            </div>
            <button style={{ ...styles.btn, background: '#7c3aed', color: '#fff', marginTop: 12 }}
              onClick={saveSnmpConfig} disabled={loading}>
              💾 Save SNMP Config
            </button>
          </div>
        </div>
      )}

      {/* ── DIAGNOSTICS TAB ── */}
      {activeTab === 'diagnostics' && (
        <div>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>🔧 Run Diagnostics</h3>
            <label style={{ ...styles.label, marginBottom: 12 }}>
              Device ID (optional – for ping/SNMP test)
              <input style={styles.input} type="number" placeholder="e.g. 1"
                value={diagDeviceId}
                onChange={e => setDiagDeviceId(e.target.value)} />
            </label>
            <button
              style={{ ...styles.btn, background: '#f59e0b', color: '#fff' }}
              onClick={runDiagnostics}
              disabled={loading}
            >
              {loading ? 'Running...' : '▶ Run Diagnostics'}
            </button>
          </div>

          {diagResults && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Results</h3>
              {Object.entries(diagResults).map(([key, val]) => {
                if (key === 'recommendations') return null;
                return (
                  <div key={key} style={styles.diagSection}>
                    <h4 style={{ textTransform: 'capitalize', color: '#374151' }}>
                      {key.replace(/_/g, ' ')}
                    </h4>
                    <pre style={styles.pre}>{JSON.stringify(val, null, 2)}</pre>
                  </div>
                );
              })}
              {Array.isArray((diagResults as { recommendations?: string[] }).recommendations) && (
                <div>
                  <h4 style={{ color: '#374151' }}>💡 Recommendations</h4>
                  <ul>
                    {((diagResults as { recommendations: string[] }).recommendations).map((r, i) => (
                      <li key={i} style={{ padding: '4px 0', color: '#374151' }}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
  <div style={styles.statCard}>
    <span style={styles.statLabel}>{label}</span>
    <span style={styles.statValue}>{value}</span>
    {sub && <span style={styles.statSub}>{sub}</span>}
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: 'sans-serif', padding: 24, maxWidth: 1100, margin: '0 auto' },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
  alert: { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  tabs: { display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 20, flexWrap: 'wrap' },
  tab: { padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500, fontSize: 13, borderBottom: '2px solid transparent', marginBottom: -2 },
  activeTab: { borderBottomColor: '#3b82f6', color: '#3b82f6', fontWeight: 700 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 16 },
  statCard: { background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 4 },
  statLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 22, fontWeight: 700, color: '#1e293b' },
  statSub: { fontSize: 12, color: '#6b7280' },
  card: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { background: '#f1f5f9', padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e2e8f0' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f1f5f9' },
  tr: { transition: 'background 0.15s' },
  formRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff' },
  btn: { padding: '10px 20px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnSm: { padding: '4px 10px', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500, fontSize: 12 },
  diagSection: { marginBottom: 12 },
  pre: { background: '#1e293b', color: '#e2e8f0', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto', margin: 0 },
};

export default DeviceAccessDashboard;
