import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { FleetStats } from '../utils/analytics';

interface DashboardProps {
    fleetStats: FleetStats;
    speedDistribution?: { range: string; count: number }[];
}

const STAT_CARD_STYLE: React.CSSProperties = {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    flex: '1',
    minWidth: '120px',
};

/**
 * Dashboard shows fleet analytics with stat cards and a speed distribution chart.
 */
const Dashboard: React.FC<DashboardProps> = ({ fleetStats, speedDistribution }) => {
    const chartColors = ['#22c55e', '#86efac', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];

    return (
        <div style={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px',
            color: '#f9fafb',
            fontFamily: 'sans-serif',
        }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>
                📊 Fleet Dashboard
            </h3>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={STAT_CARD_STYLE}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f9fafb' }}>
                        {fleetStats.totalDevices}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Total Devices</div>
                </div>
                <div style={{ ...STAT_CARD_STYLE, borderColor: '#22c55e' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                        {fleetStats.activeDevices}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Active</div>
                </div>
                <div style={{ ...STAT_CARD_STYLE, borderColor: '#eab308' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>
                        {fleetStats.idleDevices}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Idle</div>
                </div>
                <div style={{ ...STAT_CARD_STYLE, borderColor: '#ef4444' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                        {fleetStats.offlineDevices}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Offline</div>
                </div>
                <div style={STAT_CARD_STYLE}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>
                        {fleetStats.totalDistance.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Total km</div>
                </div>
                <div style={STAT_CARD_STYLE}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a78bfa' }}>
                        {fleetStats.averageSpeed.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Avg km/h</div>
                </div>
            </div>

            {/* Speed distribution chart */}
            {speedDistribution && speedDistribution.length > 0 && (
                <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#d1d5db' }}>
                        Speed Distribution (km/h)
                    </h4>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={speedDistribution} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                                labelStyle={{ color: '#f9fafb' }}
                                itemStyle={{ color: '#60a5fa' }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {speedDistribution.map((_, index) => (
                                    <Cell key={index} fill={chartColors[index % chartColors.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Per-device table */}
            {fleetStats.devices.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#d1d5db' }}>Device Status</h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #374151' }}>
                                    {['Device', 'Status', 'Distance', 'Avg Speed', 'Max Speed'].map(h => (
                                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#9ca3af', fontWeight: 'normal' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {fleetStats.devices.map(device => (
                                    <tr key={device.deviceId} style={{ borderBottom: '1px solid #1f2937' }}>
                                        <td style={{ padding: '6px 8px', color: '#f9fafb' }}>{device.deviceId}</td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <span style={{
                                                color: device.status === 'active' ? '#22c55e' : device.status === 'idle' ? '#eab308' : '#ef4444',
                                                fontWeight: 'bold',
                                            }}>
                                                ● {device.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '6px 8px', color: '#d1d5db' }}>{device.totalDistance} km</td>
                                        <td style={{ padding: '6px 8px', color: '#d1d5db' }}>{device.averageSpeed} km/h</td>
                                        <td style={{ padding: '6px 8px', color: '#d1d5db' }}>{device.maxSpeed} km/h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
