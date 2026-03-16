import React, { useEffect, useState } from 'react';

interface Overview {
    total_scans: number;
    completed_scans: number;
    total_devices_discovered: number;
    registered_devices: number;
    pending_devices: number;
    success_rate: string;
    avg_devices_per_scan: number;
}

interface Protocol { protocol: string; count: number; }
interface Manufacturer { manufacturer: string; count: number; }

const AnalyticsDashboard: React.FC = () => {
    const [overview, setOverview] = useState<Overview | null>(null);
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
    const [trends, setTrends] = useState<{ labels: string[]; scans_per_day: number[]; devices_per_day: number[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [ov, pr, mf, tr] = await Promise.all([
                fetch('/api/discovery/analytics/overview').then(r => r.json()),
                fetch('/api/discovery/analytics/protocols').then(r => r.json()),
                fetch('/api/discovery/analytics/manufacturers').then(r => r.json()),
                fetch('/api/discovery/analytics/trends').then(r => r.json()),
            ]);
            setOverview(ov);
            setProtocols(pr.protocols || []);
            setManufacturers(mf.manufacturers || []);
            setTrends(tr);
        } catch (err) {
            console.error('Analytics load error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const kpiCard = (label: string, value: string | number, color = '#3b82f6') => (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{label}</div>
        </div>
    );

    const maxProto = protocols.reduce((m, p) => Math.max(m, p.count), 1);
    const maxMfr   = manufacturers.reduce((m, p) => Math.max(m, p.count), 1);

    const exportCsv = () => { window.open('/api/discovery/analytics/export?format=csv', '_blank'); };

    return (
        <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>📊 Discovery Analytics</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={load} style={btnStyle('#334155')}>🔄 Refresh</button>
                    <button onClick={exportCsv} style={btnStyle('#3b82f6')}>📥 Export CSV</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, opacity: 0.5 }}>Loading analytics…</div>
            ) : (
                <>
                    {/* KPI row */}
                    {overview && (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                            {kpiCard('Total Scans',         overview.total_scans,             '#3b82f6')}
                            {kpiCard('Devices Discovered',  overview.total_devices_discovered, '#22c55e')}
                            {kpiCard('Registered',          overview.registered_devices,       '#eab308')}
                            {kpiCard('Pending',             overview.pending_devices,          '#f97316')}
                            {kpiCard('Success Rate',        `${overview.success_rate}%`,       '#a855f7')}
                            {kpiCard('Avg / Scan',          overview.avg_devices_per_scan,     '#06b6d4')}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Protocol distribution */}
                        <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                            <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>📶 Protocol Distribution</h3>
                            {protocols.length === 0 ? (
                                <p style={{ opacity: 0.4, fontSize: 13 }}>No data yet.</p>
                            ) : protocols.map(p => (
                                <div key={p.protocol} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                        <span>{p.protocol.toUpperCase()}</span>
                                        <span>{p.count}</span>
                                    </div>
                                    <div style={{ background: '#0f172a', borderRadius: 4, height: 8 }}>
                                        <div style={{
                                            width: `${(p.count / maxProto) * 100}%`,
                                            background: '#3b82f6', borderRadius: 4, height: 8,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Manufacturer breakdown */}
                        <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                            <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>🏭 Manufacturer Breakdown</h3>
                            {manufacturers.length === 0 ? (
                                <p style={{ opacity: 0.4, fontSize: 13 }}>No data yet.</p>
                            ) : manufacturers.map(m => (
                                <div key={m.manufacturer} style={{ marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                        <span>{m.manufacturer}</span>
                                        <span>{m.count}</span>
                                    </div>
                                    <div style={{ background: '#0f172a', borderRadius: 4, height: 8 }}>
                                        <div style={{
                                            width: `${(m.count / maxMfr) * 100}%`,
                                            background: '#22c55e', borderRadius: 4, height: 8,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Trends table */}
                        {trends && trends.labels.length > 0 && (
                            <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, gridColumn: '1 / -1' }}>
                                <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>📈 Discovery Trends</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                                            <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Date</th>
                                            <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Scans</th>
                                            <th style={{ padding: '6px 8px', borderBottom: '1px solid #334155' }}>Devices Found</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trends.labels.map((date, i) => (
                                            <tr key={date} style={{ borderBottom: '1px solid #0f172a' }}>
                                                <td style={{ padding: '6px 8px' }}>{date}</td>
                                                <td style={{ padding: '6px 8px' }}>{trends.scans_per_day[i]}</td>
                                                <td style={{ padding: '6px 8px' }}>{trends.devices_per_day[i]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

function btnStyle(bg: string): React.CSSProperties {
    return {
        padding: '6px 14px', borderRadius: 6, border: 'none',
        background: bg, color: '#fff', cursor: 'pointer', fontSize: 13,
    };
}

export default AnalyticsDashboard;
