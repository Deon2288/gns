import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useWebSocket } from '../hooks/useWebSocket';

interface Device {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';
const POLL_INTERVAL_MS = 5000;

const DeviceMap: React.FC = () => {
    const [devices, setDevices] = useState<Device[]>([]);

    // WebSocket connection for real-time GPS updates
    const { isConnected, lastUpdate } = useWebSocket(WS_URL);

    // Initial load and periodic polling fallback
    const fetchDevices = () => {
        // Replace with real API call
        return [
            { id: 1, name: 'Device 1', lat: 51.505, lng: -0.09 },
            { id: 2, name: 'Device 2', lat: 51.51, lng: -0.1 },
            { id: 3, name: 'Device 3', lat: 51.51, lng: -0.12 },
        ];
    };

    useEffect(() => {
        // Populate device list on mount
        setDevices(fetchDevices());

        // Only poll when WebSocket is disconnected to avoid redundant fetches
        if (isConnected) return;

        const interval = setInterval(() => {
            setDevices(fetchDevices());
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isConnected]);

    // Apply real-time GPS update from WebSocket
    useEffect(() => {
        if (!lastUpdate) return;
        setDevices((prev) =>
            prev.map((device) =>
                device.id === lastUpdate.device_id
                    ? { ...device, lat: lastUpdate.latitude, lng: lastUpdate.longitude }
                    : device
            )
        );
    }, [lastUpdate]);

    return (
        <div style={{ position: 'relative' }}>
            {/* Live indicator badge */}
            <div
                style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    zIndex: 1000,
                    padding: '4px 10px',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    backgroundColor: isConnected ? '#22c55e' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
            >
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        opacity: isConnected ? 1 : 0.5,
                    }}
                />
                {isConnected ? 'Live' : 'Offline'}
            </div>

            <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '100vh', width: '100%' }}>
                <TileLayer
                    url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {devices.map(device => (
                    <Marker key={device.id} position={[device.lat, device.lng]}>
                        <Popup>{device.name}</Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default DeviceMap;