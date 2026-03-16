import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

const NAV_LINKS = [
  { path: '/', label: '📊 Dashboard' },
  { path: '/map', label: '🗺️ Live Map' },
  { path: '/alerts', label: '🚨 Alerts' },
  { path: '/geofences', label: '📍 Geofences' },
  { path: '/trips', label: '🚗 Trips' },
  { path: '/drivers', label: '👨‍💼 Drivers' },
  { path: '/analytics', label: '📈 Analytics' },
  { path: '/devices', label: '🔧 Devices' },
];

const Navbar: React.FC = () => {
  const location = useLocation();
  const { user, alertSummary, logout } = useStore();
  const totalAlerts = alertSummary.critical + alertSummary.warning;

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <span style={styles.logo}>🛰️ GNS Fleet</span>
      </div>
      <div style={styles.links}>
        {NAV_LINKS.map(({ path, label }) => (
          <Link
            key={path}
            to={path}
            style={{ ...styles.link, ...(location.pathname === path ? styles.activeLink : {}) }}
          >
            {label}
            {path === '/alerts' && totalAlerts > 0 && (
              <span style={styles.badge}>{totalAlerts}</span>
            )}
          </Link>
        ))}
      </div>
      <div style={styles.user}>
        {user && <span style={styles.userName}>{user.username} ({user.role})</span>}
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>
    </nav>
  );
};

const styles: Record<string, React.CSSProperties> = {
  nav: { display: 'flex', alignItems: 'center', background: '#1a1a2e', color: '#fff', padding: '0 16px', height: 56, gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', position: 'sticky', top: 0, zIndex: 1000 },
  brand: { marginRight: 16 },
  logo: { fontSize: 18, fontWeight: 700, color: '#4fc3f7' },
  links: { display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' },
  link: { color: '#b0bec5', textDecoration: 'none', padding: '6px 10px', borderRadius: 6, fontSize: 13, position: 'relative', whiteSpace: 'nowrap' },
  activeLink: { background: '#0d47a1', color: '#fff' },
  badge: { background: '#f44336', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10, position: 'absolute', top: 2, right: 2 },
  user: { display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  userName: { fontSize: 12, color: '#90a4ae' },
  logoutBtn: { background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
};

export default Navbar;
