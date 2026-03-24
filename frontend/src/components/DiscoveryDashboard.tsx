import React, { useState, useCallback } from 'react';

interface ScanConfig {
  ipRange: string;
  ports: string;
  protocols: string[];
  timeout: number;
  concurrency: number;
}

interface DiscoveredDevice {
  discoveredId: string;
  ip: string;
  port: number;
  protocol: string;
  manufacturer: string;
  model: string;
  imei?: string;
  status: 'new' | 'registered' | 'failed';
}

interface ScanResult {
  scanId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  totalIps: number;
  scannedIps: number;
  devicesFound: DiscoveredDevice[];
  startTime?: string;
  endTime?: string;
}

const PROTOCOLS = ['teltonika', 'nmea', 'http', 'mqtt'];

const DEFAULT_CONFIG: ScanConfig = {
  ipRange: '192.168.1.0/24',
  ports: '27015, 27016, 10110, 80, 1883',
  protocols: ['teltonika', 'nmea'],
  timeout: 3000,
  concurrency: 50,
};

const DiscoveryDashboard: React.FC = () => {
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [scan, setScan] = useState<ScanResult>({
    scanId: '',
    status: 'idle',
    progress: 0,
    totalIps: 0,
    scannedIps: 0,
    devicesFound: [],
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [registerStatus, setRegisterStatus] = useState<string>('');

  const toggleProtocol = useCallback((protocol: string) => {
    setConfig(prev => ({
      ...prev,
      protocols: prev.protocols.includes(protocol)
        ? prev.protocols.filter(p => p !== protocol)
        : [...prev.protocols, protocol],
    }));
  }, []);

  const startScan = useCallback(() => {
    const scanId = `scan-${Date.now()}`;
    const totalIps = estimateIpCount(config.ipRange);

    setScan({
      scanId,
      status: 'running',
      progress: 0,
      totalIps,
      scannedIps: 0,
      devicesFound: [],
      startTime: new Date().toISOString(),
    });
    setSelectedIds(new Set());
    setRegisterStatus('');

    // Simulate network scan with progressive discovery
    let scanned = 0;
    const interval = setInterval(() => {
      scanned += Math.floor(Math.random() * 15) + 5;
      if (scanned >= totalIps) {
        scanned = totalIps;
        clearInterval(interval);

        const mockDevices = generateMockDevices(config.protocols);
        setScan(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
          scannedIps: totalIps,
          devicesFound: mockDevices,
          endTime: new Date().toISOString(),
        }));
        setScanHistory(h => [
          {
            scanId,
            status: 'completed',
            progress: 100,
            totalIps,
            scannedIps: totalIps,
            devicesFound: mockDevices,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
          },
          ...h.slice(0, 4),
        ]);
      } else {
        const progress = Math.round((scanned / totalIps) * 100);
        setScan(prev => ({
          ...prev,
          progress,
          scannedIps: scanned,
          devicesFound: scanned > totalIps / 2 ? generateMockDevices(config.protocols) : [],
        }));
      }
    }, 300);
  }, [config]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const newIds = scan.devicesFound
      .filter(d => d.status === 'new')
      .map(d => d.discoveredId);
    setSelectedIds(new Set(newIds));
  };

  const bulkRegister = useCallback(() => {
    if (selectedIds.size === 0) return;
    setRegisterStatus('registering');

    setTimeout(() => {
      setScan(prev => ({
        ...prev,
        devicesFound: prev.devicesFound.map(d =>
          selectedIds.has(d.discoveredId) ? { ...d, status: 'registered' } : d
        ),
      }));
      setSelectedIds(new Set());
      setRegisterStatus(`✅ Successfully registered ${selectedIds.size} device(s).`);
    }, 1200);
  }, [selectedIds]);

  return (
    <div style={pageStyle}>
      <h2 style={headingStyle}>🔍 Discovery Scanner</h2>
      <p style={subtextStyle}>Scan IP ranges to detect GPS devices, identify protocols, and bulk register them.</p>

      <div style={layoutStyle}>
        {/* Config Panel */}
        <section style={cardStyle}>
          <h3 style={sectionHeadingStyle}>Scan Configuration</h3>

          <label style={labelStyle}>IP Range</label>
          <input
            style={inputStyle}
            value={config.ipRange}
            onChange={e => setConfig(p => ({ ...p, ipRange: e.target.value }))}
            placeholder="e.g. 192.168.1.0/24 or 192.168.1.1-254"
          />

          <label style={labelStyle}>Ports (comma-separated)</label>
          <input
            style={inputStyle}
            value={config.ports}
            onChange={e => setConfig(p => ({ ...p, ports: e.target.value }))}
            placeholder="e.g. 27015, 27016, 10110"
          />

          <label style={labelStyle}>Protocols</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {PROTOCOLS.map(proto => (
              <button
                key={proto}
                onClick={() => toggleProtocol(proto)}
                style={{
                  ...pillStyle,
                  ...(config.protocols.includes(proto) ? activePillStyle : {}),
                }}
              >
                {proto}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Timeout (ms)</label>
              <input
                style={inputStyle}
                type="number"
                value={config.timeout}
                onChange={e => setConfig(p => ({ ...p, timeout: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Concurrency</label>
              <input
                style={inputStyle}
                type="number"
                value={config.concurrency}
                onChange={e => setConfig(p => ({ ...p, concurrency: Number(e.target.value) }))}
              />
            </div>
          </div>

          <button
            onClick={startScan}
            disabled={scan.status === 'running'}
            style={{
              ...btnPrimaryStyle,
              opacity: scan.status === 'running' ? 0.6 : 1,
              cursor: scan.status === 'running' ? 'not-allowed' : 'pointer',
            }}
          >
            {scan.status === 'running' ? '⏳ Scanning...' : '▶ Start Scan'}
          </button>
        </section>

        {/* Results Panel */}
        <section style={{ flex: 1, minWidth: 0 }}>
          {/* Progress */}
          {scan.status !== 'idle' && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#e0e0e0', fontWeight: 600 }}>
                  {scan.status === 'running' ? 'Scanning...' : `Scan Complete — ${scan.devicesFound.length} device(s) found`}
                </span>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>
                  {scan.scannedIps}/{scan.totalIps} IPs
                </span>
              </div>
              <div style={progressBarBgStyle}>
                <div style={{ ...progressBarFillStyle, width: `${scan.progress}%` }} />
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                {scan.progress}% complete
              </div>
            </div>
          )}

          {/* Devices Table */}
          {scan.devicesFound.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={sectionHeadingStyle}>Discovered Devices</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={selectAll} style={btnSecondaryStyle}>Select All New</button>
                  <button
                    onClick={bulkRegister}
                    disabled={selectedIds.size === 0 || registerStatus === 'registering'}
                    style={{
                      ...btnPrimaryStyle,
                      opacity: selectedIds.size === 0 ? 0.5 : 1,
                      cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {registerStatus === 'registering'
                      ? '⏳ Registering...'
                      : `📋 Bulk Register (${selectedIds.size})`}
                  </button>
                </div>
              </div>

              {registerStatus && registerStatus !== 'registering' && (
                <div style={{ background: '#14532d', border: '1px solid #166534', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#86efac', fontSize: 14 }}>
                  {registerStatus}
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}></th>
                      <th style={thStyle}>IP Address</th>
                      <th style={thStyle}>Port</th>
                      <th style={thStyle}>Protocol</th>
                      <th style={thStyle}>Manufacturer</th>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>IMEI</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.devicesFound.map(device => (
                      <tr key={device.discoveredId} style={{ borderBottom: '1px solid #2d2d44' }}>
                        <td style={tdStyle}>
                          {device.status === 'new' && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(device.discoveredId)}
                              onChange={() => toggleSelect(device.discoveredId)}
                              style={{ cursor: 'pointer' }}
                            />
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#93c5fd' }}>{device.ip}</td>
                        <td style={tdStyle}>{device.port}</td>
                        <td style={tdStyle}>
                          <span style={getProtocolBadge(device.protocol)}>{device.protocol}</span>
                        </td>
                        <td style={tdStyle}>{device.manufacturer}</td>
                        <td style={tdStyle}>{device.model}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{device.imei ?? '—'}</td>
                        <td style={tdStyle}>
                          <span style={getStatusBadge(device.status)}>{device.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <h3 style={sectionHeadingStyle}>Scan History</h3>
              {scanHistory.map(s => (
                <div key={s.scanId} style={historyRowStyle}>
                  <span style={{ color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{s.scanId}</span>
                  <span style={{ color: '#d1d5db', fontSize: 13 }}>
                    {s.devicesFound.length} device(s) found out of {s.totalIps} IPs
                  </span>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>
                    {s.startTime ? new Date(s.startTime).toLocaleString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {scan.status === 'idle' && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <p style={{ color: '#9ca3af' }}>Configure and start a scan to discover GPS devices on your network.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// Helpers

function estimateIpCount(range: string): number {
  if (range.includes('/')) {
    const bits = parseInt(range.split('/')[1], 10);
    return Math.min(Math.pow(2, 32 - bits), 65536);
  }
  if (range.includes('-')) {
    const parts = range.split('-');
    const start = parseInt(parts[0].split('.').pop() ?? '1', 10);
    const end = parseInt(parts[1], 10);
    return Math.max(end - start + 1, 1);
  }
  return 1;
}

function generateMockDevices(protocols: string[]): DiscoveredDevice[] {
  const base = [
    { ip: '192.168.1.50', port: 27015, protocol: 'teltonika', manufacturer: 'Teltonika', model: 'RUTX12', imei: '868759035772138' },
    { ip: '192.168.1.51', port: 27016, protocol: 'teltonika', manufacturer: 'Teltonika', model: 'FMB920', imei: '358521089145670' },
    { ip: '192.168.1.75', port: 10110, protocol: 'nmea',      manufacturer: 'u-blox',   model: 'NEO-M9N' },
    { ip: '192.168.1.80', port: 80,    protocol: 'http',      manufacturer: 'Generic',  model: 'HTTP-Tracker' },
    { ip: '192.168.1.92', port: 1883,  protocol: 'mqtt',      manufacturer: 'Quectel',  model: 'MC60' },
  ];

  return base
    .filter(d => protocols.length === 0 || protocols.includes(d.protocol))
    .map((d, i) => ({ ...d, discoveredId: `dev-${i}-${Date.now()}`, status: 'new' as const }));
}

function getProtocolBadge(protocol: string): React.CSSProperties {
  const colors: Record<string, string> = {
    teltonika: '#1d4ed8',
    nmea: '#15803d',
    http: '#7c3aed',
    mqtt: '#b45309',
  };
  return {
    background: colors[protocol] ?? '#374151',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  };
}

function getStatusBadge(status: string): React.CSSProperties {
  const colors: Record<string, { bg: string; color: string }> = {
    new:        { bg: '#1e3a5f', color: '#93c5fd' },
    registered: { bg: '#14532d', color: '#86efac' },
    failed:     { bg: '#7f1d1d', color: '#fca5a5' },
  };
  const c = colors[status] ?? { bg: '#374151', color: '#e5e7eb' };
  return { background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 };
}

// Styles
const pageStyle: React.CSSProperties = { padding: 32, maxWidth: 1400, margin: '0 auto' };
const headingStyle: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: '#e0e0e0', marginBottom: 8 };
const subtextStyle: React.CSSProperties = { color: '#9ca3af', marginBottom: 24, fontSize: 16 };
const layoutStyle: React.CSSProperties = { display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' };
const cardStyle: React.CSSProperties = { background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: 8, padding: 20, minWidth: 280 };
const sectionHeadingStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#c4c4f3', marginBottom: 16 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#9ca3af', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', background: '#0f0f1a', border: '1px solid #2d2d44', borderRadius: 6, padding: '8px 12px', color: '#e0e0e0', fontSize: 14, marginBottom: 16, outline: 'none' };
const pillStyle: React.CSSProperties = { padding: '4px 12px', borderRadius: 20, border: '1px solid #2d2d44', background: '#0f0f1a', color: '#9ca3af', cursor: 'pointer', fontSize: 13 };
const activePillStyle: React.CSSProperties = { background: '#1e1e3f', border: '1px solid #6366f1', color: '#818cf8' };
const btnPrimaryStyle: React.CSSProperties = { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' };
const btnSecondaryStyle: React.CSSProperties = { background: '#1e1e3f', color: '#818cf8', border: '1px solid #6366f1', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' };
const progressBarBgStyle: React.CSSProperties = { background: '#0f0f1a', borderRadius: 4, height: 8, overflow: 'hidden' };
const progressBarFillStyle: React.CSSProperties = { background: '#6366f1', height: '100%', borderRadius: 4, transition: 'width 0.3s ease' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', color: '#6b7280', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid #2d2d44', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: '#d1d5db', verticalAlign: 'middle' };
const historyRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1f1f38', flexWrap: 'wrap', gap: 8 };

export default DiscoveryDashboard;
