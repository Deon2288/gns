import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './InteractiveMap.css';

interface Device {
    device_id: number;
    device_name: string;
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    timestamp: string;
}

interface RoutePoint {
    latitude: number;
    longitude: number;
}

const customIcon = L.icon({
    iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="blue"/></svg>',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

const RoutePolyline: React.FC<{ routePoints: [number, number][] }> = ({ routePoints }) => {
    if (routePoints.length < 2) return null;
    return <Polyline positions={routePoints} color="blue" weight={2} opacity={0.6} />;
};

export const InteractiveMap: React.FC<{ selectedDeviceId?: number }> = ({ selectedDeviceId }) => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [routes, setRoutes] = useState<Map<number, [number, number][]>>(new Map());
    const [center, setCenter] = useState<[number, number]>([0, 0]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const devicesRes = await axios.get('${REACT_APP_API_URL}/api/devices');
                const gpsRes = await axios.get('${REACT_APP_API_URL}/api/gps/latest?limit=500');

                const devicesData: Device[] = devicesRes.data.map((d: any) => ({
                    device_id: d.device_id,
                    device_name: d.device_name,
                    latitude: 0,
                    longitude: 0,
                    speed: 0,
                    altitude: 0,
                    timestamp: new Date().toISOString(),
                }));

                const routesMap = new Map<number, [number, number][]>();
                const gpsMap = new Map<number, Device[]>();

                gpsRes.data.forEach((gps: any) => {
                    if (!gpsMap.has(gps.device_id)) {
                        gpsMap.set(gps.device_id, []);
                    }
                    gpsMap.get(gps.device_id)!.push(gps);
                });

                devicesData.forEach(device => {
                    const gpsPoints = gpsMap.get(device.device_id) || [];
                    if (gpsPoints.length > 0) {
                        const latest = gpsPoints[0];
                        device.latitude = latest.latitude;
                        device.longitude = latest.longitude;
                        device.speed = latest.speed;
                        device.altitude = latest.altitude;
                        device.timestamp = latest.timestamp;

                        const route: [number, number][] = gpsPoints
                            .slice(0, 50)
                            .reverse()
                            .map(p => [p.latitude, p.longitude]);
                        routesMap.set(device.device_id, route);
                    }
                });

                setDevices(devicesData);
                setRoutes(routesMap);

                if (devicesData.length > 0) {
                    setCenter([devicesData[0].latitude, devicesData[0].longitude]);
                }
                setLoading(false);
            } catch (err) {
                console.error('Error fetching map data:', err);
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '40px' }}>Loading map...</div>;
    }

    return (
        <MapContainer center={center} zoom={4} style={{ height: '100vh', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            {devices.map(device => (
                <React.Fragment key={device.device_id}>
                    <Marker
                        position={[device.latitude, device.longitude]}
                        icon={customIcon}
                        opacity={selectedDeviceId === device.device_id ? 1 : 0.7}
                    >
                        <Popup>
                            <div>
                                <h4>{device.device_name}</h4>
                                <p><strong>Speed:</strong> {device.speed.toFixed(1)} km/h</p>
                                <p><strong>Altitude:</strong> {device.altitude}m</p>
                                <p><strong>Last Update:</strong> {new Date(device.timestamp).toLocaleString()}</p>
                            </div>
                        </Popup>
                    </Marker>
                    {routes.get(device.device_id) && (
                        <RoutePolyline routePoints={routes.get(device.device_id)!} />
                    )}
                </React.Fragment>
            ))}
        </MapContainer>
    );
};
