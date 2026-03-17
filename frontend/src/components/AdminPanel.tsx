import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AdminPanel.css';

interface Device {
    device_id: number;
    device_name: string;
    imei: string;
    status: string;
    created_at: string;
    last_seen: string | null;
}

interface SystemStats {
    totalDevices: number;
    activeDevices: number;
    inactiveDevices: number;
    totalGPSRecords: number;
    totalAlerts: number;
    unacknowledgedAlerts: number;
}

export const AdminPanel: React.FC = () => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [stats, setStats] = useState<SystemStats>({
        totalDevices: 0,
        activeDevices: 0,
        inactiveDevices: 0,
        totalGPSRecords: 0,
        totalAlerts: 0,
        unacknowledgedAlerts: 0,
    });
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchAdminData();
    }, []);

    const fetchAdminData = async () => {
        try {
            const devicesRes = await axios.get('http://197.242.150.120:5000/api/devices');
            setDevices(devicesRes.data);

            // Calculate stats
            const now = new Date();
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
            
            const activeCount = devicesRes.data.filter((d: Device) => {
                const lastSeen = d.last_seen ? new Date(d.last_seen) : null;
                return lastSeen && lastSeen > fiveMinutesAgo;
            }).length;

            setStats({
                totalDevices: devicesRes.data.length,
                activeDevices: activeCount,
                inactiveDevices: devicesRes.data.length - activeCount,
                totalGPSRecords: 0,
                totalAlerts: 0,
                unacknowledgedAlerts: 0,
            });

            setLoading(false);
        } catch (err) {
            console.error('Error fetching admin data:', err);
            setLoading(false);
        }
    };

    const updateDeviceName = async (deviceId: number, newName: string) => {
        try {
            await axios.put(`/api/devices/${deviceId}`, { device_name: newName });
            fetchAdminData();
            setEditingId(null);
        } catch (err) {
            console.error('Error updating device:', err);
        }
    };

    const deleteDevice = async (deviceId: number) => {
        if (!window.confirm('Are you sure you want to delete this device?')) return;
        try {
            await axios.delete(`/api/devices/${deviceId}`);
            fetchAdminData();
        } catch (err) {
            console.error('Error deleting device:', err);
        }
    };

    if (loading) return <div>Loading admin panel...</div>;

    return (
        <div className="admin-panel">
            <div className="admin-header">
                <h2>⚙️ Admin Dashboard</h2>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <h4>Total Devices</h4>
                    <p className="stat-number">{stats.totalDevices}</p>
                </div>
                <div className="stat-card active">
                    <h4>Active Devices</h4>
                    <p className="stat-number">{stats.activeDevices}</p>
                </div>
                <div className="stat-card inactive">
                    <h4>Inactive Devices</h4>
                    <p className="stat-number">{stats.inactiveDevices}</p>
                </div>
                <div className="stat-card alerts">
                    <h4>Unacknowledged Alerts</h4>
                    <p className="stat-number">{stats.unacknowledgedAlerts}</p>
                </div>
            </div>

            <div className="devices-management">
                <h3>Device Management</h3>
                <div className="devices-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Device Name</th>
                                <th>IMEI</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Last Seen</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(device => (
                                <tr key={device.device_id}>
                                    <td>
                                        {editingId === device.device_id ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onBlur={() => updateDeviceName(device.device_id, editName)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        updateDeviceName(device.device_id, editName);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        ) : (
                                            device.device_name
                                        )}
                                    </td>
                                    <td>{device.imei}</td>
                                    <td><span className={`status-badge ${device.status}`}>{device.status}</span></td>
                                    <td>{new Date(device.created_at).toLocaleDateString()}</td>
                                    <td>{device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}</td>
                                    <td>
                                        <button
                                            className="btn-edit"
                                            onClick={() => {
                                                setEditingId(device.device_id);
                                                setEditName(device.device_name);
                                            }}
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            className="btn-delete"
                                            onClick={() => deleteDevice(device.device_id)}
                                        >
                                            🗑️ Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
