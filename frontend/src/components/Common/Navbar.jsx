import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: '📊 Dashboard' },
    { to: '/discovery', label: '🔍 Discovery' },
    { to: '/devices', label: '🖥️ Devices' },
    { to: '/snmp', label: '📡 SNMP' },
    { to: '/settings', label: '⚙️ Settings' },
  ];

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <h1>🌐 GNS</h1>
        <span className="nav-tagline">Network Surveillance</span>
      </div>
      <div className="nav-links">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="nav-user">
        <span className="user-name">👤 {user?.username}</span>
        <button className="btn-link nav-logout" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
