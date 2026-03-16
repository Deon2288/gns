import React, { useEffect, useState, useCallback } from 'react';
import {
    MapContainer as LeafletMapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import './MapContainer.css';

// Fix default Leaflet marker icon paths broken by webpack asset handling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Device {
    device_id: number;
    imei: string;
    device_name: string;
    [key: string]: any;
}

interface GPSData {
    device_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface DeviceLocation {
    device_id: number;
    imei: string;
    device_name: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    route: [number, number][];
}

// Use relative paths – proxied to backend by the React dev server
const API_BASE = '';

// ─── Helper: build a colored circle marker icon ───────────────────────────────

function makeIcon(color: 'green' | 'yellow'): L.DivIcon {
    const bg = color === 'green' ? '#22c55e' : '#eab308';
    return L.divIcon({
        className: '',
        html: `<span class="gns-marker" style="background:${bg}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
    });
}

// ─── Sub-component: auto-fit map to all device positions ─────────────────────

interface FitBoundsProps {
    positions: [number, number][];
}

const FitBounds: React.FC<FitBoundsProps> = ({ positions }) => {
    const map = useMap();
    useEffect(() => {
        const valid = positions.filter(([lat, lng]) => lat !== 0 || lng !== 0);
        if (valid.length > 0) {
            const bounds = L.latLngBounds(valid);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [positions, map]);
    return null;
};

// ─── Main MapView component ───────────────────────────────────────────────────

export const MapView: React.FC = () => {
    const [deviceLocations, setDeviceLocations] = useState<DeviceLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Determine if a device is "active" (updated within the last 5 minutes)
    const isActive = (timestamp: string): boolean => {
        const lastSeen = new Date(timestamp).getTime();
        return Date.now() - lastSeen < 5 * 60 * 1000;
    };

    const fetchDeviceLocations = useCallback(async () => {
        try {
            // Fetch all devices
            const devicesRes = await axios.get<Device[]>(`${API_BASE}/api/devices`);
            const devices: Device[] = devicesRes.data;

            // Fetch latest GPS data for each device
            const locationPromises = devices.map(async (device) => {
                try {
                    const gpsRes = await axios.get<GPSData[]>(
                        `${API_BASE}/api/gps/device/${device.device_id}`
                    );
                    const records: GPSData[] = Array.isArray(gpsRes.data) ? gpsRes.data : [];

                    // Build route from all records; latest record is the current position
                    const route: [number, number][] = records.map((r) => [
                        r.latitude,
                        r.longitude,
                    ]);
                    const latest = records.length > 0 ? records[records.length - 1] : null;

                    return {
                        device_id: device.device_id,
                        imei: device.imei,
                        device_name: device.device_name,
                        latitude: latest ? latest.latitude : 0,
                        longitude: latest ? latest.longitude : 0,
                        timestamp: latest ? latest.timestamp : '',
                        route,
                    } as DeviceLocation;
                } catch {
                    return {
                        device_id: device.device_id,
                        imei: device.imei,
                        device_name: device.device_name,
                        latitude: 0,
                        longitude: 0,
                        timestamp: '',
                        route: [],
                    } as DeviceLocation;
                }
            });

            const locations = await Promise.all(locationPromises);
            setDeviceLocations(locations);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Error fetching device locations:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load + 30-second polling
    useEffect(() => {
        fetchDeviceLocations();
        const interval = setInterval(fetchDeviceLocations, 30_000);
        return () => clearInterval(interval);
    }, [fetchDeviceLocations]);

    const handleDeleteDevice = async (deviceId: number) => {
        if (!window.confirm('Are you sure you want to delete this device?')) return;
        try {
            await axios.delete(`${API_BASE}/api/devices/${deviceId}`);
            setDeviceLocations((prev) => prev.filter((d) => d.device_id !== deviceId));
        } catch (err) {
            console.error('Error deleting device:', err);
        }
    };

    // All valid positions (exclude 0,0 – likely unset GPS) for FitBounds
    const validPositions: [number, number][] = deviceLocations
        .filter((d) => d.latitude !== 0 || d.longitude !== 0)
        .map((d) => [d.latitude, d.longitude]);

    // Default map center: London, falls back when no valid positions exist
    const defaultCenter: [number, number] = [51.505, -0.09];

    return (
        <div className="map-view-container">
            <div className="map-header">
                <h2>Live Vehicle Tracking</h2>
                <div className="map-header-controls">
                    <span className="refresh-info">
                        Last updated: {lastRefresh.toLocaleTimeString()}
                    </span>
                    <button className="btn-refresh" onClick={fetchDeviceLocations}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            <div className="map-body">
                {/* ── Leaflet Map ────────────────────────────────────────── */}
                <div className="map-wrapper">
                    {loading ? (
                        <div className="map-loading">Loading map…</div>
                    ) : (
                        <LeafletMapContainer
                            center={validPositions.length > 0 ? validPositions[0] : defaultCenter}
                            zoom={validPositions.length > 0 ? 10 : 13}
                            className="leaflet-map"
                            scrollWheelZoom
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />

                            {/* Auto-fit to all device positions */}
                            {validPositions.length > 0 && (
                                <FitBounds positions={validPositions} />
                            )}

                            {deviceLocations.map((device) => {
                                const hasPosition = device.latitude !== 0 || device.longitude !== 0;
                                if (!hasPosition) return null;

                                const active = isActive(device.timestamp);
                                const icon = makeIcon(active ? 'green' : 'yellow');
                                const position: [number, number] = [
                                    device.latitude,
                                    device.longitude,
                                ];

                                return (
                                    <React.Fragment key={device.device_id}>
                                        {/* Route polyline */}
                                        {device.route.length > 1 && (
                                            <Polyline
                                                positions={device.route}
                                                color={active ? '#22c55e' : '#eab308'}
                                                opacity={0.5}
                                                weight={3}
                                            />
                                        )}

                                        {/* Device marker */}
                                        <Marker position={position} icon={icon}>
                                            <Popup>
                                                <div className="marker-popup">
                                                    <h4>{device.device_name}</h4>
                                                    <p>
                                                        <strong>IMEI:</strong> {device.imei}
                                                    </p>
                                                    <p>
                                                        <strong>Location:</strong>{' '}
                                                        {device.latitude.toFixed(6)},{' '}
                                                        {device.longitude.toFixed(6)}
                                                    </p>
                                                    <p>
                                                        <strong>Last Update:</strong>{' '}
                                                        {device.timestamp
                                                            ? new Date(
                                                                  device.timestamp
                                                              ).toLocaleString()
                                                            : 'N/A'}
                                                    </p>
                                                    <p className={active ? 'status-active' : 'status-idle'}>
                                                        {active ? '● Active' : '● Idle'}
                                                    </p>
                                                    <button
                                                        className="btn-delete-popup"
                                                        onClick={() =>
                                                            handleDeleteDevice(device.device_id)
                                                        }
                                                    >
                                                        Delete Device
                                                    </button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    </React.Fragment>
                                );
                            })}
                        </LeafletMapContainer>
                    )}

                    {/* ── Map Legend ────────────────────────────────────── */}
                    <div className="map-legend">
                        <h5>Legend</h5>
                        <span>
                            <span className="legend-dot" style={{ background: '#22c55e' }} />
                            Active (&lt;5 min)
                        </span>
                        <span>
                            <span className="legend-dot" style={{ background: '#eab308' }} />
                            Idle
                        </span>
                    </div>
                </div>

                {/* ── Device List Sidebar ────────────────────────────────── */}
                <div className="device-sidebar">
                    <h3>
                        Devices{' '}
                        <span className="device-count">{deviceLocations.length}</span>
                    </h3>
                    {loading ? (
                        <p className="sidebar-loading">Loading devices…</p>
                    ) : deviceLocations.length === 0 ? (
                        <p className="sidebar-empty">No devices found.</p>
                    ) : (
                        <ul className="device-list">
                            {deviceLocations.map((device) => (
                                <li key={device.device_id} className="device-card">
                                    <div className="device-card-header">
                                        <span className="device-name">{device.device_name}</span>
                                        <span
                                            className={`device-status ${
                                                isActive(device.timestamp) ? 'active' : 'idle'
                                            }`}
                                        >
                                            {isActive(device.timestamp) ? 'Active' : 'Idle'}
                                        </span>
                                    </div>
                                    <div className="device-card-body">
                                        <p>
                                            <strong>IMEI:</strong> {device.imei}
                                        </p>
                                        <p>
                                            <strong>Lat:</strong>{' '}
                                            {device.latitude !== 0
                                                ? device.latitude.toFixed(6)
                                                : 'N/A'}
                                        </p>
                                        <p>
                                            <strong>Lng:</strong>{' '}
                                            {device.longitude !== 0
                                                ? device.longitude.toFixed(6)
                                                : 'N/A'}
                                        </p>
                                        <p>
                                            <strong>Updated:</strong>{' '}
                                            {device.timestamp
                                                ? new Date(device.timestamp).toLocaleString()
                                                : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="device-card-actions">
                                        <button
                                            className="btn-delete"
                                            onClick={() => handleDeleteDevice(device.device_id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapView;
