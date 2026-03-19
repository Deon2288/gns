import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './DevicesPage.css';

interface Device {
    device_id: number;
    user_id: number;
    device_name: string;
    created_at: string;
    imei: string;
    status: string;
    last_seen: string | null;
}

interface GPSData {
    device_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface DeviceWithLocation extends Device {
    latitude?: number;
    longitude?: number;
    lastUpdate?: string;
}

export const DevicesPage: React.FC = () => {
    const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
    const [filteredDevices, setFilteredDevices] = useState<DeviceWithLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'created' | 'lastseen'>('name');
    const [selectedDevice, setSelectedDevice] = useState<DeviceWithLocation | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

    const API_BASE = '${REACT_APP_API_URL}';

    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchDevices = async () => {
        try {
            const devicesRes = await axios.get(`${API_BASE}/api/devices`);
            const gpsRes = await axios.get(`${API_BASE}/api/gps/latest?limit=1000`);

            const gpsMap = new Map<number, GPSData>();
            gpsRes.data.forEach((gps: GPSData) => {
                if (!gpsMap.has(gps.device_id)) {
                    gpsMap.set(gps.device_id, gps);
                }
            });

            const devicesWithLocation: DeviceWithLocation[] = devicesRes.data.map((device: Device) => {
                const gps = gpsMap.get(device.device_id);
                return {
                    ...device,
                    latitude: gps?.latitude,
                    longitude: gps?.longitude,
                    lastUpdate: gps?.timestamp,
                };
            });

            setDevices(devicesWithLocation);
            applyFiltersAndSort(devicesWithLocation, searchTerm, statusFilter, sortBy);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching devices:', err);
            setLoading(false);
        }
    };

    const applyFiltersAndSort = (
        devs: DeviceWithLocation[],
        search: string,
        status: string,
        sort: string
    ) => {
        let filtered = devs;

        // Search filter
        if (search) {
            filtered = filtered.filter(
                d =>
                    d.device_name.toLowerCase().includes(search.toLowerCase()) ||
                    d.imei.includes(search)
            );
        }

        // Status filter
        if (status === 'active') {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            filtered = filtered.filter(d => {
                const lastSeen = d.last_seen ? new Date(d.last_seen) : null;
                return lastSeen && lastSeen > fiveMinutesAgo;
            });
        } else if (status === 'inactive') {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            filtered = filtered.filter(d => {
                const lastSeen = d.last_seen ? new Date(d.last_seen) : null;
                return !lastSeen || lastSeen <= fiveMinutesAgo;
            });
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sort) {
                case 'name':
                    return a.device_name.localeCompare(b.device_name);
                case 'created':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case 'lastseen':
                    const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
                    const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;
                    return bTime - aTime;
                default:
                    return 0;
            }
        });

