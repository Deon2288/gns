import React from 'react';
import { TabId } from '../App';

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

interface NavTab {
  id: TabId;
  label: string;
  icon: string;
  description: string;
}

const TABS: NavTab[] = [
  { id: 'map',       label: 'Live Map',          icon: '🗺️',  description: 'Real-time device positions' },
  { id: 'analytics', label: 'Analytics',          icon: '📊',  description: 'Trip history & statistics' },
  { id: 'discovery', label: 'Discovery Scanner',  icon: '🔍',  description: 'Network scan & bulk register' },
  { id: 'alerts',    label: 'Alerts',             icon: '🚨',  description: 'Alert management' },
  { id: 'admin',     label: 'Admin',              icon: '⚙️',  description: 'System administration' },
];

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav style={navStyle}>
      <div style={brandStyle}>
        <span style={logoStyle}>📡</span>
        <span style={titleStyle}>GNS Fleet Manager</span>
      </div>
      <div style={tabsContainerStyle}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.description}
            style={{
              ...tabButtonStyle,
              ...(activeTab === tab.id ? activeTabStyle : {}),
            }}
          >
            <span style={tabIconStyle}>{tab.icon}</span>
            <span style={tabLabelStyle}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: '#12122a',
  borderBottom: '1px solid #2d2d44',
  padding: '0 24px',
  height: 60,
  flexShrink: 0,
  gap: 24,
};

const brandStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginRight: 16,
  flexShrink: 0,
};

const logoStyle: React.CSSProperties = {
  fontSize: 22,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#6366f1',
  whiteSpace: 'nowrap',
};

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  overflowX: 'auto',
};

const tabButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  color: '#9ca3af',
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  transition: 'background 0.15s, color 0.15s',
};

const activeTabStyle: React.CSSProperties = {
  background: '#1e1e3f',
  color: '#818cf8',
  borderBottom: '2px solid #6366f1',
};

const tabIconStyle: React.CSSProperties = {
  fontSize: 16,
};

const tabLabelStyle: React.CSSProperties = {
  fontSize: 13,
};

export default Navbar;
