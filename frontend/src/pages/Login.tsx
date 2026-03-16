import React, { useState } from 'react';
import { useStore } from '../store/useStore';

const Login: React.FC = () => {
  const { login } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>🛰️</div>
        <h1 style={styles.title}>GNS Fleet Management</h1>
        <p style={styles.subtitle}>Sign in to your account</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} placeholder="Enter username" autoFocus required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} placeholder="Enter password" required />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} style={styles.btn}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e' },
  card: { background: '#fff', borderRadius: 12, padding: 40, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', textAlign: 'center' },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { margin: '0 0 4px', fontSize: 22, color: '#1a1a2e' },
  subtitle: { margin: '0 0 24px', color: '#888', fontSize: 14 },
  form: { textAlign: 'left' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, color: '#555', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' },
  error: { background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 },
  btn: { width: '100%', padding: '11px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, cursor: 'pointer', fontWeight: 600 },
};

export default Login;
