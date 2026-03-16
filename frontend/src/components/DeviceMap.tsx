import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Fix default Leaflet marker icon paths broken by webpack asset handling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface DeviceRecord {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

const API_BASE = '';

const DeviceMap: React.FC = () => {
    const [devices, setDevices] = useState<DeviceRecord[]>([]);

    const fetchDevices = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/gps/latest`);
            const records: DeviceRecord[] = (res.data as any[]).map((item: any) => ({
                id: item.device_id ?? item.deviceId,
                name: item.device_name ?? `Device ${item.device_id ?? item.deviceId}`,
                lat: item.latitude ?? item.latestRecord?.lat ?? 0,
                lng: item.longitude ?? item.latestRecord?.lng ?? item.latestRecord?.lon ?? 0,
            }));
            setDevices(records.filter((d) => d.lat !== 0 || d.lng !== 0));
        } catch (err) {
            console.error('DeviceMap: failed to fetch GPS data', err);
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 30_000);
        return () => clearInterval(interval);
    }, [fetchDevices]);

    const defaultCenter: [number, number] = [51.505, -0.09];
    const center: [number, number] =
        devices.length > 0 ? [devices[0].lat, devices[0].lng] : defaultCenter;

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100vh', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {devices.map((device) => (
                <Marker key={device.id} position={[device.lat, device.lng]}>
                    <Popup>{device.name}</Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};

export default DeviceMap;