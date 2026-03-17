import React, { useEffect, useState, useCallback } from 'react';
import { discoveryService } from '../../services/discoveryService';

const DeviceList = ({ onSelectDevice }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await discoveryService.listDevices({ search, status: statusFilter });
      setDevices(data.devices || []);
    } catch (err) {
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this device?')) return;
    try {
      await discoveryService.deleteDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError('Failed to delete device');
    }
  };

  return (
    <div className="device-list">
      <div className="page-header">
        <h2>🖥️ Devices</h2>
        <p>Manage and monitor discovered network devices</p>
      </div>

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search by IP, hostname..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
          <option value="">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="unknown">Unknown</option>
        </select>
        <button className="btn-secondary" onClick={fetchDevices}>🔄 Refresh</button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="empty-state">
          <p>No devices found. Run a network scan to discover devices.</p>
        </div>
      ) : (
        <div className="device-table-container">
          <table className="device-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Hostname</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr
                  key={device.id}
                  onClick={() => onSelectDevice && onSelectDevice(device)}
                  className="device-row"
                >
                  <td><code>{device.ipAddress || device.ip_address}</code></td>
                  <td>{device.hostname || '-'}</td>
                  <td>{device.deviceType || device.device_type || 'unknown'}</td>
                  <td>
                    <span className={`status-badge status-${device.status}`}>
                      {device.status}
                    </span>
                  </td>
                  <td>{device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '-'}</td>
                  <td>
                    <button
                      className="btn-danger btn-sm"
                      onClick={(e) => handleDelete(device.id, e)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="list-footer">Total: {devices.length} devices</div>
    </div>
  );
};

export default DeviceList;
