import React from 'react';

export type DeviceStatus = 'active' | 'idle' | 'offline';

export interface Device {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    status: DeviceStatus;
    lastUpdate: string;
}

interface DeviceMarkerProps {
    device: Device;
}

/**
 * Returns the CSS color for a device status.
 */
export function getStatusColor(status: DeviceStatus): string {
    switch (status) {
        case 'active': return '#22c55e';   // green
        case 'idle': return '#eab308';     // yellow
        case 'offline': return '#ef4444';  // red
        default: return '#6b7280';
    }
}

/**
 * Returns an SVG icon string for a device marker pin.
 */
export function getMarkerSvg(status: DeviceStatus): string {
    const color = getStatusColor(status);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"
              fill="${color}" stroke="#fff" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/>
    </svg>`;
}

/**
 * DeviceMarker renders a styled marker card for use outside the Leaflet map context.
 */
const DeviceMarker: React.FC<DeviceMarkerProps> = ({ device }) => {
    const color = getStatusColor(device.status);
    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '20px',
            backgroundColor: '#1f2937',
            border: `2px solid ${color}`,
            color: '#f9fafb',
            fontSize: '13px',
            fontFamily: 'sans-serif',
        }}>
            <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
            }} />
            <strong>{device.name}</strong>
            <span style={{ color: '#9ca3af' }}>
                {device.speed} km/h | {device.status}
            </span>
        </div>
    );
};

export default DeviceMarker;
