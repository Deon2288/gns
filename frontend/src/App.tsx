import React, { useEffect, useState, useCallback } from 'react';
import MapContainerComponent from './components/MapContainer';
import { Device } from './components/DeviceMarker';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const REFRESH_INTERVAL = 5000;

function App() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showRoutes, setShowRoutes] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchDevices = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/gps/latest`);
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            const data: Device[] = await res.json();
            setDevices(data);
            setLastUpdated(new Date());
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch devices');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchDevices]);

    const activeCount = devices.filter(
        (d) => d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 600000
    ).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
            {/* Header / Toolbar */}
            <div
                style={{
                    background: '#1e293b',
                    color: '#f8fafc',
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    zIndex: 1000,
                }}
            >
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    📍 GNS Live Tracking
                </h1>

                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                    {loading
                        ? 'Loading…'
                        : error
                        ? `⚠ ${error}`
                        : `${devices.length} device${devices.length !== 1 ? 's' : ''} · ${activeCount} active`}
                </div>

                {lastUpdated && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                        Updated: {lastUpdated.toLocaleTimeString()}
                    </div>
                )}

                <label
                    style={{
                        fontSize: '13px',
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={showRoutes}
                        onChange={(e) => setShowRoutes(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    Show routes
                </label>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    {[
                        { label: 'Active', color: '#22c55e' },
                        { label: 'Idle', color: '#f59e0b' },
                        { label: 'Offline', color: '#ef4444' },
                    ].map(({ label, color }) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: color,
                                    display: 'inline-block',
                                }}
                            />
                            {label}
                        </span>
                    ))}
                </div>
            </div>

            {/* Map */}
            <div style={{ flex: 1, position: 'relative' }}>
                {loading && devices.length === 0 ? (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f1f5f9',
                            fontSize: '16px',
                            color: '#64748b',
                        }}
                    >
                        Loading map…
                    </div>
                ) : (
                    <MapContainerComponent devices={devices} showRoutes={showRoutes} />
                )}
            </div>
        </div>
    );
}

export default App;
