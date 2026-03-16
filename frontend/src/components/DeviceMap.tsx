import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayerGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── Marker colour helpers ────────────────────────────────────────────────────

const MARKER_COLORS: Record<string, string> = {
    green:  '#22c55e',
    blue:   '#3b82f6',
    red:    '#ef4444',
    yellow: '#eab308',
};

function coloredIcon(color: string) {
    return L.divIcon({
        className: '',
        html: `<div style="
            width:14px;height:14px;border-radius:50%;
            background:${color};border:2px solid #fff;
            box-shadow:0 0 4px rgba(0,0,0,.4);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
    });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscoveredDevice {
    device_id: string;
    ip: string;
    manufacturer: string;
    model: string;
    protocol: string;
    status: string;
    registration_status: string;
    latitude: number;
    longitude: number;
    discovered_at: string;
    marker_color: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DeviceMap: React.FC = () => {
    const [devices, setDevices]         = useState<DiscoveredDevice[]>([]);
    const [loading, setLoading]         = useState(false);
    const [filter, setFilter]           = useState<'all' | 'online' | 'offline' | 'registered'>('all');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const wsRef                         = useRef<WebSocket | null>(null);

    // ── Fetch devices from map API ────────────────────────────────────────────
    const fetchDevices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/discovery/map/devices');
            if (res.ok) {
                const data = await res.json();
                setDevices(data.devices || []);
            }
        } catch (err) {
            console.error('Failed to fetch map devices:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Connect to live stream ────────────────────────────────────────────────
    useEffect(() => {
        fetchDevices();

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${protocol}://${window.location.host}/api/discovery/map/stream`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'new_device') {
                    setDevices(prev => {
                        const exists = prev.some(d => d.device_id === msg.device.device_id);
                        return exists ? prev : [...prev, msg.device];
                    });
                }
            } catch (_) {}
        };

        const interval = setInterval(fetchDevices, 15000);
        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, []);

    // ── Filter devices ────────────────────────────────────────────────────────
    const visible = devices.filter(d => {
        if (filter === 'all') return true;
        if (filter === 'online') return d.status === 'online';
        if (filter === 'offline') return d.status === 'offline';
        if (filter === 'registered') return d.registration_status === 'registered';
        return true;
    });

    const hasCoords = (d: DiscoveredDevice) =>
        typeof d.latitude === 'number' && typeof d.longitude === 'number' &&
        !isNaN(d.latitude) && !isNaN(d.longitude);

    const mapDevices = visible.filter(hasCoords);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 16px', background: '#1e293b', color: '#fff',
                flexWrap: 'wrap',
            }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>
                    🌍 Live Discovery Map
                </span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>
                    {loading ? 'Loading…' : `${mapDevices.length} device${mapDevices.length !== 1 ? 's' : ''} shown`}
                </span>

                {/* Filter buttons */}
                {(['all', 'online', 'offline', 'registered'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                            background: filter === f ? '#3b82f6' : '#334155',
                            color: '#fff', fontSize: 12, textTransform: 'capitalize',
                        }}
                    >
                        {f}
                    </button>
                ))}

                <button
                    onClick={() => setShowHeatmap(h => !h)}
                    style={{
                        padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: showHeatmap ? '#8b5cf6' : '#334155',
                        color: '#fff', fontSize: 12,
                    }}
                >
                    {showHeatmap ? '🔥 Heatmap On' : '🔥 Heatmap Off'}
                </button>

                <button
                    onClick={fetchDevices}
                    style={{
                        padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: '#334155', color: '#fff', fontSize: 12, marginLeft: 'auto',
                    }}
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Legend */}
            <div style={{
                display: 'flex', gap: 16, padding: '6px 16px',
                background: '#0f172a', fontSize: 12, color: '#94a3b8',
            }}>
                {[
                    { color: MARKER_COLORS.green,  label: 'Online / Active' },
                    { color: MARKER_COLORS.blue,   label: 'Newly Discovered' },
                    { color: MARKER_COLORS.red,    label: 'Offline' },
                    { color: MARKER_COLORS.yellow, label: 'Registered' },
                ].map(({ color, label }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: color, display: 'inline-block',
                        }} />
                        {label}
                    </span>
                ))}
            </div>

            {/* Map */}
            <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ flex: 1 }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <LayerGroup>
                    {mapDevices.map(device => (
                        <React.Fragment key={device.device_id}>
                            <Marker
                                position={[device.latitude, device.longitude]}
                                icon={coloredIcon(MARKER_COLORS[device.marker_color] || MARKER_COLORS.green)}
                            >
                                <Popup>
                                    <div style={{ minWidth: 180, fontSize: 13 }}>
                                        <strong>📡 {device.manufacturer} {device.model}</strong>
                                        <hr style={{ margin: '4px 0' }} />
                                        <div>🌐 <b>IP:</b> {device.ip}</div>
                                        <div>📶 <b>Protocol:</b> {device.protocol.toUpperCase()}</div>
                                        <div>💡 <b>Status:</b> {device.status}</div>
                                        <div>📋 <b>Registration:</b> {device.registration_status}</div>
                                        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                            Discovered: {new Date(device.discovered_at).toLocaleString()}
                                        </div>
                                        {device.registration_status === 'pending' && (
                                            <button
                                                style={{
                                                    marginTop: 8, padding: '4px 10px',
                                                    background: '#3b82f6', color: '#fff',
                                                    border: 'none', borderRadius: 4, cursor: 'pointer',
                                                    fontSize: 12,
                                                }}
                                                onClick={() => alert(`Register device ${device.device_id}`)}
                                            >
                                                ➕ Register Device
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>

                            {/* Heatmap overlay: concentric circles */}
                            {showHeatmap && (
                                <Circle
                                    center={[device.latitude, device.longitude]}
                                    radius={50000}
                                    pathOptions={{ color: 'transparent', fillColor: '#ef4444', fillOpacity: 0.05 }}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </LayerGroup>
            </MapContainer>
        </div>
    );
};

export default DeviceMap;