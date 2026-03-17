import React, { useState } from 'react';
import { discoveryService } from '../../services/discoveryService';
import ScanProgress from './ScanProgress';

const DiscoveryPanel = () => {
  const [ipRange, setIpRange] = useState('192.168.1.0/24');
  const [scanning, setScanning] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [error, setError] = useState('');

  const handleScan = async (e) => {
    e.preventDefault();
    setError('');
    setScanning(true);
    try {
      const data = await discoveryService.startScan(ipRange);
      setCurrentJob(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start scan');
      setScanning(false);
    }
  };

  const handleScanComplete = () => {
    setScanning(false);
  };

  return (
    <div className="discovery-panel">
      <div className="page-header">
        <h2>🔍 Network Discovery</h2>
        <p>Scan your network to discover active devices</p>
      </div>

      <div className="scan-form-card">
        <h3>Start Network Scan</h3>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleScan} className="scan-form">
          <div className="form-row">
            <div className="form-group">
              <label>IP Range (CIDR)</label>
              <input
                type="text"
                value={ipRange}
                onChange={(e) => setIpRange(e.target.value)}
                placeholder="192.168.1.0/24"
                disabled={scanning}
                pattern="^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={scanning}>
              {scanning ? '⏳ Scanning...' : '▶ Start Scan'}
            </button>
          </div>
        </form>
      </div>

      {currentJob && (
        <ScanProgress
          jobId={currentJob.jobId}
          onComplete={handleScanComplete}
        />
      )}
    </div>
  );
};

export default DiscoveryPanel;