        setFilteredDevices(filtered);
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        applyFiltersAndSort(devices, value, statusFilter, sortBy);
    };

    const handleStatusFilter = (status: 'all' | 'active' | 'inactive') => {
        setStatusFilter(status);
        applyFiltersAndSort(devices, searchTerm, status, sortBy);
    };

    const handleSort = (sort: 'name' | 'created' | 'lastseen') => {
        setSortBy(sort);
        applyFiltersAndSort(devices, searchTerm, statusFilter, sort);
    };

    const getStatusColor = (device: DeviceWithLocation) => {
        if (!device.last_seen) return '#999';
        const lastSeen = new Date(device.last_seen);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastSeen > fiveMinutesAgo ? '#22c55e' : '#ef4444';
    };

    const getStatusText = (device: DeviceWithLocation) => {
        if (!device.last_seen) return 'Never Seen';
        const lastSeen = new Date(device.last_seen);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastSeen > fiveMinutesAgo ? 'Active' : 'Inactive';
    };

    const deleteDevice = async (deviceId: number) => {
        if (!window.confirm('Are you sure you want to delete this device?')) return;
        try {
            await axios.delete(`${API_BASE}/api/devices/${deviceId}`);
            alert('✅ Device deleted successfully!');
            fetchDevices();
        } catch (err: any) {
            alert('❌ Error deleting device: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Loading devices...</div>;
    }

    return (
        <div className="devices-page">
            <div className="devices-header">
                <h1>🚗 Devices Management</h1>
                <p>Total: {devices.length} devices | Filtered: {filteredDevices.length}</p>
            </div>

            <div className="devices-controls">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="🔍 Search by name or IMEI..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => handleStatusFilter('all')}
                    >
                        All ({devices.length})
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
                        onClick={() => handleStatusFilter('active')}
                    >
                        Active ({devices.filter(d => getStatusText(d) === 'Active').length})
                    </button>
                    <button
                        className={`filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
                        onClick={() => handleStatusFilter('inactive')}
                    >
                        Inactive ({devices.filter(d => getStatusText(d) === 'Inactive').length})
                    </button>
                </div>

                <div className="sort-buttons">
                    <select value={sortBy} onChange={(e) => handleSort(e.target.value as any)} className="sort-select">
                        <option value="name">Sort by Name</option>
                        <option value="created">Sort by Created</option>
                        <option value="lastseen">Sort by Last Seen</option>
                    </select>

                    <button
                        className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setViewMode('table')}
                        title="Table View"
                    >
                        📋
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
                        onClick={() => setViewMode('card')}
                        title="Card View"
                    >
                        📇
                    </button>
                </div>
            </div>

            {filteredDevices.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                    No devices found
                </div>
            ) : viewMode === 'table' ? (
                <div className="devices-table-wrapper">
                    <table className="devices-table">
                        <thead>
                            <tr>
                                <th>Device Name</th>
                                <th>IMEI</th>
                                <th>Status</th>
                                <th>Location</th>
                                <th>Last Seen</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDevices.map(device => (
                                <tr key={device.device_id}>
                                    <td>
                                        <strong>{device.device_name}</strong>
                                    </td>
                                    <td>
                                        <code>{device.imei}</code>
                                    </td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{
                                                backgroundColor: getStatusColor(device),
                                                color: 'white',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            {getStatusText(device)}
                                        </span>
                                    </td>
                                    <td>
                                        {device.latitude && device.longitude ? (
                                            <a
                                                href={`https://www.google.com/maps/@${device.latitude},${device.longitude},15z`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ color: '#667eea', textDecoration: 'none' }}
                                            >
                                                📍 {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                                            </a>
                                        ) : (
                                            <span style={{ color: '#999' }}>No data</span>
                                        )}
                                    </td>
                                    <td>
                                        {device.last_seen
                                            ? new Date(device.last_seen).toLocaleString()
                                            : 'Never'}
                                    </td>
                                    <td>{new Date(device.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button
                                            onClick={() => setSelectedDevice(device)}
                                            className="btn-view"
                                            title="View Details"
                                        >
                                            👁️
                                        </button>
                                        <button
                                            onClick={() => deleteDevice(device.device_id)}
                                            className="btn-delete"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="devices-grid">
                    {filteredDevices.map(device => (
                        <div key={device.device_id} className="device-card">
                            <div className="card-header">
                                <h3>{device.device_name}</h3>
                                <span
                                    className="status-dot"
                                    style={{ backgroundColor: getStatusColor(device) }}
                                    title={getStatusText(device)}
                                ></span>
                            </div>
                            <div className="card-body">
                                <div className="card-row">
                                    <span className="label">IMEI:</span>
                                    <span className="value">{device.imei}</span>
                                </div>
                                <div className="card-row">
                                    <span className="label">Status:</span>
                                    <span className="value">{getStatusText(device)}</span>
                                </div>
                                {device.latitude && device.longitude && (
                                    <div className="card-row">
                                        <span className="label">Location:</span>
                                        <a
                                            href={`https://www.google.com/maps/@${device.latitude},${device.longitude},15z`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#667eea', fontSize: '12px' }}
                                        >
                                            📍 View on Map
                                        </a>
                                    </div>
                                )}
                                <div className="card-row">
                                    <span className="label">Last Seen:</span>
                                    <span className="value">
                                        {device.last_seen
                                            ? new Date(device.last_seen).toLocaleString()
                                            : 'Never'}
                                    </span>
                                </div>
                                <div className="card-row">
                                    <span className="label">Created:</span>
                                    <span className="value">{new Date(device.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="card-footer">
                                <button
                                    onClick={() => setSelectedDevice(device)}
                                    className="btn-view"
                                >
                                    👁️ Details
                                </button>
                                <button
                                    onClick={() => deleteDevice(device.device_id)}
                                    className="btn-delete"
                                >
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedDevice && (
                <div className="modal-overlay" onClick={() => setSelectedDevice(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedDevice.device_name}</h2>
                            <button className="btn-close" onClick={() => setSelectedDevice(null)}>
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-group">
                                <h3>Device Information</h3>
                                <p>
                                    <strong>Device ID:</strong> {selectedDevice.device_id}
                                </p>
                                <p>
                                    <strong>IMEI:</strong> {selectedDevice.imei}
                                </p>
                                <p>
                                    <strong>Status:</strong>{' '}
                                    <span
                                        style={{
                                            backgroundColor: getStatusColor(selectedDevice),
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '3px',
                                            fontSize: '12px',
                                        }}
                                    >
                                        {getStatusText(selectedDevice)}
                                    </span>
                                </p>
                                <p>
                                    <strong>Created:</strong> {new Date(selectedDevice.created_at).toLocaleString()}
                                </p>
                            </div>

                            <div className="detail-group">
                                <h3>Location Data</h3>
                                {selectedDevice.latitude && selectedDevice.longitude ? (
                                    <>
                                        <p>
                                            <strong>Latitude:</strong> {selectedDevice.latitude.toFixed(6)}
                                        </p>
                                        <p>
                                            <strong>Longitude:</strong> {selectedDevice.longitude.toFixed(6)}
                                        </p>
                                        <p>
                                            <strong>Last Update:</strong>{' '}
                                            {selectedDevice.lastUpdate
                                                ? new Date(selectedDevice.lastUpdate).toLocaleString()
                                                : 'N/A'}
                                        </p>
                                        <a
                                            href={`https://www.google.com/maps/@${selectedDevice.latitude},${selectedDevice.longitude},15z`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: 'block', marginTop: '10px', color: '#667eea' }}
                                        >
                                            🗺️ Open in Google Maps
                                        </a>
                                    </>
                                ) : (
                                    <p style={{ color: '#999' }}>No location data available</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
