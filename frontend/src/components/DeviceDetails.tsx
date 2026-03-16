import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './DeviceDetails.css';

interface GPSRecord {
    gps_id: number;
    device_id: number;
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    timestamp: string;
}

interface DeviceDetailsProps {
    deviceId: number;
    onClose: () => void;
}

export const DeviceDetails: React.FC<DeviceDetailsProps> = ({ deviceId, onClose }) => {
    const [device, setDevice] = useState<any>(null);
    const [gpsHistory, setGpsHistory] = useState<GPSRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [speedChart, setSpeedChart] = useState<any[]>([]);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const deviceRes = await axios.get(`/api/devices`);
                const device = deviceRes.data.find((d: any) => d.device_id === deviceId);
                setDevice(device);

                const gpsRes = await axios.get(`/api/gps/device/${deviceId}?limit=100`);
                const gpsData: GPSRecord[] = gpsRes.data;
                setGpsHistory(gpsData);

                const chartData = gpsData
                    .slice()
                    .reverse()
                    .map(gps => ({
                        time: new Date(gps.timestamp).toLocaleTimeString(),
                        speed: gps.speed,
                        altitude: gps.altitude,
                    }));
                setSpeedChart(chartData);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching device details:', err);
                setLoading(false);
            }
        };

        fetchDetails();
    }, [deviceId]);

    if (loading) return <div className="details-loading">Loading...</div>;
    if (!device) return <div>Device not found</div>;

    const totalDistance = gpsHistory.length > 1
        ? gpsHistory.reduce((sum, gps) => sum + (gps.speed * 0.008), 0)
        : 0;

    const avgSpeed = gpsHistory.length > 0
        ? gpsHistory.reduce((sum, gps) => sum + gps.speed, 0) / gpsHistory.length
        : 0;

    return (
        <div className="device-details-modal">
            <div className="details-header">
                <h2>📍 {device.device_name}</h2>
                <button onClick={onClose}>✕</button>
            </div>

            <div className="details-content">
                <div className="device-info">
                    <h3>Device Information</h3>
                    <p><strong>Device ID:</strong> {device.device_id}</p>
                    <p><strong>IMEI:</strong> {device.imei}</p>
                    <p><strong>Status:</strong> <span className={`status-badge ${device.status}`}>{device.status}</span></p>
                    <p><strong>Created:</strong> {new Date(device.created_at).toLocaleString()}</p>
                </div>

                <div className="trip-stats">
                    <h3>Trip Statistics</h3>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <p className="stat-label">Total Distance</p>
                            <p className="stat-value">{totalDistance.toFixed(2)} km</p>
                        </div>
                        <div className="stat-card">
                            <p className="stat-label">Average Speed</p>
                            <p className="stat-value">{avgSpeed.toFixed(1)} km/h</p>
                        </div>
                        <div className="stat-card">
                            <p className="stat-label">Max Speed</p>
                            <p className="stat-value">{Math.max(...gpsHistory.map(g => g.speed), 0).toFixed(1)} km/h</p>
                        </div>
                        <div className="stat-card">
                            <p className="stat-label">Total Records</p>
                            <p className="stat-value">{gpsHistory.length}</p>
                        </div>
                    </div>
                </div>

                <div className="speed-chart">
                    <h3>Speed Over Time</h3>
                    {speedChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={speedChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="speed" stroke="#8884d8" name="Speed (km/h)" />
                                <Line type="monotone" dataKey="altitude" stroke="#82ca9d" name="Altitude (m)" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p>No chart data available</p>
                    )}
                </div>

                <div className="gps-history">
                    <h3>GPS History (Last 20)</h3>
                    <div className="history-table">
                        {gpsHistory.length > 0 ? (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Latitude</th>
                                        <th>Longitude</th>
                                        <th>Speed</th>
                                        <th>Altitude</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gpsHistory.slice(0, 20).map(record => (
                                        <tr key={record.gps_id}>
                                            <td>{new Date(record.timestamp).toLocaleString()}</td>
                                            <td>{record.latitude.toFixed(4)}</td>
                                            <td>{record.longitude.toFixed(4)}</td>
                                            <td>{record.speed.toFixed(1)}</td>
                                            <td>{record.altitude}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p>No GPS history available</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
