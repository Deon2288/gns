import React, { useState } from 'react';
import useAuth from '../../hooks/useAuth';

const Settings = () => {
  const { user, logout } = useAuth();
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('apiUrl') || '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    if (apiUrl) localStorage.setItem('apiUrl', apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>Configure your GNS application preferences</p>
      </div>

      <div className="settings-card">
        <h3>Account</h3>
        <div className="detail-grid">
          <div><strong>Username:</strong> {user?.username}</div>
          <div><strong>Email:</strong> {user?.email}</div>
          <div><strong>Role:</strong> <span className="role-badge">{user?.role}</span></div>
        </div>
        <button className="btn-danger" onClick={logout} style={{ marginTop: '1rem' }}>
          🚪 Logout
        </button>
      </div>

      <div className="settings-card">
        <h3>API Configuration</h3>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Backend API URL</label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:5000"
            />
            <small>Override the default backend URL. Leave blank to use the default.</small>
          </div>
          <button type="submit" className="btn-primary">
            {saved ? '✅ Saved!' : '💾 Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
