import React, { useEffect, useState } from 'react';
import './GPSMap.css';

interface GPSData {
    gps_id: number;
    device_id: number;
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    timestamp: string;
}

interface Device {
    device_id?: number;
    id?: number;
    device_name: string;
    imei: string;
    status: string;
}

interface GPSMapProps {
    devices: Device[];
}

const GPSMap: React.FC<GPSMapProps> = ({ devices }) => {
    const [gpsData, setGpsData] = useState<GPSData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGPSData = async () => {
        try {
            const response = await fetch('http://197.242.150.120:5000/api/gps/latest');
            if (!response.ok) throw new Error('Failed to fetch GPS data');
            const data = await response.json();
            setGpsData(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGPSData();
        // Refresh every 5 seconds
        const interval = setInterval(fetchGPSData, 5000);
        return () => clearInterval(interval);
    }, []);

    const getDeviceName = (deviceId: number) => {
        const device = devices.find(d => (d.device_id || d.id) === deviceId);
        return device?.device_name || `Device ${deviceId}`;
    };

    return (
        <div className="gps-map-container">
            <h2>📍 Real-time GPS Tracking</h2>
            
            {error && <div className="error-message">⚠️ {error}</div>}
            {loading && <div className="loading">Loading GPS data...</div>}

            {!loading && gpsData.length === 0 && (
                <p className="no-data">No GPS data available. Send test data below.</p>
            )}

            {!loading && gpsData.length > 0 && (
                <div className="gps-list">
                    {gpsData.map((data) => (
                        <div key={data.gps_id} className="gps-card">
                            <div className="gps-header">
                                <h3>{getDeviceName(data.device_id)}</h3>
                                <span className="timestamp">{new Date(data.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="gps-info">
                                <div className="gps-row">
                                    <span className="label">📍 Latitude:</span>
                                    <span className="value">{data.latitude.toFixed(6)}</span>
                                </div>
                                <div className="gps-row">
                                    <span className="label">🧭 Longitude:</span>
                                    <span className="value">{data.longitude.toFixed(6)}</span>
                                </div>
                                <div className="gps-row">
                                    <span className="label">⚡ Speed:</span>
                                    <span className="value">{data.speed.toFixed(2)} km/h</span>
                                </div>
                                <div className="gps-row">
                                    <span className="label">📈 Altitude:</span>
                                    <span className="value">{data.altitude.toFixed(2)} m</span>
                                </div>
                            </div>
                            <div className="gps-map-link">
                                <a 
                                    href={`https://www.google.com/maps/@${data.latitude},${data.longitude},15z`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-map"
                                >
                                    🗺️ View on Google Maps
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="test-section">
                <h3>🧪 Test GPS Data</h3>
                <GPSTestForm devices={devices} onDataSent={fetchGPSData} />
            </div>
        </div>
    );
};

// Test form component to send mock GPS data
interface GPSTestFormProps {
    devices: Device[];
    onDataSent: () => void;
}

const GPSTestForm: React.FC<GPSTestFormProps> = ({ devices, onDataSent }) => {
    const [formData, setFormData] = useState({
        device_id: devices.length > 0 ? (devices[0].device_id || devices[0].id || 1) : 1,
        latitude: -33.8688,
        longitude: 18.4241,
        speed: 45.5,
        altitude: 50,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === 'device_id' ? parseInt(value) : parseFloat(value),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch('http://197.242.150.120:5000/api/gps/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (!response.ok) throw new Error('Failed to send GPS data');
            onDataSent();
            alert('✅ GPS data sent successfully!');
        } catch (err) {
            alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="gps-test-form">
            <div className="form-group">
                <label htmlFor="device_id">Device:</label>
                <select id="device_id" name="device_id" value={formData.device_id} onChange={handleChange}>
                    {devices.map((device) => (
                        <option key={device.device_id || device.id} value={device.device_id || device.id || 1}>
                            {device.device_name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="latitude">Latitude:</label>
                <input
                    type="number"
                    id="latitude"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    step="0.0001"
                />
            </div>
            <div className="form-group">
                <label htmlFor="longitude">Longitude:</label>
                <input
                    type="number"
                    id="longitude"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    step="0.0001"
                />
            </div>
            <div className="form-group">
                <label htmlFor="speed">Speed (km/h):</label>
                <input
                    type="number"
                    id="speed"
                    name="speed"
                    value={formData.speed}
                    onChange={handleChange}
                    step="0.1"
                />
            </div>
            <div className="form-group">
                <label htmlFor="altitude">Altitude (m):</label>
                <input
                    type="number"
                    id="altitude"
                    name="altitude"
                    value={formData.altitude}
                    onChange={handleChange}
                    step="0.1"
                />
            </div>
            <button type="submit" className="btn btn-test">📤 Send GPS Data</button>
        </form>
    );
};

export default GPSMap;
