import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './RemoteAccess.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://197.242.150.120:5000';

interface RemoteSession {
  id: number;
  device_id: number;
  user_id: number;
  protocol: string;
  port_mapping: string;
  started_at: string;
  ended_at: string | null;
  ip_address: string;
  status: string;
}

interface AccessLog {
  id: number;
  session_id: number;
  action: string;
  timestamp: string;
  status: string;
  details: string;
}

export const RemoteAccess: React.FC = () => {
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [activeTab, setActiveTab] = useState<'sessions' | 'logs' | 'connect'>('sessions');
  const [loading, setLoading] = useState(false);
  const [connectForm, setConnectForm] = useState({
    device_id: '',
    protocol: 'ssh',
    port_mapping: '',
  });
  const [validateResult, setValidateResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSessions();
    fetchLogs();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/remote/sessions`);
      setSessions(res.data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/remote/logs`);
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/remote/sessions`, connectForm);
      setMessage({ type: 'success', text: 'Remote session created successfully!' });
      setConnectForm({ device_id: '', protocol: 'ssh', port_mapping: '' });
      fetchSessions();
      fetchLogs();
      setActiveTab('sessions');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create session' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/api/remote/sessions/${id}`);
      setMessage({ type: 'success', text: 'Session closed.' });
      fetchSessions();
      fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to close session' });
    }
  };

  const handleValidate = async () => {
    if (!connectForm.device_id) {
      setMessage({ type: 'error', text: 'Enter a device ID first' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/remote/validate`, {
        device_id: connectForm.device_id,
        protocol: connectForm.protocol,
      });
      setValidateResult(res.data);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Validation failed' });
    } finally {
      setLoading(false);
    }
  };

  const getProtocolIcon = (protocol: string) => {
    const icons: Record<string, string> = {
      ssh: '🖥️',
      rdp: '🖱️',
      vnc: '📺',
      http: '🌐',
    };
    return icons[protocol] || '🔌';
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? 'badge-success' : 'badge-secondary';
  };

  return (
    <div className="remote-container">
      <div className="remote-header">
        <h2>🔐 Remote Access</h2>
        <p>Create and manage secure remote sessions to your devices (SSH, RDP, VNC, HTTP)</p>
      </div>

      {message && (
        <div className={`alert-msg ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="remote-stats">
        <div className="stat-card">
          <div className="stat-icon">🔗</div>
          <div className="stat-info">
            <div className="stat-value">{sessions.filter((s) => s.status === 'active').length}</div>
            <div className="stat-label">Active Sessions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-value">{sessions.length}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <div className="stat-value">{logs.length}</div>
            <div className="stat-label">Audit Log Entries</div>
          </div>
        </div>
      </div>

      <div className="remote-tabs">
        <button
          className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
        >
          🔗 Active Sessions
        </button>
        <button
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Access Logs
        </button>
        <button
          className={`tab-btn ${activeTab === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTab('connect')}
        >
          ➕ New Session
        </button>
      </div>

      {activeTab === 'sessions' && (
        <div className="sessions-list">
          {sessions.length === 0 ? (
            <div className="empty-state">No sessions yet. Create a new session to get started.</div>
          ) : (
            <div className="session-cards">
              {sessions.map((session) => (
                <div key={session.id} className={`session-card ${session.status}`}>
                  <div className="session-header">
                    <span className="protocol-icon">{getProtocolIcon(session.protocol)}</span>
                    <div>
                      <div className="session-title">
                        {session.protocol.toUpperCase()} to Device #{session.device_id}
                      </div>
                      <div className="session-meta">Port: {session.port_mapping}</div>
                    </div>
                    <span className={`badge ${getStatusBadge(session.status)}`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="session-details">
                    <div>IP: {session.ip_address}</div>
                    <div>Started: {new Date(session.started_at).toLocaleString()}</div>
                    {session.ended_at && (
                      <div>Ended: {new Date(session.ended_at).toLocaleString()}</div>
                    )}
                  </div>
                  {session.status === 'active' && (
                    <div className="session-actions">
                      <button
                        className="btn-launch"
                        title={`Launch ${session.protocol.toUpperCase()} client`}
                      >
                        🚀 Launch Client
                      </button>
                      <button
                        className="btn-close-session"
                        onClick={() => handleCloseSession(session.id)}
                      >
                        ✕ Close Session
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="logs-list">
          {logs.length === 0 ? (
            <div className="empty-state">No audit logs available.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Session</th>
                  <th>Action</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {[...logs].reverse().map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>#{log.session_id}</td>
                    <td><code>{log.action}</code></td>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'connect' && (
        <div className="connect-form-container">
          <form className="connect-form" onSubmit={handleCreateSession}>
            <h3>Create New Remote Session</h3>
            <div className="form-group">
              <label>Device ID *</label>
              <input
                type="number"
                value={connectForm.device_id}
                onChange={(e) => setConnectForm({ ...connectForm, device_id: e.target.value })}
                placeholder="Enter device ID"
                required
              />
            </div>
            <div className="form-group">
              <label>Protocol *</label>
              <div className="protocol-grid">
                {['ssh', 'rdp', 'vnc', 'http'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`protocol-btn ${connectForm.protocol === p ? 'active' : ''}`}
                    onClick={() => setConnectForm({ ...connectForm, protocol: p })}
                  >
                    {getProtocolIcon(p)} {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Custom Port Mapping (optional)</label>
              <input
                type="text"
                value={connectForm.port_mapping}
                onChange={(e) => setConnectForm({ ...connectForm, port_mapping: e.target.value })}
                placeholder="e.g. 2222:22 (leave blank for default)"
              />
            </div>

            {validateResult && (
              <div className={`validate-result ${validateResult.reachable ? 'reachable' : 'unreachable'}`}>
                {validateResult.reachable ? '✅' : '❌'} Device {validateResult.reachable ? 'reachable' : 'unreachable'}
                {validateResult.latency_ms && ` — ${validateResult.latency_ms}ms latency`}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-validate" onClick={handleValidate} disabled={loading}>
                🔍 Check Connectivity
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Connecting...' : '🔐 Create Session'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
