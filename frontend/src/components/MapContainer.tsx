import React, { useEffect, useRef } from 'react';
import {
    MapContainer as LeafletMapContainer,
    TileLayer,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DeviceMarker, { Device } from './DeviceMarker';
import RoutePolyline from './RoutePolyline';

// Fix Leaflet default icon path issue in CRA
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface FitBoundsProps {
    devices: Device[];
}

// Auto-fit map to show all device markers
function FitBounds({ devices }: FitBoundsProps) {
    const map = useMap();
    const fitted = useRef(false);

    useEffect(() => {
        const located = devices.filter(
            (d) => d.latitude != null && d.longitude != null
        );
        if (located.length === 0) return;

        const bounds = L.latLngBounds(
            located.map((d) => [d.latitude as number, d.longitude as number])
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        fitted.current = true;
    }, [devices, map]);

    return null;
}

interface MapContainerProps {
    devices: Device[];
    showRoutes?: boolean;
}

const ROUTE_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#eab308', '#06b6d4', '#84cc16',
];

const MapContainerComponent: React.FC<MapContainerProps> = ({
    devices,
    showRoutes = true,
}) => {
    return (
        <LeafletMapContainer
            center={[0, 20]}
            zoom={3}
            style={{ height: '100%', width: '100%' }}
        >
            {/* OpenStreetMap tile layer */}
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Device markers */}
            {devices.map((device) => (
                <DeviceMarker key={device.device_id} device={device} />
            ))}

            {/* Route breadcrumb trails */}
            {showRoutes &&
                devices.map((device, idx) => (
                    <RoutePolyline
                        key={device.device_id}
                        deviceId={device.device_id}
                        color={ROUTE_COLORS[idx % ROUTE_COLORS.length]}
                    />
                ))}

            {/* Auto-fit bounds once devices load */}
            <FitBounds devices={devices} />
        </LeafletMapContainer>
    );
};

export default MapContainerComponent;
