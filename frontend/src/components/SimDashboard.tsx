import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import './SimDashboard.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimDevice {
    device_id: number;
    device_name: string;
    imei?: string;
    status?: string;
    sim_device_id?: number;
    sim_control_id?: string;
    phone_number?: string;
    iccid?: string;
    imsi?: string;
    last_synced?: string;
    data_used_mb?: number;
    data_limit_mb?: number;
    balance?: number;
    signal_strength?: number;
    sim_status?: string;
    operator?: string;
    last_updated?: string;
}

interface DashboardSummary {
    total_linked: string;
    devices_without_sim: string;
    total_data_used_mb: string;
    total_balance: string;
    active_sims: string;
    suspended_sims: string;
}

interface LinkFormData {
    sim_control_id: string;
    phone_number: string;
    iccid: string;
    imsi: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function usagePct(used?: number, limit?: number): number {
    if (!used || !limit || limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
}

function statusColor(s?: string): string {
    switch ((s || '').toLowerCase()) {
        case 'active':    return '#4caf50';
        case 'suspended': return '#f44336';
        case 'dormant':   return '#ff9800';
        default:          return '#9e9e9e';
    }
}

function signalBars(strength?: number): string {
    if (strength === undefined || strength === null) return '—';
    if (strength >= 80) return '▂▄▆█';
    if (strength >= 60) return '▂▄▆·';
    if (strength >= 40) return '▂▄··';
    if (strength >= 20) return '▂···';
    return '····';
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SimDashboard: React.FC = () => {
    const [devices, setDevices] = useState<SimDevice[]>([]);
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'unlinked'>('all');
    const [linkModal, setLinkModal] = useState<{ deviceId: number; deviceName: string } | null>(null);
    const [linkForm, setLinkForm] = useState<LinkFormData>({ sim_control_id: '', phone_number: '', iccid: '', imsi: '' });
    const [linkError, setLinkError] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const [devRes, dashRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/sim/devices`),
                axios.get(`${API_BASE_URL}/api/sim/metrics/dashboard`),
            ]);
            setDevices(devRes.data);
            setSummary(dashRes.data.summary);
        } catch (err) {
            console.error('Error fetching SIM data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await axios.get(`${API_BASE_URL}/api/sim/sync`);
            await fetchData();
        } catch (err) {
            console.error('Sync error:', err);
        } finally {
            setSyncing(false);
        }
    };

    const handleLink = async () => {
        if (!linkModal) return;
        if (!linkForm.sim_control_id.trim()) {
            setLinkError('SimControl SIM ID is required');
            return;
        }
        try {
            await axios.post(`${API_BASE_URL}/api/sim/devices/${linkModal.deviceId}/link`, linkForm);
            setLinkModal(null);
            setLinkForm({ sim_control_id: '', phone_number: '', iccid: '', imsi: '' });
            setLinkError('');
            await fetchData();
        } catch (err: any) {
            setLinkError(err?.response?.data?.error || 'Failed to link SIM');
        }
    };

    const handleUnlink = async (deviceId: number) => {
        if (!window.confirm('Unlink SIM from this device?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/sim/devices/${deviceId}/unlink`);
            await fetchData();
        } catch (err) {
            console.error('Unlink error:', err);
        }
    };

    const handleSimAction = async (simId: string, action: 'suspend' | 'reactivate') => {
        const label = action === 'suspend' ? 'Suspend' : 'Reactivate';
        if (!window.confirm(`${label} SIM ${simId}?`)) return;
        try {
            await axios.post(`${API_BASE_URL}/api/sim/${simId}/${action}`);
            await fetchData();
        } catch (err: any) {
            alert(err?.response?.data?.error || `Failed to ${action} SIM`);
        }
    };

    // ── Filtering ────────────────────────────────────────────────────────────
    const filtered = devices.filter((d) => {
        const matchSearch =
            !search ||
            d.device_name?.toLowerCase().includes(search.toLowerCase()) ||
            d.phone_number?.includes(search) ||
            d.iccid?.includes(search) ||
            d.sim_control_id?.includes(search);

        const matchStatus =
            filterStatus === 'all' ||
            (filterStatus === 'unlinked' && !d.sim_control_id) ||
            (filterStatus !== 'unlinked' && (d.sim_status || '').toLowerCase() === filterStatus);

        return matchSearch && matchStatus;
    });

    // ── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return <div className="sim-loading">Loading SIM data…</div>;
    }

