import React, { useState, useCallback, useRef } from 'react';
import MapContainer from './components/MapContainer';
import AlertsPanel from './components/AlertsPanel';
import Dashboard from './components/Dashboard';
import TripHistory, { Trip } from './components/TripHistory';
import { useWebSocket, GpsUpdate, AlertMessage } from './hooks/useWebSocket';
import { computeFleetStats, buildSpeedDistribution, GpsRecord } from './utils/analytics';
import { Device } from './components/DeviceMarker';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

type TabType = 'map' | 'dashboard' | 'trips' | 'alerts';

const App: React.FC = () => {
    const [devices, setDevices] = useState<Map<string, Device>>(new Map());
    const [routeHistory, setRouteHistory] = useState<Map<string, GpsRecord[]>>(new Map());
    const [alerts, setAlerts] = useState<AlertMessage[]>([]);
    const [trips] = useState<Trip[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
    const [activeTab, setActiveTab] = useState<TabType>('map');
    const routeHistoryRef = useRef<Map<string, GpsRecord[]>>(new Map());

    const handleGpsUpdate = useCallback((data: GpsUpdate) => {
        setDevices(prev => {
            const next = new Map(prev);
            const existing = prev.get(data.device_id);
            const minutesSince = data.timestamp
                ? (Date.now() - new Date(data.timestamp).getTime()) / 60000
                : 0;
            const status: Device['status'] = minutesSince > 5 ? 'offline' : data.speed > 2 ? 'active' : 'idle';

            next.set(data.device_id, {
                id: data.device_id,
                name: existing?.name || `Device ${data.device_id}`,
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed,
                altitude: data.altitude,
                status,
                lastUpdate: data.timestamp,
            });
            return next;
        });

        // Append to route history (keep last 50 points)
        const history = routeHistoryRef.current;
        const pts = history.get(data.device_id) || [];
        pts.push({
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            altitude: data.altitude,
            timestamp: data.timestamp,
        });
        if (pts.length > 50) pts.splice(0, pts.length - 50);
        history.set(data.device_id, pts);
        setRouteHistory(new Map(history));
    }, []);

    const handleAlert = useCallback((data: AlertMessage) => {
        setAlerts(prev => [data, ...prev].slice(0, 100));
    }, []);

    const { status: wsStatus } = useWebSocket({
        url: WS_URL,
        onGpsUpdate: handleGpsUpdate,
        onAlert: handleAlert,
    });

    const handleAcknowledge = (index: number) => {
        setAlerts(prev => prev.filter((_, i) => i !== index));
    };

    const handleExportCsv = (tripId: number) => {
        window.open(`/api/trips/${tripId}/export/csv`, '_blank');
    };

    const deviceList = Array.from(devices.values());
    const fleetStats = computeFleetStats(routeHistory);

    // Build speed distribution for selected device, or all devices combined
    const speedRecords = selectedDeviceId
        ? routeHistory.get(selectedDeviceId) || []
        : Array.from(routeHistory.values()).flat();
    const speedDistribution = buildSpeedDistribution(speedRecords);

    const tabStyle = (tab: TabType): React.CSSProperties => ({
        padding: '8px 16px',
        border: 'none',
        borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
        backgroundColor: 'transparent',
        color: activeTab === tab ? '#60a5fa' : '#9ca3af',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: activeTab === tab ? 'bold' : 'normal',
        transition: 'color 0.15s',
    });

    const statusDotColor = wsStatus === 'connected' ? '#22c55e' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444';

    return (
        <div style={{
            backgroundColor: '#0f172a',
            minHeight: '100vh',
            color: '#f9fafb',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Header */}
            <header style={{
                backgroundColor: '#111827',
                borderBottom: '1px solid #1f2937',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🛰️</span>
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>GPS Tracking System</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusDotColor, display: 'inline-block' }} />
                    <span style={{ color: '#9ca3af' }}>
                        {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </span>
                    <span style={{ color: '#6b7280', marginLeft: '12px' }}>
                        {deviceList.length} device{deviceList.length !== 1 ? 's' : ''}
                    </span>
                    {alerts.length > 0 && (
                        <span style={{
                            backgroundColor: '#ef4444',
                            borderRadius: '10px',
                            padding: '1px 7px',
                            fontSize: '11px',
                            marginLeft: '8px',
                        }}>
                            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </header>

            {/* Navigation tabs */}
            <nav style={{
                backgroundColor: '#111827',
                borderBottom: '1px solid #1f2937',
                padding: '0 20px',
                display: 'flex',
                gap: '4px',
            }}>
                {([['map', '🗺️ Map'], ['dashboard', '📊 Dashboard'], ['trips', '🗺️ Trips'], ['alerts', '🔔 Alerts']] as [TabType, string][]).map(([tab, label]) => (
                    <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
                        {label}
                        {tab === 'alerts' && alerts.length > 0 && (
                            <span style={{
                                marginLeft: '6px',
                                backgroundColor: '#ef4444',
                                borderRadius: '8px',
                                padding: '1px 5px',
                                fontSize: '10px',
                                color: '#fff',
                            }}>
                                {alerts.length}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Main content */}
            <main style={{ flex: 1, padding: '16px', overflow: 'hidden' }}>
                {activeTab === 'map' && (
                    <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 160px)' }}>
                        <div style={{ flex: 1, minHeight: '400px' }}>
                            <MapContainer
                                devices={deviceList}
                                routeHistory={routeHistory}
                                selectedDeviceId={selectedDeviceId}
                                onDeviceSelect={setSelectedDeviceId}
                            />
                        </div>
                        <div style={{ width: '300px', flexShrink: 0 }}>
                            <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
                        </div>
                    </div>
                )}

                {activeTab === 'dashboard' && (
                    <Dashboard fleetStats={fleetStats} speedDistribution={speedDistribution} />
                )}

                {activeTab === 'trips' && (
                    <TripHistory
                        trips={trips}
                        onExportCsv={handleExportCsv}
                        deviceFilter={selectedDeviceId}
                    />
                )}

                {activeTab === 'alerts' && (
                    <AlertsPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
                )}
            </main>
        </div>
    );
};

export default App;
