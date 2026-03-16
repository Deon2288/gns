import React, { useState, useEffect } from 'react';

const API_BASE = '/api/vpn-bridge';

interface VpnConfig {
  vpn_id?: string;
  connection_name: string;
  vpn_type: string;
  core_host: string;
  core_port: number;
  protocol: string;
  auth_method: string;
  vpn_subnet: string;
  gns_vpn_ip: string;
  core_vpn_ip: string;
  device_subnet: string;
  routes: string[];
  status?: string;
  is_active?: boolean;
}

interface VpnStatus {
  connected: boolean;
  status: string;
  connection_uptime?: string;
  vpn_ip?: string;
  core_ip?: string;
  bandwidth?: { uploaded: number; downloaded: number; current_rate: string };
  latency?: number;
  packet_loss?: number;
  connection_quality?: string;
  last_reconnect?: string;
}

const defaultConfig: VpnConfig = {
  connection_name: 'GNS-to-Core',
  vpn_type: 'openvpn',
  core_host: '',
  core_port: 1194,
  protocol: 'udp',
  auth_method: 'certificate',
  vpn_subnet: '192.168.100.0/24',
  gns_vpn_ip: '192.168.100.1',
  core_vpn_ip: '192.168.100.254',
  device_subnet: '192.168.50.0/24',
  routes: ['192.168.50.0/24'],
};

