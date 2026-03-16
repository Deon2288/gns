import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/discovery';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScanRequest {
    ipRange: string;
    ports: number[];
    timeoutMs: number;
    protocols: string[];
    concurrency: number;
}

interface DiscoveredDevice {
    discoveredId: string;
    scanId: string;
    ipAddress: string;
    port: number;
    protocol: string;
    manufacturer: string | null;
    deviceModel: string | null;
    firmwareVersion: string | null;
    imei: string | null;
    deviceName: string;
    firstSeen: string;
    lastSeen: string;
    status: string;
    registeredDeviceId: number | null;
}

interface ScanRecord {
    scanId: string;
    scanType: string;
    ipRange: string;
    ports: number[];
    startTime: string;
    endTime: string | null;
    devicesFound: number;
    devicesRegistered: number;
    status: string;
    totalIps: number;
    scannedIps: number;
}

interface ScanStatus {
    activeScans: number;
    totalScans: number;
    totalDiscovered: number;
    totalRegistered: number;
    running: ScanRecord[];
    recentCompleted: ScanRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PROTOCOL_COLOURS: Record<string, string> = {
    teltonika: '#4CAF50',
    nmea: '#2196F3',
    http: '#FF9800',
    mqtt: '#9C27B0',
    unknown: '#607D8B',
};

const STATUS_COLOURS: Record<string, string> = {
    new: '#2196F3',
    registered: '#4CAF50',
    offline: '#F44336',
    ignored: '#9E9E9E',
};

function Badge({ label, colour }: { label: string; colour: string }) {
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 12,
                background: colour,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
            }}
        >
            {label}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const DiscoveryDashboard: React.FC = () => {
    // Wizard step: 0=configure, 1=scanning, 2=results, 3=register
    const [step, setStep] = useState<0 | 1 | 2 | 3>(0);

    // Form state
    const [ipRange, setIpRange] = useState('192.168.1.0/24');
    const [ports, setPorts] = useState('27015, 27016, 10110, 80');
    const [timeoutMs, setTimeoutMs] = useState(3000);
    const [concurrency, setConcurrency] = useState(50);
    const [selectedProtocols, setSelectedProtocols] = useState<string[]>([
        'teltonika', 'nmea', 'http', 'mqtt',
    ]);

    // Scan state
    const [currentScanId, setCurrentScanId] = useState<string | null>(null);
    const [scanProgress, setScanProgress] = useState<ScanRecord | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);

    // Results
    const [discoveredList, setDiscoveredList] = useState<DiscoveredDevice[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Status overview
    const [scannerStatus, setScannerStatus] = useState<ScanStatus | null>(null);
    const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);

    // Test connection
    const [testIp, setTestIp] = useState('');
    const [testPort, setTestPort] = useState('27015');
    const [testResult, setTestResult] = useState<object | null>(null);
    const [testLoading, setTestLoading] = useState(false);

    // Registration
    const [registerLoading, setRegisterLoading] = useState(false);
    const [registerResult, setRegisterResult] = useState<{ registered: any[]; errors: any[] } | null>(null);

    const [activeTab, setActiveTab] = useState<'wizard' | 'history' | 'test'>('wizard');

    // ── fetch scanner status & scan history ──────────────────────────────────

    const refreshStatus = useCallback(async () => {
        try {
            const [statusRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/status`),
                fetch(`${API_BASE}/scans`),
            ]);
            if (statusRes.ok) setScannerStatus(await statusRes.json());
            if (historyRes.ok) setScanHistory(await historyRes.json());
        } catch (_) { /* ignore */ }
    }, []);

    useEffect(() => {
        refreshStatus();
        const id = setInterval(refreshStatus, 5000);
        return () => clearInterval(id);
    }, [refreshStatus]);

    // ── poll active scan ──────────────────────────────────────────────────────

    useEffect(() => {
        if (!currentScanId || step !== 1) return;

        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/results/${currentScanId}`);
                if (!res.ok) return;
                const data = await res.json();
                setScanProgress(data.scan);
                setDiscoveredList(data.devices || []);

                if (data.scan.status === 'completed' || data.scan.status === 'failed') {
                    setStep(2);
                }
            } catch (_) { /* ignore */ }
        };

        poll();
        const id = setInterval(poll, 2000);
        return () => clearInterval(id);
    }, [currentScanId, step]);

    // ── handlers ─────────────────────────────────────────────────────────────

    const parsePorts = (): number[] => {
        return ports
            .split(/[,\s]+/)
            .map((p) => parseInt(p.trim(), 10))
            .filter((p) => !isNaN(p) && p > 0 && p <= 65535);
    };

    const handleStartScan = async () => {
        setScanError(null);
        const body: ScanRequest = {
            ipRange: ipRange.trim(),
            ports: parsePorts(),
            timeoutMs,
            protocols: selectedProtocols,
            concurrency,
        };

        try {
            const res = await fetch(`${API_BASE}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setScanError(data.error || 'Scan failed to start');
                return;
            }
            setCurrentScanId(data.scanId);
            setDiscoveredList([]);
            setSelectedIds(new Set());
            setStep(1);
        } catch (err: any) {
            setScanError(err.message);
        }
    };

    const handleTestConnection = async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            const res = await fetch(`${API_BASE}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: testIp, port: parseInt(testPort, 10), protocols: selectedProtocols }),
            });
            setTestResult(await res.json());
        } catch (err: any) {
            setTestResult({ error: err.message });
        } finally {
            setTestLoading(false);
        }
    };

    const toggleProtocol = (p: string) => {
        setSelectedProtocols((prev) =>
            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
        );
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        const unregistered = discoveredList.filter((d) => d.status !== 'registered').map((d) => d.discoveredId);
        setSelectedIds(new Set(unregistered));
    };

    const handleRegister = async () => {
        if (selectedIds.size === 0) return;
        setRegisterLoading(true);
        setRegisterResult(null);
        try {
            const res = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discoveredIds: Array.from(selectedIds) }),
            });
            const data = await res.json();
            setRegisterResult(data);
            // Refresh device list
            const resultsRes = await fetch(`${API_BASE}/results/${currentScanId}`);
            if (resultsRes.ok) {
                const rd = await resultsRes.json();
                setDiscoveredList(rd.devices || []);
            }
            setStep(3);
        } catch (err: any) {
            setRegisterResult({ registered: [], errors: [{ error: err.message }] });
        } finally {
            setRegisterLoading(false);
        }
    };

    // ── progress bar ─────────────────────────────────────────────────────────

    const progressPct = scanProgress
        ? Math.round((scanProgress.scannedIps / Math.max(scanProgress.totalIps, 1)) * 100)
        : 0;

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 24 }}>
            <h2 style={{ marginBottom: 4 }}>📡 Device Auto-Discovery</h2>
            <p style={{ color: '#666', marginBottom: 20 }}>
                Scan your network to find and register GPS devices automatically.
            </p>

            {/* Status summary */}
            {scannerStatus && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                    {[
                        { label: 'Active Scans', value: scannerStatus.activeScans, colour: '#2196F3' },
                        { label: 'Total Scans', value: scannerStatus.totalScans, colour: '#607D8B' },
                        { label: 'Discovered', value: scannerStatus.totalDiscovered, colour: '#FF9800' },
                        { label: 'Registered', value: scannerStatus.totalRegistered, colour: '#4CAF50' },
                    ].map((c) => (
                        <div
                            key={c.label}
                            style={{
                                flex: 1,
                                background: c.colour,
                                color: '#fff',
                                borderRadius: 8,
                                padding: '16px 20px',
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: 28, fontWeight: 700 }}>{c.value}</div>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>{c.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #eee' }}>
                {(['wizard', 'history', 'test'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        style={{
                            padding: '10px 20px',
                            border: 'none',
                            cursor: 'pointer',
                            background: activeTab === t ? '#2196F3' : 'transparent',
                            color: activeTab === t ? '#fff' : '#333',
                            borderRadius: '6px 6px 0 0',
                            fontWeight: activeTab === t ? 700 : 400,
                        }}
                    >
                        {t === 'wizard' ? '🔍 Scan Wizard' : t === 'history' ? '📋 Scan History' : '🔌 Test Connection'}
                    </button>
                ))}
            </div>

            {/* ── Wizard tab ──────────────────────────────────────────────────────── */}
            {activeTab === 'wizard' && (
                <>
                    {/* Step indicators */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                        {['Configure', 'Scanning', 'Results', 'Register'].map((label, i) => (
                            <div
                                key={label}
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    padding: '10px 0',
                                    borderRadius: 6,
                                    background: step === i ? '#2196F3' : step > i ? '#4CAF50' : '#eee',
                                    color: step >= i ? '#fff' : '#999',
                                    fontWeight: step === i ? 700 : 400,
                                    fontSize: 13,
                                }}
                            >
                                {step > i ? '✔ ' : ''}{label}
                            </div>
                        ))}
                    </div>

                    {/* Step 0: Configure */}
                    {step === 0 && (
                        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 24 }}>
                            <h3 style={{ marginTop: 0 }}>Step 1 – Configure Scan</h3>

                            <label style={labelStyle}>IP Range / Address</label>
                            <input
                                value={ipRange}
                                onChange={(e) => setIpRange(e.target.value)}
                                placeholder="e.g. 192.168.1.0/24 or 192.168.1.1-100 or 10.0.0.5"
                                style={inputStyle}
                            />
                            <p style={{ color: '#888', fontSize: 12, marginTop: -8, marginBottom: 16 }}>
                                Supports: single IP, CIDR (e.g. /24), range (e.g. 1-254), subnet mask
                            </p>

                            <label style={labelStyle}>Ports (comma-separated)</label>
                            <input
                                value={ports}
                                onChange={(e) => setPorts(e.target.value)}
                                placeholder="27015, 27016, 10110, 80"
                                style={inputStyle}
                            />

                            <label style={labelStyle}>Protocols to probe</label>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                {['teltonika', 'nmea', 'http', 'mqtt'].map((p) => (
                                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedProtocols.includes(p)}
                                            onChange={() => toggleProtocol(p)}
                                        />
                                        <Badge label={p} colour={PROTOCOL_COLOURS[p]} />
                                    </label>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Timeout (ms)</label>
                                    <input
                                        type="number"
                                        value={timeoutMs}
                                        min={500}
                                        max={30000}
                                        onChange={(e) => setTimeoutMs(Number(e.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Concurrency</label>
                                    <input
                                        type="number"
                                        value={concurrency}
                                        min={1}
                                        max={200}
                                        onChange={(e) => setConcurrency(Number(e.target.value))}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {scanError && (
                                <div style={{ color: '#F44336', marginBottom: 16 }}>⚠ {scanError}</div>
                            )}

                            <button onClick={handleStartScan} style={primaryBtnStyle}>
                                🚀 Start Scan
                            </button>
                        </div>
                    )}

                    {/* Step 1: Scanning */}
                    {step === 1 && scanProgress && (
                        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 24, textAlign: 'center' }}>
                            <h3 style={{ marginTop: 0 }}>🔍 Scanning in progress…</h3>
                            <div style={{ marginBottom: 12, fontSize: 14, color: '#555' }}>
                                {ipRange} — {scanProgress.ports ? scanProgress.ports.join(', ') : ''} ports
                            </div>
                            <div style={{ background: '#ddd', borderRadius: 8, height: 20, overflow: 'hidden', marginBottom: 12 }}>
                                <div
                                    style={{
                                        width: `${progressPct}%`,
                                        background: '#2196F3',
                                        height: '100%',
                                        transition: 'width 0.5s ease',
                                    }}
                                />
                            </div>
                            <div style={{ fontSize: 13, color: '#666' }}>
                                {scanProgress.scannedIps} / {scanProgress.totalIps} probes completed
                                &nbsp;·&nbsp; {scanProgress.devicesFound} device(s) found
                            </div>

                            {discoveredList.length > 0 && (
                                <div style={{ marginTop: 24, textAlign: 'left' }}>
                                    <h4>Devices found so far:</h4>
                                    {discoveredList.map((d) => (
                                        <div key={d.discoveredId} style={deviceRowStyle}>
                                            <strong>{d.ipAddress}:{d.port}</strong>
                                            &nbsp;&nbsp;
                                            <Badge label={d.protocol} colour={PROTOCOL_COLOURS[d.protocol] || '#607D8B'} />
                                            &nbsp;&nbsp;
                                            <span style={{ color: '#555', fontSize: 12 }}>{d.manufacturer || ''} {d.deviceModel || ''}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Results */}
                    {step === 2 && (
                        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ margin: 0 }}>
                                    {scanProgress?.status === 'failed' ? '❌ Scan Failed' : `✅ Scan Complete — ${discoveredList.length} device(s) found`}
                                </h3>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={selectAll} style={secondaryBtnStyle}>Select All</button>
                                    <button onClick={() => setSelectedIds(new Set())} style={secondaryBtnStyle}>Clear</button>
                                    <button onClick={() => { setStep(0); setScanError(null); }} style={secondaryBtnStyle}>New Scan</button>
                                </div>
                            </div>

                            {discoveredList.length === 0 ? (
                                <p style={{ color: '#888' }}>No devices were discovered. Try adjusting your IP range or ports.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#e3e3e3' }}>
                                            <th style={thStyle}><input type="checkbox" onChange={(e) => e.target.checked ? selectAll() : setSelectedIds(new Set())} /></th>
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
                                        {discoveredList.map((d) => (
                                            <tr
                                                key={d.discoveredId}
                                                style={{ background: selectedIds.has(d.discoveredId) ? '#e8f4fd' : 'white', cursor: 'pointer' }}
                                                onClick={() => toggleSelect(d.discoveredId)}
                                            >
                                                <td style={tdStyle}>
                                                    <input type="checkbox" checked={selectedIds.has(d.discoveredId)} onChange={() => toggleSelect(d.discoveredId)} onClick={(e) => e.stopPropagation()} />
                                                </td>
                                                <td style={tdStyle}>{d.ipAddress}</td>
                                                <td style={tdStyle}>{d.port}</td>
                                                <td style={tdStyle}><Badge label={d.protocol} colour={PROTOCOL_COLOURS[d.protocol] || '#607D8B'} /></td>
                                                <td style={tdStyle}>{d.manufacturer || '—'}</td>
                                                <td style={tdStyle}>{d.deviceModel || '—'}</td>
                                                <td style={tdStyle}>{d.imei || '—'}</td>
                                                <td style={tdStyle}><Badge label={d.status} colour={STATUS_COLOURS[d.status] || '#9E9E9E'} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {discoveredList.length > 0 && (
                                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                    <span style={{ alignSelf: 'center', color: '#666', fontSize: 13 }}>
                                        {selectedIds.size} selected
                                    </span>
                                    <button
                                        onClick={handleRegister}
                                        disabled={selectedIds.size === 0 || registerLoading}
                                        style={{ ...primaryBtnStyle, opacity: selectedIds.size === 0 ? 0.5 : 1 }}
                                    >
                                        {registerLoading ? 'Registering…' : `📝 Register ${selectedIds.size} Device(s)`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Registration result */}
                    {step === 3 && registerResult && (
                        <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 24 }}>
                            <h3 style={{ marginTop: 0 }}>📝 Registration Complete</h3>
                            <p style={{ color: '#4CAF50' }}>✅ {registerResult.registered.length} device(s) registered successfully.</p>
                            {registerResult.errors.length > 0 && (
                                <div>
                                    <p style={{ color: '#F44336' }}>⚠ {registerResult.errors.length} error(s):</p>
                                    <ul style={{ color: '#F44336' }}>
                                        {registerResult.errors.map((e: any, i: number) => (
                                            <li key={i}>{e.error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                                <button onClick={() => { setStep(2); setRegisterResult(null); }} style={secondaryBtnStyle}>
                                    ← Back to Results
                                </button>
                                <button onClick={() => { setStep(0); setRegisterResult(null); setScanError(null); }} style={primaryBtnStyle}>
                                    🔍 New Scan
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── History tab ─────────────────────────────────────────────────────── */}
            {activeTab === 'history' && (
                <div>
                    <h3 style={{ marginTop: 0 }}>Scan History</h3>
                    {scanHistory.length === 0 ? (
                        <p style={{ color: '#888' }}>No scans have been run yet.</p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#e3e3e3' }}>
                                    <th style={thStyle}>Started</th>
                                    <th style={thStyle}>IP Range</th>
                                    <th style={thStyle}>Type</th>
                                    <th style={thStyle}>IPs Scanned</th>
                                    <th style={thStyle}>Devices Found</th>
                                    <th style={thStyle}>Registered</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scanHistory.map((s) => {
                                    const dur = s.endTime
                                        ? Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000)
                                        : null;
                                    return (
                                        <tr key={s.scanId} style={{ background: 'white' }}>
                                            <td style={tdStyle}>{new Date(s.startTime).toLocaleString()}</td>
                                            <td style={tdStyle}>{s.ipRange}</td>
                                            <td style={tdStyle}>{s.scanType}</td>
                                            <td style={tdStyle}>{s.scannedIps} / {s.totalIps}</td>
                                            <td style={tdStyle}>{s.devicesFound}</td>
                                            <td style={tdStyle}>{s.devicesRegistered}</td>
                                            <td style={tdStyle}>
                                                <Badge
                                                    label={s.status}
                                                    colour={s.status === 'completed' ? '#4CAF50' : s.status === 'running' ? '#2196F3' : s.status === 'failed' ? '#F44336' : '#9E9E9E'}
                                                />
                                            </td>
                                            <td style={tdStyle}>{dur !== null ? `${dur}s` : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Test Connection tab ──────────────────────────────────────────────── */}
            {activeTab === 'test' && (
                <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 24, maxWidth: 500 }}>
                    <h3 style={{ marginTop: 0 }}>🔌 Test Single IP:Port</h3>
                    <label style={labelStyle}>IP Address</label>
                    <input
                        value={testIp}
                        onChange={(e) => setTestIp(e.target.value)}
                        placeholder="192.168.1.100"
                        style={inputStyle}
                    />
                    <label style={labelStyle}>Port</label>
                    <input
                        value={testPort}
                        onChange={(e) => setTestPort(e.target.value)}
                        placeholder="27015"
                        style={inputStyle}
                    />
                    <label style={labelStyle}>Protocols to probe</label>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                        {['teltonika', 'nmea', 'http', 'mqtt'].map((p) => (
                            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <input type="checkbox" checked={selectedProtocols.includes(p)} onChange={() => toggleProtocol(p)} />
                                <Badge label={p} colour={PROTOCOL_COLOURS[p]} />
                            </label>
                        ))}
                    </div>
                    <button
                        onClick={handleTestConnection}
                        disabled={testLoading}
                        style={primaryBtnStyle}
                    >
                        {testLoading ? 'Testing…' : '🔍 Test'}
                    </button>

                    {testResult && (
                        <div style={{ marginTop: 20, background: '#fff', borderRadius: 6, padding: 16, border: '1px solid #ddd' }}>
                            <h4 style={{ marginTop: 0 }}>Result:</h4>
                            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {JSON.stringify(testResult, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline styles
// ─────────────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 600,
    marginBottom: 4,
    fontSize: 13,
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #ccc',
    fontSize: 13,
    marginBottom: 16,
    boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
    padding: '10px 22px',
    background: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
    padding: '10px 22px',
    background: '#fff',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
};

const deviceRowStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: '8px 12px',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
};

const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 12,
    borderBottom: '1px solid #ccc',
};

const tdStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    verticalAlign: 'middle',
};

export default DiscoveryDashboard;
