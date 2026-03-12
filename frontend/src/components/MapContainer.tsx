import React, { useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Device, getMarkerSvg, getStatusColor } from './DeviceMarker';
import RoutePolyline from './RoutePolyline';

// Fix Leaflet default icon paths broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface GpsPoint {
    latitude: number;
    longitude: number;
    speed?: number;
    timestamp?: string;
}

interface MapContainerProps {
    devices: Device[];
    routeHistory?: Map<string, GpsPoint[]>;
    selectedDeviceId?: string;
    onDeviceSelect?: (deviceId: string) => void;
}

/**
 * Creates a custom Leaflet DivIcon for a device marker.
 */
function createDeviceIcon(device: Device): L.DivIcon {
    return L.divIcon({
        html: getMarkerSvg(device.status),
        className: '',
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        popupAnchor: [0, -36],
    });
}

/**
 * Inner component: auto-fits the map bounds to show all devices.
 */
function AutoFitBounds({ devices }: { devices: Device[] }) {
    const map = useMap();
    useEffect(() => {
        if (devices.length === 0) return;
        const bounds = L.latLngBounds(devices.map(d => [d.latitude, d.longitude]));
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
    }, [devices, map]);
    return null;
}

/**
 * MapContainer renders an interactive Leaflet map with device markers and route trails.
 */
const MapContainer: React.FC<MapContainerProps> = ({
    devices,
    routeHistory,
    selectedDeviceId,
    onDeviceSelect,
}) => {
    const defaultCenter: [number, number] = [0, 0];

    return (
        <div style={{ height: '100%', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
            <LeafletMapContainer
                center={defaultCenter}
                zoom={3}
                style={{ height: '100%', width: '100%' }}
                zoomControl
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {devices.length > 0 && <AutoFitBounds devices={devices} />}

                {devices.map(device => (
                    <React.Fragment key={device.id}>
                        <Marker
                            position={[device.latitude, device.longitude]}
                            icon={createDeviceIcon(device)}
                            eventHandlers={{ click: () => onDeviceSelect?.(device.id) }}
                        >
                            <Popup>
                                <div style={{ minWidth: '160px', fontFamily: 'sans-serif' }}>
                                    <strong style={{ fontSize: '14px' }}>{device.name}</strong>
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#374151' }}>
                                        <div>
                                            <span style={{ color: getStatusColor(device.status), fontWeight: 'bold' }}>
                                                ● {device.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div>Speed: <strong>{device.speed} km/h</strong></div>
                                        <div>Altitude: <strong>{device.altitude} m</strong></div>
                                        <div>Last update: <strong>{new Date(device.lastUpdate).toLocaleTimeString()}</strong></div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>

                        {routeHistory?.has(device.id) && (
                            <RoutePolyline
                                points={routeHistory.get(device.id)!}
                                color={device.id === selectedDeviceId ? '#f97316' : '#3b82f6'}
                                weight={device.id === selectedDeviceId ? 4 : 2}
                            />
                        )}
                    </React.Fragment>
                ))}
            </LeafletMapContainer>
        </div>
    );
};

export default MapContainer;
