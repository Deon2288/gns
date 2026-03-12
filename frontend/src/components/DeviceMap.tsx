import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const DeviceMap: React.FC = () => {
    const [devices, setDevices] = useState<any[]>([]);

    // Mock function to fetch device GPS data
    const fetchDevices = () => {
        // Replace with real API call
        return [
            { id: 1, name: 'Device 1', lat: 51.505, lng: -0.09 },
            { id: 2, name: 'Device 2', lat: 51.51, lng: -0.1 },
            { id: 3, name: 'Device 3', lat: 51.51, lng: -0.12 },
        ];
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const fetchedDevices = fetchDevices();
            setDevices(fetchedDevices);
        }, 5000); // Fetch every 5 seconds

        return () => clearInterval(interval);
    }, []);

    return (
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
    );
};

export default DeviceMap;