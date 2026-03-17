import React, { useEffect, useState } from 'react';
import { discoveryService } from '../../services/discoveryService';

const ScanProgress = ({ jobId, onComplete }) => {
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const data = await discoveryService.getScanStatus(jobId);
        setJob(data.job);
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          if (onComplete) onComplete(data.job);
          return true; // stop polling
        }
      } catch (err) {
        setError('Failed to get scan status');
        return true;
      }
      return false;
    };

    const interval = setInterval(async () => {
      const done = await poll();
      if (done) clearInterval(interval);
    }, 2000);
    poll();
    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  if (!job) return <div className="loading">Initializing scan...</div>;

  const statusColors = { pending: 'gray', running: 'blue', completed: 'green', failed: 'red' };

  return (
    <div className={`scan-progress scan-progress--${statusColors[job.status] || 'gray'}`}>
      <h3>Scan Job #{jobId}</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="progress-info">
        <div className="progress-row">
          <span>Status:</span>
          <span className={`status-badge status-${job.status}`}>{job.status.toUpperCase()}</span>
        </div>
        <div className="progress-row">
          <span>IP Range:</span>
          <span>{job.ipRange}</span>
        </div>
        <div className="progress-row">
          <span>Devices Found:</span>
          <span>{job.devicesFound}</span>
        </div>
        {job.status === 'running' && (
          <div className="progress-bar">
            <div className="progress-bar-fill progress-bar-fill--animated"></div>
          </div>
        )}
        {job.status === 'completed' && job.results && job.results.length > 0 && (
          <div className="scan-results">
            <h4>Discovered Hosts ({job.results.filter((r) => r.alive).length})</h4>
            <div className="host-list">
              {job.results.filter((r) => r.alive).map((r) => (
                <span key={r.ip} className="host-badge">
                  {r.ip} ({r.time}ms)
                </span>
              ))}
            </div>
          </div>
        )}
        {job.status === 'failed' && (
          <div className="error-banner">{job.errorMessage}</div>
        )}
      </div>
    </div>
  );
};

export default ScanProgress;
