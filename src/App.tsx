import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import MapContainer from './components/MapContainer';
import DevicesPage from './components/DevicesPage';

const API_BASE = (window as any).REACT_APP_API_URL || 'http://localhost:5000/api';

interface DeviceLocation {
    device_id: number;
    device_name: string;
    latitude: number;
    longitude: number;
    status: string;
    timestamp?: string;
}

const ALERT_POLL_INTERVAL = 30_000;

/* ── Inline styles (no extra CSS file needed for this shell) ── */
const styles: Record<string, React.CSSProperties> = {
    app: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: '#f7fafc',
    },
    navbar: {
        display: 'flex',
        alignItems: 'center',
        background: '#1a365d',
        padding: '0 1.5rem',
        height: '52px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        gap: '0.25rem',
        flexShrink: 0,
    },
    brand: {
        color: '#90cdf4',
        fontWeight: 700,
        fontSize: '1.1rem',
        marginRight: '1.5rem',
        letterSpacing: '0.05em',
    },
    content: {
        flex: 1,
        overflow: 'auto',
    },
    mapWrapper: {
        width: '100%',
        height: '100%',
    },
};

const navLinkStyle: React.CSSProperties = {
    color: '#a0aec0',
    textDecoration: 'none',
    padding: '0.4rem 0.85rem',
    borderRadius: '5px',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
};

const navActiveLinkStyle: React.CSSProperties = {
    ...navLinkStyle,
    background: '#2b6cb0',
    color: '#fff',
};

/* ── Dashboard placeholder ── */
const Dashboard: React.FC = () => (
    <div style={{ padding: '2rem' }}>
        <h1>📊 Analytics Dashboard</h1>
        <p style={{ color: '#718096' }}>Fleet analytics and reporting will appear here.</p>
    </div>
);

/* ── Alerts placeholder ── */
const AlertsPage: React.FC<{ count: number }> = ({ count }) => (
    <div style={{ padding: '2rem' }}>
        <h1>🔔 Alerts {count > 0 && <span style={{ color: '#e53e3e' }}>({count})</span>}</h1>
        <p style={{ color: '#718096' }}>
            {count === 0 ? 'No active alerts.' : `You have ${count} active alert(s).`}
        </p>
    </div>
);

/* ── Admin placeholder ── */
const AdminPage: React.FC = () => (
    <div style={{ padding: '2rem' }}>
        <h1>⚙️ Admin Panel</h1>
        <p style={{ color: '#718096' }}>System administration settings will appear here.</p>
    </div>
);

/* ── Live Map view ── */
const MapView: React.FC = () => {
    const [deviceLocations, setDeviceLocations] = useState<DeviceLocation[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchLocations = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`${API_BASE}/gps/latest`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setDeviceLocations(
                Array.isArray(data)
                    ? data.map((d: any) => ({
                          device_id: d.deviceId ?? d.device_id,
                          device_name: d.device_name || `Device ${d.deviceId ?? d.device_id}`,
                          latitude: d.latestRecord?.lat ?? d.latitude,
                          longitude: d.latestRecord?.lon ?? d.longitude,
                          status: d.status || 'unknown',
                          timestamp: d.latestRecord?.timestamp ?? d.timestamp,
                      }))
                    : []
            );
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load GPS data');
        }
    }, []);

    useEffect(() => {
        fetchLocations();
        const id = setInterval(fetchLocations, 15_000);
        return () => clearInterval(id);
    }, [fetchLocations]);

    return (
        <div style={{ height: '100%', position: 'relative' }}>
            {error && (
                <div
                    style={{
                        position: 'absolute',
                        top: '0.75rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        background: '#fff5f5',
                        border: '1px solid #fc8181',
                        borderRadius: '6px',
                        padding: '0.4rem 0.9rem',
                        color: '#c53030',
                        fontSize: '0.8rem',
                    }}
                >
                    ⚠️ {error}
                </div>
            )}
            <MapContainer devices={deviceLocations} style={{ height: '100%' }} />
        </div>
    );
};

/* ── Root App ── */
const App: React.FC = () => {
    const [alertCount, setAlertCount] = useState(0);

    const fetchAlertCount = useCallback(async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${API_BASE}/alerts/count`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) return;
            const data = await res.json();
            setAlertCount(data.count ?? 0);
        } catch (_) {
            // Silently ignore – alerts count is non-critical
        }
    }, []);

    useEffect(() => {
        fetchAlertCount();
        const id = setInterval(fetchAlertCount, ALERT_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [fetchAlertCount]);

    const linkStyle = (isActive: boolean): React.CSSProperties =>
        isActive ? navActiveLinkStyle : navLinkStyle;

    return (
        <Router>
            <div style={styles.app}>
                {/* Navigation bar */}
                <nav style={styles.navbar}>
                    <span style={styles.brand}>🛰 GNS</span>
                    <NavLink to="/map" style={({ isActive }) => linkStyle(isActive)}>
                        🗺 Live Map
                    </NavLink>
                    <NavLink to="/devices" style={({ isActive }) => linkStyle(isActive)}>
                        🚗 Devices
                    </NavLink>
                    <NavLink to="/dashboard" style={({ isActive }) => linkStyle(isActive)}>
                        📊 Analytics
                    </NavLink>
                    <NavLink to="/alerts" style={({ isActive }) => linkStyle(isActive)}>
                        🔔 Alerts{alertCount > 0 ? ` (${alertCount})` : ''}
                    </NavLink>
                    <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
                        ⚙️ Admin
                    </NavLink>
                </nav>

                {/* Page content */}
                <main style={styles.content}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/map" replace />} />
                        <Route path="/map" element={
                            <div style={styles.mapWrapper}>
                                <MapView />
                            </div>
                        } />
                        <Route path="/devices" element={<DevicesPage />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/alerts" element={<AlertsPage count={alertCount} />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="*" element={<Navigate to="/map" replace />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

export default App;