    return (
        <div className="sim-dashboard">
            {/* ── Header ── */}
            <div className="sim-header">
                <h2>📱 SIM Management</h2>
                <div className="sim-header-actions">
                    <a
                        href="https://app.simcontrol.co.za"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                    >
                        ↗ Open SimControl
                    </a>
                    <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
                        {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
                    </button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            {summary && (
                <div className="sim-summary-grid">
                    <div className="summary-card">
                        <span className="summary-value">{summary.active_sims ?? 0}</span>
                        <span className="summary-label">Active SIMs</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value">{summary.suspended_sims ?? 0}</span>
                        <span className="summary-label">Suspended SIMs</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value">{summary.devices_without_sim ?? 0}</span>
                        <span className="summary-label">Devices Without SIM</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value">
                            {summary.total_data_used_mb
                                ? `${(Number(summary.total_data_used_mb) / 1024).toFixed(1)} GB`
                                : '—'}
                        </span>
                        <span className="summary-label">Total Data Used</span>
                    </div>
                    <div className="summary-card">
                        <span className="summary-value">
                            {summary.total_balance != null ? `R${Number(summary.total_balance).toFixed(2)}` : '—'}
                        </span>
                        <span className="summary-label">Total Balance</span>
                    </div>
                </div>
            )}

            {/* ── Filters ── */}
            <div className="sim-filters">
                <input
                    type="text"
                    placeholder="Search by device, phone, ICCID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="sim-search"
                />
                <div className="filter-btns">
                    {(['all', 'active', 'suspended', 'unlinked'] as const).map((f) => (
                        <button
                            key={f}
                            className={filterStatus === f ? 'active' : ''}
                            onClick={() => setFilterStatus(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Device Table ── */}
            <div className="sim-table-wrapper">
                <table className="sim-table">
                    <thead>
                        <tr>
                            <th>Device</th>
                            <th>SIM Status</th>
                            <th>Phone</th>
                            <th>Operator</th>
                            <th>Data Usage</th>
                            <th>Balance</th>
                            <th>Signal</th>
                            <th>Last Synced</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="no-results">No devices found</td>
                            </tr>
                        ) : (
                            filtered.map((d) => {
                                const pct = usagePct(d.data_used_mb, d.data_limit_mb);
                                return (
                                    <tr key={d.device_id}>
                                        <td>
                                            <strong>{d.device_name}</strong>
                                            {d.imei && <div className="sub-text">IMEI: {d.imei}</div>}
                                        </td>
                                        <td>
                                            {d.sim_control_id ? (
                                                <span
                                                    className="status-badge"
                                                    style={{ backgroundColor: statusColor(d.sim_status) }}
                                                >
                                                    {d.sim_status || 'Unknown'}
                                                </span>
                                            ) : (
                                                <span className="status-badge unlinked">Not Linked</span>
                                            )}
                                        </td>
                                        <td>{d.phone_number || '—'}</td>
                                        <td>{d.operator || '—'}</td>
                                        <td>
                                            {d.sim_control_id && d.data_limit_mb ? (
                                                <div className="usage-cell">
                                                    <div className="usage-bar">
                                                        <div
                                                            className={`usage-fill ${pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : ''}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="usage-text">
                                                        {(d.data_used_mb ?? 0).toFixed(1)} / {d.data_limit_mb} MB ({pct}%)
                                                    </span>
                                                </div>
                                            ) : (
                                                <span>{d.data_used_mb != null ? `${d.data_used_mb} MB` : '—'}</span>
                                            )}
                                        </td>
                                        <td>
                                            {d.balance != null ? `R${Number(d.balance).toFixed(2)}` : '—'}
                                        </td>
                                        <td className="signal-cell" title={`${d.signal_strength ?? '?'}%`}>
                                            {signalBars(d.signal_strength)}
                                        </td>
                                        <td className="sub-text">
                                            {d.last_synced
                                                ? new Date(d.last_synced).toLocaleString()
                                                : '—'}
                                        </td>
                                        <td className="actions-cell">
                                            {d.sim_control_id ? (
                                                <>
                                                    {d.sim_status === 'active' && (
                                                        <button
                                                            className="btn btn-warn btn-sm"
                                                            onClick={() => handleSimAction(d.sim_control_id!, 'suspend')}
                                                        >
                                                            Suspend
                                                        </button>
                                                    )}
                                                    {d.sim_status === 'suspended' && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => handleSimAction(d.sim_control_id!, 'reactivate')}
                                                        >
                                                            Reactivate
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => handleUnlink(d.device_id)}
                                                    >
                                                        Unlink
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => {
                                                        setLinkModal({ deviceId: d.device_id, deviceName: d.device_name });
                                                        setLinkError('');
                                                    }}
                                                >
                                                    Link SIM
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Link SIM Modal ── */}
            {linkModal && (
                <div className="modal-overlay" onClick={() => setLinkModal(null)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <h3>Link SIM to {linkModal.deviceName}</h3>
                        <div className="modal-field">
                            <label>SimControl SIM ID *</label>
                            <input
                                type="text"
                                placeholder="e.g. SIM-12345"
                                value={linkForm.sim_control_id}
                                onChange={(e) => setLinkForm({ ...linkForm, sim_control_id: e.target.value })}
                            />
                        </div>
                        <div className="modal-field">
                            <label>Phone Number</label>
                            <input
                                type="text"
                                placeholder="+27…"
                                value={linkForm.phone_number}
                                onChange={(e) => setLinkForm({ ...linkForm, phone_number: e.target.value })}
                            />
                        </div>
                        <div className="modal-field">
                            <label>ICCID</label>
                            <input
                                type="text"
                                placeholder="89…"
                                value={linkForm.iccid}
                                onChange={(e) => setLinkForm({ ...linkForm, iccid: e.target.value })}
                            />
                        </div>
                        <div className="modal-field">
                            <label>IMSI</label>
                            <input
                                type="text"
                                placeholder="655…"
                                value={linkForm.imsi}
                                onChange={(e) => setLinkForm({ ...linkForm, imsi: e.target.value })}
                            />
                        </div>
                        {linkError && <p className="modal-error">{linkError}</p>}
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setLinkModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleLink}>Link SIM</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
