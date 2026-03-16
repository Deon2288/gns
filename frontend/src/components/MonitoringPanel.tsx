import React, { useEffect, useState } from 'react';

interface MonitoringConfig {
    enabled: boolean;
    pull_interval: number;
    monitor_type: string;
    retry_on_failure: boolean;
    max_retries: number;
    timeout: number;
    parallel_checks: number;
    alert_on_status_change: boolean;
}

interface MonitoringStatus {
    status: string;
    last_check: string | null;
    devices_checked: number;
    failed_checks: number;
    uptime_percentage: string;
    config: MonitoringConfig;
}

interface MonitoringLog {
    log_id: string;
    device_id: string;
    check_time: string;
    status: string;
    response_time: number | null;
    error_message: string | null;
}

const INTERVAL_PRESETS = [
    { label: '5 min',  value: 300 },
    { label: '15 min', value: 900 },
    { label: '30 min', value: 1800 },
    { label: '1 hr',   value: 3600 },
];

const MonitoringPanel: React.FC = () => {
    const [status, setStatus] = useState<MonitoringStatus | null>(null);
    const [logs,   setLogs]   = useState<MonitoringLog[]>([]);
    const [config, setConfig] = useState<MonitoringConfig>({
        enabled: false,
        pull_interval: 300,
        monitor_type: 'all',
        retry_on_failure: true,
        max_retries: 3,
        timeout: 10000,
        parallel_checks: 10,
        alert_on_status_change: true,
    });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const loadStatus = async () => {
        try {
            const [s, l] = await Promise.all([
                fetch('/api/discovery/monitoring/status').then(r => r.json()),
                fetch('/api/discovery/monitoring/logs').then(r => r.json()),
            ]);
            setStatus(s);
            setConfig(s.config || config);
            setLogs(l);
        } catch (_) {}
    };

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const saveConfig = async () => {
        setSaving(true);
        try {
            await fetch('/api/discovery/monitoring/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            setMsg('✅ Configuration saved');
            loadStatus();
        } catch {
            setMsg('❌ Failed to save');
        } finally {
            setSaving(false);
            setTimeout(() => setMsg(''), 3000);
        }
    };

    const pause = async () => {
        await fetch('/api/discovery/monitoring/pause', { method: 'POST' });
        loadStatus();
    };

    const resume = async () => {
        await fetch('/api/discovery/monitoring/resume', { method: 'POST' });
        loadStatus();
    };

    const statusColor = (s: string) => {
        if (s === 'running') return '#22c55e';
        if (s === 'paused')  return '#eab308';
        return '#94a3b8';
    };

    return (
        <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>🔄 Continuous Monitoring</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Status card */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Current Status</h3>

                    {status && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ width: 12, height: 12, borderRadius: '50%', background: statusColor(status.status), display: 'inline-block' }} />
                                <span style={{ fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>{status.status}</span>
                            </div>

                            <div style={rowStyle}>
                                <span>Devices Checked</span>
                                <span style={{ fontWeight: 600 }}>{status.devices_checked}</span>
                            </div>
                            <div style={rowStyle}>
                                <span>Failed Checks</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>{status.failed_checks}</span>
                            </div>
                            <div style={rowStyle}>
                                <span>Uptime</span>
                                <span style={{ color: '#22c55e', fontWeight: 600 }}>{status.uptime_percentage}%</span>
                            </div>
                            <div style={rowStyle}>
                                <span>Last Check</span>
                                <span style={{ opacity: 0.7, fontSize: 12 }}>
                                    {status.last_check ? new Date(status.last_check).toLocaleString() : 'Never'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button onClick={resume} style={btnStyle('#22c55e')}>▶ Resume</button>
                                <button onClick={pause}  style={btnStyle('#eab308')}>⏸ Pause</button>
                            </div>
                        </>
                    )}
                </div>

                {/* Config card */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Configuration</h3>

                    <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Pull Interval</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        {INTERVAL_PRESETS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setConfig(c => ({ ...c, pull_interval: p.value }))}
                                style={btnStyle(config.pull_interval === p.value ? '#3b82f6' : '#334155')}
                            >
                                {p.label}
                            </button>
                        ))}
                        <input
                            type="number"
                            min={60}
                            value={config.pull_interval}
                            onChange={e => setConfig(c => ({ ...c, pull_interval: parseInt(e.target.value) || 300 }))}
                            style={{ width: 80, padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }}
                            placeholder="Custom (s)"
                        />
                    </div>

                    <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Monitor Type</label>
                    <select
                        value={config.monitor_type}
                        onChange={e => setConfig(c => ({ ...c, monitor_type: e.target.value }))}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13, marginBottom: 12 }}
                    >
                        <option value="all">All Discovered Devices</option>
                        <option value="registered">Registered Only</option>
                        <option value="pending">Pending Only</option>
                    </select>

                    <div style={rowStyle}>
                        <span>Parallel Checks</span>
                        <input
                            type="number" min={1} max={50}
                            value={config.parallel_checks}
                            onChange={e => setConfig(c => ({ ...c, parallel_checks: parseInt(e.target.value) || 10 }))}
                            style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13 }}
                        />
                    </div>

                    <div style={{ ...rowStyle, marginTop: 8 }}>
                        <span>Alert on Status Change</span>
                        <button
                            onClick={() => setConfig(c => ({ ...c, alert_on_status_change: !c.alert_on_status_change }))}
                            style={btnStyle(config.alert_on_status_change ? '#22c55e' : '#475569')}
                        >
                            {config.alert_on_status_change ? 'ON' : 'OFF'}
                        </button>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={saveConfig} disabled={saving} style={btnStyle('#3b82f6')}>
                            {saving ? 'Saving…' : '💾 Save'}
                        </button>
                        {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
                    </div>
                </div>
            </div>

            {/* Logs */}
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, marginTop: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>📋 Recent Check Logs</h3>
                {logs.length === 0 ? (
                    <p style={{ opacity: 0.5, fontSize: 13 }}>No logs yet.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                                <th style={thStyle}>Device ID</th>
                                <th style={thStyle}>Time</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Response (ms)</th>
                                <th style={thStyle}>Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.slice(-20).reverse().map(l => (
                                <tr key={l.log_id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={tdStyle}>{l.device_id}</td>
                                    <td style={tdStyle}>{new Date(l.check_time).toLocaleString()}</td>
                                    <td style={{ ...tdStyle, color: l.status === 'online' ? '#22c55e' : '#ef4444' }}>
                                        {l.status}
                                    </td>
                                    <td style={tdStyle}>{l.response_time ?? '–'}</td>
                                    <td style={{ ...tdStyle, opacity: 0.6 }}>{l.error_message || '–'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #0f172a', fontSize: 13 };
const thStyle: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid #334155' };
const tdStyle: React.CSSProperties = { padding: '6px 8px' };

function btnStyle(bg: string): React.CSSProperties {
    return { padding: '5px 12px', borderRadius: 5, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
}

export default MonitoringPanel;
