import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export interface Device {
    device_id: number;
    device_name: string;
    imei?: string;
    last_seen?: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    speed?: number;
    course?: number;
    satellites?: number;
    timestamp?: string;
}

function getDeviceState(device: Device): 'active' | 'idle' | 'offline' {
    if (!device.last_seen || !device.timestamp) return 'offline';
    const lastUpdate = new Date(device.last_seen).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastUpdate) / 60000;
    if (diffMinutes > 10) return 'offline';
    if ((device.speed ?? 0) > 2) return 'active';
    return 'idle';
}

const STATE_COLORS: Record<string, string> = {
    active: '#22c55e',   // green
    idle: '#f59e0b',     // amber
    offline: '#ef4444',  // red
};

function createColoredIcon(color: string): L.DivIcon {
    return L.divIcon({
        className: '',
        html: `
            <div style="
                width: 18px;
                height: 18px;
                background: ${color};
                border: 3px solid #fff;
                border-radius: 50%;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12],
    });
}

interface DeviceMarkerProps {
    device: Device;
}

const DeviceMarker: React.FC<DeviceMarkerProps> = ({ device }) => {
    if (device.latitude == null || device.longitude == null) return null;

    const state = getDeviceState(device);
    const color = STATE_COLORS[state];
    const icon = createColoredIcon(color);

    const lastUpdate = device.timestamp
        ? new Date(device.timestamp).toLocaleString()
        : 'N/A';

    return (
        <Marker position={[device.latitude, device.longitude]} icon={icon}>
            <Popup>
                <div style={{ minWidth: '160px', fontSize: '13px' }}>
                    <strong style={{ fontSize: '14px' }}>{device.device_name}</strong>
                    {device.imei && (
                        <div style={{ color: '#6b7280', marginBottom: '4px' }}>IMEI: {device.imei}</div>
                    )}
                    <div>
                        <span
                            style={{
                                display: 'inline-block',
                                padding: '1px 8px',
                                borderRadius: '9999px',
                                background: color,
                                color: '#fff',
                                fontSize: '11px',
                                marginBottom: '6px',
                            }}
                        >
                            {state.toUpperCase()}
                        </span>
                    </div>
                    <div>📍 {device.latitude?.toFixed(5)}, {device.longitude?.toFixed(5)}</div>
                    {device.altitude != null && <div>⛰ Altitude: {device.altitude} m</div>}
                    {device.speed != null && <div>🚀 Speed: {device.speed} km/h</div>}
                    {device.satellites != null && <div>🛰 Satellites: {device.satellites}</div>}
                    <div style={{ color: '#9ca3af', marginTop: '4px', fontSize: '11px' }}>
                        Updated: {lastUpdate}
                    </div>
                </div>
            </Popup>
        </Marker>
    );
};

export default DeviceMarker;
