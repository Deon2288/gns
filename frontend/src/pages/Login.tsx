import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import useStore from '../store';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await auth.login(username, password);
      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#16213e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f3460',
        borderRadius: 12,
        padding: '40px 48px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#e94560', fontSize: 32, fontWeight: 800, margin: 0 }}>GNS</h1>
          <p style={{ color: '#8892b0', fontSize: 14, marginTop: 4 }}>Fleet Management System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#ccd6f6', fontSize: 13, marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#1a1a2e',
                border: '1px solid #0f3460',
                borderRadius: 6,
                color: '#ccd6f6',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
              placeholder="Enter username"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#ccd6f6', fontSize: 13, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#1a1a2e',
                border: '1px solid #0f3460',
                borderRadius: 6,
                color: '#ccd6f6',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(233,69,96,0.15)',
              border: '1px solid #e94560',
              borderRadius: 6,
              padding: '10px 14px',
              color: '#e94560',
              fontSize: 13,
              marginBottom: 20,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#555' : '#e94560',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
