import React, { useEffect, useState } from 'react';
import { discoveryService } from '../../services/discoveryService';
import { snmpService } from '../../services/snmpService';

const DeviceDetails = ({ device, onBack }) => {
  const [details, setDetails] = useState(device);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!device?.id) return;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const [deviceData, historyData] = await Promise.all([
          discoveryService.getDevice(device.id),
          snmpService.getHistory(device.id, { limit: 20 }),
        ]);
        setDetails(deviceData.device);
        setMetrics(historyData.metrics || []);
      } catch (err) {
        setError('Failed to load device details');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [device]);

  const handlePoll = async () => {
    setPolling(true);
    setError('');
    try {
      const data = await snmpService.pollMetrics(device.id);
      setMetrics((prev) => [...(data.metrics || []), ...prev].slice(0, 50));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to poll metrics');
    } finally {
      setPolling(false);
    }
  };

  if (!details) return <div className="loading">Loading...</div>;

  return (
    <div className="device-details">
      <div className="page-header">
        <button className="btn-secondary btn-sm" onClick={onBack}>← Back</button>
        <h2>🖥️ Device Details</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="loading">Loading device details...</div>
      ) : (
        <>
          <div className="detail-card">
            <h3>Device Information</h3>
            <div className="detail-grid">
              <div><strong>IP Address:</strong> <code>{details.ipAddress || details.ip_address}</code></div>
              <div><strong>Hostname:</strong> {details.hostname || '-'}</div>
              <div><strong>Type:</strong> {details.deviceType || details.device_type || 'unknown'}</div>
              <div><strong>Vendor:</strong> {details.vendor || '-'}</div>
              <div>
                <strong>Status:</strong>
                <span className={`status-badge status-${details.status}`}>{details.status}</span>
              </div>
              <div><strong>SNMP:</strong> {details.snmpEnabled ? '✅ Enabled' : '❌ Disabled'}</div>
              <div><strong>Community:</strong> {details.snmpCommunity || 'public'}</div>
              <div><strong>Last Seen:</strong> {details.lastSeen ? new Date(details.lastSeen).toLocaleString() : '-'}</div>
            </div>
          </div>

          <div className="detail-card">
            <div className="card-header">
              <h3>SNMP Metrics</h3>
              <button className="btn-primary btn-sm" onClick={handlePoll} disabled={polling}>
                {polling ? '⏳ Polling...' : '📡 Poll Now'}
              </button>
            </div>
            {metrics.length === 0 ? (
              <p className="empty-state">No metrics collected yet. Click "Poll Now".</p>
            ) : (
              <table className="metrics-table">
                <thead>
                  <tr><th>OID Name</th><th>OID</th><th>Value</th><th>Polled At</th></tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id}>
                      <td>{m.oidName}</td>
                      <td><code>{m.oid}</code></td>
                      <td>{m.value}</td>
                      <td>{new Date(m.polledAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DeviceDetails;
