import React, { useEffect, useState } from 'react';
import MapContainer, { Device } from './MapContainer';

const DeviceMap: React.FC = () => {
    const [devices, setDevices] = useState<Device[]>([]);

    // Fetch device GPS data from the backend API
    const fetchDevices = async (): Promise<Device[]> => {
        try {
            const response = await fetch('/api/gps');
            if (!response.ok) return getMockDevices();
            const data = await response.json();
            // Map API response to Device shape
            return data.map((d: any) => ({
                id: d.device_id ?? d.id,
                name: d.device_name ?? `Device ${d.device_id ?? d.id}`,
                lat: d.latitude,
                lng: d.longitude,
                status: d.status ?? 'unknown',
                speed: d.speed,
                altitude: d.altitude,
                heading: d.heading,
                battery: d.battery,
                imei: d.imei,
                lastUpdate: d.timestamp,
            }));
        } catch {
            return getMockDevices();
        }
    };

    useEffect(() => {
        // Initial load
        fetchDevices().then(setDevices);

        const interval = setInterval(() => {
            fetchDevices().then(setDevices);
        }, 5000); // Refresh every 5 seconds

        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <MapContainer devices={devices} />;
};

/** Fallback mock data used when the API is unavailable. */
function getMockDevices(): Device[] {
    return [
        { id: 1, name: 'Device 1', lat: 51.505, lng: -0.09, status: 'active' },
        { id: 2, name: 'Device 2', lat: 51.51, lng: -0.1, status: 'idle' },
        { id: 3, name: 'Device 3', lat: 51.51, lng: -0.12, status: 'offline' },
    ];
}

export default DeviceMap;