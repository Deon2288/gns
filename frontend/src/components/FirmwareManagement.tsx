import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FirmwareManagement.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://197.242.150.120:5000';

interface Firmware {
  id: number;
  name: string;
  version: string;
  device_type: string;
  file_path: string;
  checksum: string;
  release_notes: string;
  created_at: string;
}

interface FirmwareUpdate {
  id: number;
  device_id: number;
  firmware_id: number;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  progress: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export const FirmwareManagement: React.FC = () => {
  const [firmwareList, setFirmwareList] = useState<Firmware[]>([]);
  const [updates, setUpdates] = useState<FirmwareUpdate[]>([]);
  const [activeTab, setActiveTab] = useState<'firmware' | 'updates' | 'upload'>('firmware');
  const [loading, setLoading] = useState(false);
  const [deployModal, setDeployModal] = useState<Firmware | null>(null);
  const [deployDeviceIds, setDeployDeviceIds] = useState('');
  const [uploadForm, setUploadForm] = useState({
    name: '',
    version: '',
    device_type: '',
    release_notes: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchFirmware();
    fetchUpdates();
  }, []);

  const fetchFirmware = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/firmware`);
      setFirmwareList(res.data);
    } catch (err) {
      console.error('Error fetching firmware:', err);
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/firmware/updates`);
      setUpdates(res.data);
    } catch (err) {
      console.error('Error fetching updates:', err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/firmware/upload`, uploadForm);
      setMessage({ type: 'success', text: 'Firmware uploaded successfully!' });
      setUploadForm({ name: '', version: '', device_type: '', release_notes: '' });
      fetchFirmware();
      setActiveTab('firmware');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!deployModal) return;
    const ids = deployDeviceIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one device ID' });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/firmware/deploy`, {
        firmware_id: deployModal.id,
        device_ids: ids,
      });
      setMessage({ type: 'success', text: 'Deployment initiated!' });
      setDeployModal(null);
      setDeployDeviceIds('');
      fetchUpdates();
      setActiveTab('updates');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Deployment failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (updateId: number) => {
    try {
      await axios.put(`${API_BASE}/api/firmware/updates/${updateId}/rollback`);
      setMessage({ type: 'success', text: 'Rollback initiated!' });
      fetchUpdates();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Rollback failed' });
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'badge-warning',
      in_progress: 'badge-info',
      success: 'badge-success',
      failed: 'badge-danger',
    };
    return map[status] || 'badge-secondary';
  };

  return (
    <div className="firmware-container">
      <div className="firmware-header">
        <h2>🔧 Firmware Management (FOTA)</h2>
        <p>Manage and deploy firmware updates to your devices over the air</p>
      </div>

      {message && (
        <div className={`alert-msg ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="firmware-tabs">
        <button
          className={`tab-btn ${activeTab === 'firmware' ? 'active' : ''}`}
          onClick={() => setActiveTab('firmware')}
        >
          📦 Firmware Catalog
        </button>
        <button
          className={`tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
          onClick={() => setActiveTab('updates')}
        >
          🔄 Update History
        </button>
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          ⬆️ Upload Firmware
        </button>
      </div>

      {activeTab === 'firmware' && (
        <div className="firmware-list">
          {firmwareList.length === 0 ? (
            <div className="empty-state">No firmware available. Upload firmware to get started.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Device Type</th>
                  <th>Checksum</th>
                  <th>Release Notes</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {firmwareList.map((fw) => (
                  <tr key={fw.id}>
                    <td><strong>{fw.name}</strong></td>
                    <td><span className="version-badge">v{fw.version}</span></td>
                    <td>{fw.device_type}</td>
                    <td><code className="checksum">{fw.checksum.slice(0, 20)}...</code></td>
                    <td>{fw.release_notes}</td>
                    <td>{new Date(fw.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn-deploy"
                        onClick={() => setDeployModal(fw)}
                      >
                        🚀 Deploy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'updates' && (
        <div className="updates-list">
          {updates.length === 0 ? (
            <div className="empty-state">No update history yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Device ID</th>
                  <th>Firmware ID</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Error</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.device_id}</td>
                    <td>{u.firmware_id}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(u.status)}`}>{u.status}</span>
                    </td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${u.progress}%` }}
                        />
                        <span>{u.progress}%</span>
                      </div>
                    </td>
                    <td>{new Date(u.started_at).toLocaleString()}</td>
                    <td>{u.completed_at ? new Date(u.completed_at).toLocaleString() : '-'}</td>
                    <td className="error-cell">{u.error_message || '-'}</td>
                    <td>
                      {u.status === 'failed' && (
                        <button
                          className="btn-rollback"
                          onClick={() => handleRollback(u.id)}
                        >
                          ↩️ Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="upload-form-container">
          <form className="upload-form" onSubmit={handleUpload}>
            <h3>Upload New Firmware</h3>
            <div className="drag-drop-zone">
              <div className="drag-drop-icon">📁</div>
              <p>Drag & drop firmware file here, or fill in the details below</p>
              <span className="drag-drop-hint">Supported formats: .bin, .img, .tar.gz</span>
            </div>
            <div className="form-group">
              <label>Firmware Name *</label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="e.g. TRB140 Firmware"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Version *</label>
                <input
                  type="text"
                  value={uploadForm.version}
                  onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                  placeholder="e.g. 7.8.1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Device Type *</label>
                <input
                  type="text"
                  value={uploadForm.device_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, device_type: e.target.value })}
                  placeholder="e.g. TRB140"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Release Notes</label>
              <textarea
                value={uploadForm.release_notes}
                onChange={(e) => setUploadForm({ ...uploadForm, release_notes: e.target.value })}
                placeholder="Describe what's new in this firmware version..."
                rows={4}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Uploading...' : '⬆️ Upload Firmware'}
            </button>
          </form>
        </div>
      )}

      {deployModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>🚀 Deploy Firmware</h3>
            <p>
              Deploy <strong>{deployModal.name} v{deployModal.version}</strong> to devices
            </p>
            <div className="form-group">
              <label>Device IDs (comma-separated)</label>
              <input
                type="text"
                value={deployDeviceIds}
                onChange={(e) => setDeployDeviceIds(e.target.value)}
                placeholder="e.g. 1, 2, 3"
              />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleDeploy} disabled={loading}>
                {loading ? 'Deploying...' : '🚀 Deploy'}
              </button>
              <button className="btn-secondary" onClick={() => setDeployModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
