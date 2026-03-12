import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DeviceMap: React.FC = () => {
    const [devices, setDevices] = useState<any[]>([]);

    const fetchDevices = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/gps/latest`);
            if (!res.ok) return;
            const data = await res.json();
            setDevices(data.filter((d: any) => d.latitude != null && d.longitude != null));
        } catch {
            // silently ignore fetch errors
        }
    };

    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 5000); // Fetch every 5 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <MapContainer center={[0, 20]} zoom={3} style={{ height: '100vh', width: '100%' }}>
            <TileLayer
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {devices.map(device => (
                <Marker key={device.device_id} position={[device.latitude, device.longitude]}>
                    <Popup>
                        <strong>{device.device_name}</strong><br />
                        Speed: {device.speed} km/h<br />
                        Altitude: {device.altitude} m
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
};

export default DeviceMap;