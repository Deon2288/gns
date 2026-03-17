import React, { useState } from 'react';
import { snmpService } from '../../services/snmpService';
import MetricsChart from './MetricsChart';

const MetricsViewer = () => {
  const [deviceId, setDeviceId] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    try {
      const data = await snmpService.getHistory(deviceId, { limit: 50 });
      setMetrics(data.metrics || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const handlePoll = async () => {
    if (!deviceId) return;
    setPolling(true);
    setError('');
    try {
      const data = await snmpService.pollMetrics(deviceId);
      setMetrics((prev) => [...(data.metrics || []), ...prev].slice(0, 100));
    } catch (err) {
      setError(err.response?.data?.error || 'Polling failed');
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="metrics-viewer">
      <div className="page-header">
        <h2>📡 SNMP Metrics</h2>
        <p>Monitor SNMP performance metrics for network devices</p>
      </div>

      <div className="controls-card">
        <div className="form-row">
          <div className="form-group">
            <label>Device ID</label>
            <input
              type="number"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="Enter device ID"
              min="1"
            />
          </div>
          <button className="btn-secondary" onClick={fetchHistory} disabled={!deviceId || loading}>
            {loading ? '⏳ Loading...' : '📊 Load History'}
          </button>
          <button className="btn-primary" onClick={handlePoll} disabled={!deviceId || polling}>
            {polling ? '⏳ Polling...' : '📡 Poll Now'}
          </button>
        </div>
        {error && <div className="error-banner">{error}</div>}
      </div>

      {metrics.length > 0 && (
        <>
          <MetricsChart metrics={metrics} />
          <div className="metrics-table-card">
            <h3>Raw Metrics ({metrics.length})</h3>
            <div className="table-scroll">
              <table className="metrics-table">
                <thead>
                  <tr><th>OID Name</th><th>OID</th><th>Value</th><th>Type</th><th>Polled At</th></tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id}>
                      <td>{m.oidName}</td>
                      <td><code>{m.oid}</code></td>
                      <td>{m.value}</td>
                      <td>{m.valueType}</td>
                      <td>{new Date(m.polledAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricsViewer;
