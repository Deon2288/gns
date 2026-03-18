import React, { useState, useEffect, useCallback } from 'react';
import './DevicesPage.css';

interface Device {
    device_id: number;
    user_id: number;
    device_name: string;
    created_at: string;
    imei?: string;
    status: string;
    last_seen?: string | null;
}

interface GPSData {
    device_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

type ViewMode = 'table' | 'card';
type SortKey = 'device_name' | 'status' | 'created_at' | 'last_seen';
type SortDir = 'asc' | 'desc';

const API_BASE = (window as any).REACT_APP_API_URL || 'http://localhost:5000/api';

const DevicesPage: React.FC = () => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [gpsMap, setGpsMap] = useState<Record<number, GPSData>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sortKey, setSortKey] = useState<SortKey>('device_name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const fetchDevices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(`${API_BASE}/devices`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: Device[] = await res.json();
            setDevices(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load devices');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchGPS = useCallback(async (deviceList: Device[]) => {
        const entries = await Promise.allSettled(
            deviceList.map(async (d) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                try {
                    const res = await fetch(`${API_BASE}/gps/${d.device_id}`, {
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (!res.ok) return null;
                    const data: GPSData = await res.json();
                    return data;
                } catch {
                    clearTimeout(timeoutId);
                    return null;
                }
            })
        );
        const map: Record<number, GPSData> = {};
        entries.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
                map[result.value.device_id] = result.value;
            }
        });
        setGpsMap(map);
    }, []);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    useEffect(() => {
        if (devices.length > 0) {
            fetchGPS(devices);
        }
    }, [devices, fetchGPS]);

    const handleDelete = async (deviceId: number) => {
        try {
            const res = await fetch(`${API_BASE}/devices/${deviceId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
            setDeleteConfirm(null);
            if (selectedDevice?.device_id === deviceId) setSelectedDevice(null);
        } catch (err: any) {
            setError(err.message || 'Failed to delete device');
        }
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const filtered = devices
        .filter((d) => {
            const matchSearch = d.device_name.toLowerCase().includes(search.toLowerCase()) ||
                (d.imei || '').toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === 'all' || d.status === statusFilter;
            return matchSearch && matchStatus;
        })
        .sort((a, b) => {
            const va = (a[sortKey] ?? '') as string;
            const vb = (b[sortKey] ?? '') as string;
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });

    const statusCounts = devices.reduce<Record<string, number>>((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
    }, {});

    const formatDate = (val?: string | null) =>
        val ? new Date(val).toLocaleString() : '—';

    const statusClass = (status: string) => {
        if (status === 'online' || status === 'active') return 'status-online';
        if (status === 'offline' || status === 'inactive') return 'status-offline';
        return 'status-unknown';
    };

    const googleMapsUrl = (gps?: GPSData) =>
        gps ? `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}` : null;

    const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
        if (sortKey !== col) return <span className="sort-icon">⇅</span>;
        return <span className="sort-icon active">{sortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    if (loading) {
        return (
            <div className="devices-loading">
                <div className="spinner" />
                <p>Loading devices…</p>
            </div>
        );
    }

    return (
        <div className="devices-page">
            <header className="devices-header">
                <h1>🚗 Device Management</h1>
                <p className="devices-subtitle">
                    {devices.length} devices total
                    {statusCounts['online'] !== undefined && ` · ${statusCounts['online']} online`}
                    {statusCounts['offline'] !== undefined && ` · ${statusCounts['offline']} offline`}
                </p>
            </header>

            {error && (
                <div className="devices-error">
                    ⚠️ {error}
                    <button onClick={fetchDevices}>Retry</button>
                </div>
            )}

            <div className="devices-controls">
                <input
                    className="search-input"
                    type="text"
                    placeholder="Search by name or IMEI…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <select
                    className="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All statuses</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>

                <div className="view-toggle">
                    <button
                        className={viewMode === 'table' ? 'active' : ''}
                        onClick={() => setViewMode('table')}
                        title="Table view"
                    >
                        ☰
                    </button>
                    <button
                        className={viewMode === 'card' ? 'active' : ''}
                        onClick={() => setViewMode('card')}
                        title="Card view"
                    >
                        ⊞
                    </button>
                </div>

                <button className="refresh-btn" onClick={fetchDevices}>↺ Refresh</button>
            </div>

            <p className="results-count">
                Showing {filtered.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
            </p>

            {filtered.length === 0 ? (
                <div className="devices-empty">No devices match your search criteria.</div>
            ) : viewMode === 'table' ? (
                <div className="table-wrapper">
                    <table className="devices-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('device_name')}>
                                    Name <SortIcon col="device_name" />
                                </th>
                                <th>IMEI</th>
                                <th onClick={() => handleSort('status')}>
                                    Status <SortIcon col="status" />
                                </th>
                                <th onClick={() => handleSort('last_seen')}>
                                    Last Seen <SortIcon col="last_seen" />
                                </th>
                                <th onClick={() => handleSort('created_at')}>
                                    Created <SortIcon col="created_at" />
                                </th>
                                <th>Location</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((device) => {
                                const gps = gpsMap[device.device_id];
                                const mapsUrl = googleMapsUrl(gps);
                                return (
                                    <tr key={device.device_id}>
                                        <td>
                                            <button
                                                className="device-name-link"
                                                onClick={() => setSelectedDevice(device)}
                                            >
                                                {device.device_name}
                                            </button>
                                        </td>
                                        <td className="mono">{device.imei || '—'}</td>
                                        <td>
                                            <span className={`status-badge ${statusClass(device.status)}`}>
                                                {device.status}
                                            </span>
                                        </td>
                                        <td>{formatDate(device.last_seen)}</td>
                                        <td>{formatDate(device.created_at)}</td>
                                        <td>
                                            {mapsUrl ? (
                                                <a
                                                    href={mapsUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="maps-link"
                                                >
                                                    📍 View
                                                </a>
                                            ) : '—'}
                                        </td>
                                        <td className="actions-cell">
                                            <button
                                                className="btn-details"
                                                onClick={() => setSelectedDevice(device)}
                                            >
                                                Details
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => setDeleteConfirm(device.device_id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="devices-grid">
                    {filtered.map((device) => {
                        const gps = gpsMap[device.device_id];
                        const mapsUrl = googleMapsUrl(gps);
                        return (
                            <div key={device.device_id} className="device-card">
                                <div className="card-header">
                                    <span className="card-name">{device.device_name}</span>
                                    <span className={`status-badge ${statusClass(device.status)}`}>
                                        {device.status}
                                    </span>
                                </div>
                                <div className="card-body">
                                    {device.imei && (
                                        <p><strong>IMEI:</strong> <span className="mono">{device.imei}</span></p>
                                    )}
                                    <p><strong>Last seen:</strong> {formatDate(device.last_seen)}</p>
                                    <p><strong>Created:</strong> {formatDate(device.created_at)}</p>
                                    {gps && (
                                        <p>
                                            <strong>Location:</strong>{' '}
                                            {gps.latitude.toFixed(4)}, {gps.longitude.toFixed(4)}
                                        </p>
                                    )}
                                </div>
                                <div className="card-footer">
                                    {mapsUrl && (
                                        <a
                                            href={mapsUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="maps-link"
                                        >
                                            📍 Map
                                        </a>
                                    )}
                                    <button
                                        className="btn-details"
                                        onClick={() => setSelectedDevice(device)}
                                    >
                                        Details
                                    </button>
                                    <button
                                        className="btn-delete"
                                        onClick={() => setDeleteConfirm(device.device_id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Device Details Modal */}
            {selectedDevice && (
                <div className="modal-overlay" onClick={() => setSelectedDevice(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedDevice.device_name}</h2>
                            <button className="modal-close" onClick={() => setSelectedDevice(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <span className="detail-label">Device ID</span>
                                <span className="detail-value">{selectedDevice.device_id}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`status-badge ${statusClass(selectedDevice.status)}`}>
                                    {selectedDevice.status}
                                </span>
                            </div>
                            {selectedDevice.imei && (
                                <div className="detail-row">
                                    <span className="detail-label">IMEI</span>
                                    <span className="detail-value mono">{selectedDevice.imei}</span>
                                </div>
                            )}
                            <div className="detail-row">
                                <span className="detail-label">Last Seen</span>
                                <span className="detail-value">{formatDate(selectedDevice.last_seen)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Created</span>
                                <span className="detail-value">{formatDate(selectedDevice.created_at)}</span>
                            </div>
                            {gpsMap[selectedDevice.device_id] && (
                                <>
                                    <div className="detail-row">
                                        <span className="detail-label">Latitude</span>
                                        <span className="detail-value">
                                            {gpsMap[selectedDevice.device_id].latitude}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Longitude</span>
                                        <span className="detail-value">
                                            {gpsMap[selectedDevice.device_id].longitude}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">GPS Updated</span>
                                        <span className="detail-value">
                                            {formatDate(gpsMap[selectedDevice.device_id].timestamp)}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Map</span>
                                        <span className="detail-value">
                                            {googleMapsUrl(gpsMap[selectedDevice.device_id]) ? (
                                            <a
                                                href={googleMapsUrl(gpsMap[selectedDevice.device_id]) as string}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="maps-link"
                                            >
                                                📍 Open in Google Maps
                                            </a>
                                            ) : '—'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-delete"
                                onClick={() => {
                                    setSelectedDevice(null);
                                    setDeleteConfirm(selectedDevice.device_id);
                                }}
                            >
                                Delete Device
                            </button>
                            <button className="btn-details" onClick={() => setSelectedDevice(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm !== null && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Confirm Delete</h2>
                            <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Are you sure you want to delete{' '}
                                <strong>
                                    {devices.find((d) => d.device_id === deleteConfirm)?.device_name}
                                </strong>
                                ? This action cannot be undone.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn-delete"
                                onClick={() => handleDelete(deleteConfirm)}
                            >
                                Yes, Delete
                            </button>
                            <button
                                className="btn-details"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevicesPage;
