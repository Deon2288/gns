import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useStore from '../store';
import { notifications as notifApi } from '../services/api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '⊞' },
  { path: '/live-map', label: 'Live Map', icon: '🗺' },
  { path: '/devices', label: 'Devices', icon: '📡' },
  { path: '/device-groups', label: 'Device Groups', icon: '📂' },
  { path: '/alerts', label: 'Alerts', icon: '🔔' },
  { path: '/geofences', label: 'Geofences', icon: '📍' },
  { path: '/trips', label: 'Trips', icon: '🚗' },
  { path: '/driver-behavior', label: 'Driver Behavior', icon: '👤' },
  { path: '/reports', label: 'Reports', icon: '📊' },
  { path: '/notifications', label: 'Notifications', icon: '📬' },
];

const Sidebar: React.FC = () => {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    notifApi.getUnreadCount()
      .then((data: any) => setUnread(data.unread_count ?? data.count ?? 0))
      .catch(() => {});
    const interval = setInterval(() => {
      notifApi.getUnreadCount()
        .then((data: any) => setUnread(data.unread_count ?? data.count ?? 0))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const styles: Record<string, React.CSSProperties> = {
    sidebar: {
      width: 240,
      minHeight: '100vh',
      background: '#1a1a2e',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '2px 0 8px rgba(0,0,0,0.4)',
      flexShrink: 0,
    },
    brand: {
      padding: '24px 20px 16px',
      borderBottom: '1px solid #0f3460',
    },
    brandTitle: {
      color: '#e94560',
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: 1,
      margin: 0,
    },
    brandSub: {
      color: '#8892b0',
      fontSize: 11,
      marginTop: 2,
    },
    nav: {
      flex: 1,
      padding: '12px 0',
      overflowY: 'auto',
    },
    navLink: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 20px',
      color: '#8892b0',
      textDecoration: 'none',
      fontSize: 14,
      transition: 'all 0.2s',
      position: 'relative',
    },
    navLinkActive: {
      color: '#e94560',
      background: 'rgba(233,69,96,0.1)',
      borderLeft: '3px solid #e94560',
    },
    footer: {
      borderTop: '1px solid #0f3460',
      padding: '16px 20px',
    },
    userInfo: {
      marginBottom: 10,
    },
    userName: {
      color: '#ccd6f6',
      fontSize: 13,
      fontWeight: 600,
    },
    userRole: {
      color: '#8892b0',
      fontSize: 11,
      textTransform: 'capitalize' as const,
    },
    logoutBtn: {
      width: '100%',
      padding: '8px 12px',
      background: 'rgba(233,69,96,0.15)',
      border: '1px solid #e94560',
      borderRadius: 4,
      color: '#e94560',
      cursor: 'pointer',
      fontSize: 13,
    },
    badge: {
      background: '#e94560',
      color: '#fff',
      borderRadius: 10,
      fontSize: 10,
      padding: '1px 6px',
      marginLeft: 'auto',
    },
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.brand}>
        <h1 style={styles.brandTitle}>GNS</h1>
        <div style={styles.brandSub}>Fleet Management System</div>
      </div>

      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            <span style={{ width: 20, textAlign: 'center' }}>{item.icon}</span>
            <span>{item.label}</span>
            {item.path === '/notifications' && unread > 0 && (
              <span style={styles.badge}>{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        {user && (
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user.full_name || user.username}</div>
            <div style={styles.userRole}>{user.role}</div>
          </div>
        )}
        <button style={styles.logoutBtn} onClick={handleLogout}>
          ↩ Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
