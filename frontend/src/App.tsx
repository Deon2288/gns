import React, { useState, useEffect } from 'react';
import DeviceMap from './components/DeviceMap';

type Tab = 'map' | 'devices' | 'discovery' | 'snmp' | 'alerts' | 'analytics';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface Device {
    id: number;
    name: string;
    type?: string;
    status?: string;
}

const Navbar: React.FC<{ activeTab: Tab; onTabChange: (tab: Tab) => void }> = ({ activeTab, onTabChange }) => {
    const tabs: { key: Tab; label: string }[] = [
        { key: 'map', label: '📍 Live Map' },
        { key: 'devices', label: '🖥 Devices' },
        { key: 'discovery', label: '🔍 Discovery' },
        { key: 'snmp', label: '📡 SNMP' },
        { key: 'alerts', label: '🚨 Alerts' },
        { key: 'analytics', label: '📊 Analytics' },
    ];

    return (
        <nav style={{ background: '#1a1a2e', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#e94560', fontWeight: 700, marginRight: 16, fontSize: 18 }}>GNS</span>
            {tabs.map(({ key, label }) => (
                <button
                    key={key}
                    onClick={() => onTabChange(key)}
                    style={{
                        background: activeTab === key ? '#e94560' : 'transparent',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        fontWeight: activeTab === key ? 700 : 400,
                        borderRadius: 4,
                    }}
                >
                    {label}
                </button>
            ))}
        </nav>
    );
};

const DevicesPage: React.FC = () => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [sortKey, setSortKey] = useState<keyof Device>('name');

    useEffect(() => {
        setLoading(true);
        fetch(`${API_BASE}/devices`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => { setDevices(Array.isArray(data) ? data : []); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, []);

    if (loading) return <div style={{ padding: 24 }}>Loading devices…</div>;
    if (error) return <div style={{ padding: 24, color: 'red' }}>Error: {error}</div>;

    const filtered = devices
        .filter(d => d.name && d.name.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? '')));

    return (
        <div style={{ padding: 24 }}>
            <h2>Device Management</h2>
            <input
                type="text"
                placeholder="Filter by name…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ marginBottom: 16, padding: '8px 12px', width: 260, borderRadius: 4, border: '1px solid #ccc' }}
            />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                        {(['name', 'type', 'status'] as (keyof Device)[]).map(col => (
                            <th
                                key={col}
                                onClick={() => setSortKey(col)}
                                style={{ padding: '10px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                            >
                                {col.charAt(0).toUpperCase() + col.slice(1)} {sortKey === col ? '▲' : ''}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filtered.map(device => (
                        <tr key={device.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px 12px' }}>{device.name}</td>
                            <td style={{ padding: '10px 12px' }}>{device.type ?? '—'}</td>
                            <td style={{ padding: '10px 12px' }}>{device.status ?? '—'}</td>
                        </tr>
                    ))}
                    {filtered.length === 0 && (
                        <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: '#999' }}>No devices found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
    <div style={{ padding: 32 }}>
        <h2>{title}</h2>
        <p style={{ color: '#666' }}>This section is under construction.</p>
    </div>
);

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('map');

    const renderContent = () => {
        switch (activeTab) {
            case 'map': return <DeviceMap />;
            case 'devices': return <DevicesPage />;
            case 'discovery': return <PlaceholderPage title="🔍 Discovery Scanner" />;
            case 'snmp': return <PlaceholderPage title="📡 SNMP Monitoring" />;
            case 'alerts': return <PlaceholderPage title="🚨 Alerts" />;
            case 'analytics': return <PlaceholderPage title="📊 Analytics Dashboard" />;
            default: return <PlaceholderPage title="Page Not Found" />;
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f5f5f5' }}>
            <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
            <main>{renderContent()}</main>
        </div>
    );
};

export default App;
