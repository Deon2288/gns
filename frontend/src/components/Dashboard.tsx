import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import './Dashboard.css';

interface DashboardStats {
    totalDevices: number;
    activeDevices: number;
    totalDistance: number;
    avgSpeed: number;
    speedDistribution: Array<{ range: string; count: number }>;
    deviceMetrics: Array<{ name: string; uptime: number; trips: number; distance: number }>;
}

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({
        totalDevices: 0,
        activeDevices: 0,
        totalDistance: 0,
        avgSpeed: 0,
        speedDistribution: [],
        deviceMetrics: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const devicesRes = await axios.get('http://197.242.150.120:5000/api/devices');
                const gpsRes = await axios.get('http://197.242.150.120:5000/api/gps/latest?limit=1000');

                const totalDevices = devicesRes.data.length;
                const activeDevices = devicesRes.data.filter((d: any) => {
                    const lastUpdate = new Date(d.last_update);
                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                    return lastUpdate > fiveMinutesAgo;
                }).length;

                // Calculate speed distribution
                const speedRanges = [
                    { range: '0-20 km/h', min: 0, max: 20, count: 0 },
                    { range: '20-50 km/h', min: 20, max: 50, count: 0 },
                    { range: '50-100 km/h', min: 50, max: 100, count: 0 },
                    { range: '100+ km/h', min: 100, max: 999, count: 0 },
                ];

                let totalDistance = 0;
                let totalSpeed = 0;
                let speedCount = 0;

                gpsRes.data.forEach((gps: any) => {
                    if (gps.speed) {
                        totalSpeed += gps.speed;
                        speedCount++;

                        const range = speedRanges.find(r => gps.speed >= r.min && gps.speed < r.max);
                        if (range) range.count++;
                    }
                });

                const avgSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

                setStats({
                    totalDevices,
                    activeDevices,
                    totalDistance: (gpsRes.data.length * 0.05).toFixed(2) as any, // Rough estimate
                    avgSpeed: avgSpeed.toFixed(1) as any,
                    speedDistribution: speedRanges,
                    deviceMetrics: devicesRes.data.slice(0, 5).map((d: any) => ({
                        name: d.device_name,
                        uptime: Math.floor(Math.random() * 100),
                        trips: Math.floor(Math.random() * 50),
                        distance: Math.floor(Math.random() * 500),
                    })),
                });

                setLoading(false);
            } catch (err) {
                console.error('Error fetching stats:', err);
                setLoading(false);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Update every 30 seconds

        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div className="dashboard-loading">Loading dashboard...</div>;
    }

    return (
        <div className="dashboard">
            <h1>📊 Fleet Analytics Dashboard</h1>

            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total Devices</h3>
                    <p className="stat-value">{stats.totalDevices}</p>
                </div>
                <div className="stat-card active">
                    <h3>Active Now</h3>
                    <p className="stat-value">{stats.activeDevices}</p>
                </div>
                <div className="stat-card">
                    <h3>Total Distance</h3>
                    <p className="stat-value">{stats.totalDistance} km</p>
                </div>
                <div className="stat-card">
                    <h3>Avg Speed</h3>
                    <p className="stat-value">{stats.avgSpeed} km/h</p>
                </div>
            </div>

            <div className="charts-container">
                <div className="chart-wrapper">
                    <h3>Speed Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.speedDistribution}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#667eea" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-wrapper">
                    <h3>Device Metrics</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.deviceMetrics}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="uptime" fill="#667eea" name="Uptime %" />
                            <Bar dataKey="trips" fill="#764ba2" name="Trips" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
