import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const menuItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/discovery', label: 'Discovery', icon: '🔍' },
    { to: '/devices', label: 'Devices', icon: '🖥️' },
    { to: '/snmp', label: 'SNMP Metrics', icon: '📡' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