const VpnBridgeManager: React.FC = () => {
  const [config, setConfig] = useState<VpnConfig>(defaultConfig);
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'config'>('status');

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig({
          ...defaultConfig,
          connection_name: data.connection_name || defaultConfig.connection_name,
          vpn_type: data.vpn_type || defaultConfig.vpn_type,
          core_host: data.core_host || '',
          core_port: data.core_port || 1194,
          protocol: data.protocol || 'udp',
          auth_method: data.auth_method || 'certificate',
          vpn_subnet: data.vpn_subnet || defaultConfig.vpn_subnet,
          gns_vpn_ip: data.gns_vpn_ip || defaultConfig.gns_vpn_ip,
          core_vpn_ip: data.core_vpn_ip || defaultConfig.core_vpn_ip,
          device_subnet: data.device_subnet || defaultConfig.device_subnet,
          routes: data.routes || defaultConfig.routes,
          vpn_id: data.vpn_id,
          status: data.status,
          is_active: data.is_active,
        });
      }
    } catch {
      // no config yet
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    setLoading(true);
    setMessage('');
    try {
      const payload = {
        connection_name: config.connection_name,
        vpn_type: config.vpn_type,
        core_server: {
          host: config.core_host,
          port: config.core_port,
          protocol: config.protocol,
        },
        authentication: { method: config.auth_method },
        network: {
          vpn_subnet: config.vpn_subnet,
          gns_vpn_ip: config.gns_vpn_ip,
          core_vpn_ip: config.core_vpn_ip,
          device_subnet: config.device_subnet,
        },
        routes: config.routes,
      };

      const method = config.vpn_id ? 'PUT' : 'POST';
      const body = config.vpn_id ? { ...payload, vpn_id: config.vpn_id } : payload;

      const res = await fetch(`${API_BASE}/config`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Configuration saved successfully');
        setConfig(c => ({ ...c, vpn_id: data.vpn_id }));
        await fetchStatus();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setMessage('❌ Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleVpnAction = async (action: 'connect' | 'disconnect' | 'reconnect') => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        await fetchStatus();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch {
      setMessage('❌ Action failed');
    } finally {
      setLoading(false);
    }
  };

  const qualityColor = (quality?: string) => {
    switch (quality) {
      case 'excellent': return '#22c55e';
      case 'good': return '#84cc16';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🌉 VPN Bridge Manager</h2>

      {message && (
        <div style={{ ...styles.alert, backgroundColor: message.startsWith('✅') ? '#dcfce7' : '#fee2e2' }}>
          {message}
        </div>
      )}

      {/* Status Summary */}
      {status && (
        <div style={styles.statusCard}>
          <div style={styles.statusRow}>
            <span style={{
              ...styles.statusBadge,
              backgroundColor: status.connected ? '#22c55e' : '#ef4444',
            }}>
              {status.connected ? '● Connected' : '● Disconnected'}
            </span>
            {status.connection_quality && (
              <span style={{ ...styles.qualityBadge, color: qualityColor(status.connection_quality) }}>
                {status.connection_quality.toUpperCase()}
              </span>
            )}
          </div>
          {status.connected && (
            <div style={styles.metricsGrid}>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Uptime</span>
                <span style={styles.metricValue}>{status.connection_uptime}</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Latency</span>
                <span style={styles.metricValue}>{status.latency}ms</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Packet Loss</span>
                <span style={styles.metricValue}>{status.packet_loss}%</span>
              </div>
              <div style={styles.metric}>
                <span style={styles.metricLabel}>VPN IP</span>
                <span style={styles.metricValue}>{status.vpn_ip}</span>
              </div>
              {status.bandwidth && (
                <>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>↑ Upload</span>
                    <span style={styles.metricValue}>{status.bandwidth.uploaded} MB</span>
                  </div>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>↓ Download</span>
                    <span style={styles.metricValue}>{status.bandwidth.downloaded} MB</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={styles.buttonRow}>
        <button
          style={{ ...styles.btn, ...styles.btnGreen }}
          onClick={() => handleVpnAction('connect')}
          disabled={loading || status?.connected}
        >
          Connect
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnRed }}
          onClick={() => handleVpnAction('disconnect')}
          disabled={loading || !status?.connected}
        >
          Disconnect
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnBlue }}
          onClick={() => handleVpnAction('reconnect')}
          disabled={loading}
        >
          Reconnect
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['status', 'config'] as const).map(tab => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.activeTab : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'status' ? '📊 Status' : '⚙️ Configuration'}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <div style={styles.form}>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Connection Name
              <input
                style={styles.input}
                value={config.connection_name}
                onChange={e => setConfig(c => ({ ...c, connection_name: e.target.value }))}
              />
            </label>
            <label style={styles.label}>
              VPN Type
              <select
                style={styles.input}
                value={config.vpn_type}
                onChange={e => setConfig(c => ({ ...c, vpn_type: e.target.value }))}
              >
                <option value="openvpn">OpenVPN</option>
                <option value="wireguard">WireGuard</option>
                <option value="ipsec">IPSec</option>
              </select>
            </label>
            <label style={styles.label}>
              Core Server Host
              <input
                style={styles.input}
                placeholder="core.server.com"
                value={config.core_host}
                onChange={e => setConfig(c => ({ ...c, core_host: e.target.value }))}
              />
            </label>
            <label style={styles.label}>
              Port
              <input
                style={styles.input}
                type="number"
                value={config.core_port}
                onChange={e => setConfig(c => ({ ...c, core_port: parseInt(e.target.value) || 1194 }))}
              />
            </label>
            <label style={styles.label}>
              Protocol
              <select
                style={styles.input}
                value={config.protocol}
                onChange={e => setConfig(c => ({ ...c, protocol: e.target.value }))}
              >
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
              </select>
            </label>
            <label style={styles.label}>
              Auth Method
              <select
                style={styles.input}
                value={config.auth_method}
                onChange={e => setConfig(c => ({ ...c, auth_method: e.target.value }))}
              >
                <option value="certificate">Certificate</option>
                <option value="preshared-key">Pre-shared Key</option>
              </select>
            </label>
            <label style={styles.label}>
              VPN Subnet
              <input
                style={styles.input}
                value={config.vpn_subnet}
                onChange={e => setConfig(c => ({ ...c, vpn_subnet: e.target.value }))}
              />
            </label>
            <label style={styles.label}>
              GNS VPN IP
              <input
                style={styles.input}
                value={config.gns_vpn_ip}
                onChange={e => setConfig(c => ({ ...c, gns_vpn_ip: e.target.value }))}
              />
            </label>
            <label style={styles.label}>
              Core VPN IP
              <input
                style={styles.input}
                value={config.core_vpn_ip}
                onChange={e => setConfig(c => ({ ...c, core_vpn_ip: e.target.value }))}
              />
            </label>
            <label style={styles.label}>
              Device Subnet
              <input
                style={styles.input}
                value={config.device_subnet}
                onChange={e => setConfig(c => ({ ...c, device_subnet: e.target.value }))}
              />
            </label>
          </div>

          <button
            style={{ ...styles.btn, ...styles.btnBlue, marginTop: 16 }}
            onClick={handleSaveConfig}
            disabled={loading}
          >
            {loading ? 'Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      )}

      {activeTab === 'status' && !status?.connected && (
        <p style={{ color: '#6b7280', textAlign: 'center', padding: '16px' }}>
          No active VPN connection. Configure and connect in the Configuration tab.
        </p>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: 'sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
  alert: { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  statusCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 },
  statusRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  statusBadge: { color: '#fff', borderRadius: 999, padding: '4px 12px', fontWeight: 600, fontSize: 13 },
  qualityBadge: { fontWeight: 700, fontSize: 13, textTransform: 'uppercase' as const },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 },
  metric: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  metricLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  metricValue: { fontSize: 15, fontWeight: 600, color: '#1e293b' },
  buttonRow: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const },
  btn: { padding: '8px 20px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnGreen: { background: '#22c55e', color: '#fff' },
  btnRed: { background: '#ef4444', color: '#fff' },
  btnBlue: { background: '#3b82f6', color: '#fff' },
  tabs: { display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 16 },
  tab: { padding: '8px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 500, fontSize: 14, borderBottom: '2px solid transparent', marginBottom: -2 },
  activeTab: { borderBottomColor: '#3b82f6', color: '#3b82f6', fontWeight: 700 },
  form: { background: '#f8fafc', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  label: { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fff' },
};

export default VpnBridgeManager;
