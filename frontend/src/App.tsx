import React, { useState } from 'react';
import Navbar from './components/Navbar';
import DeviceMap from './components/DeviceMap';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import DiscoveryDashboard from './components/DiscoveryDashboard';

export type TabId = 'map' | 'analytics' | 'discovery' | 'alerts' | 'admin';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('map');

  const renderContent = () => {
    switch (activeTab) {
      case 'map':
        return <DeviceMap />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'discovery':
        return <DiscoveryDashboard />;
      case 'alerts':
        return <AlertsPanel />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <DeviceMap />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a' }}>
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </main>
    </div>
  );
};

const AlertsPanel: React.FC = () => (
  <div style={panelStyle}>
    <h2 style={headingStyle}>🚨 Alerts</h2>
    <p style={subtextStyle}>No active alerts. All devices operating normally.</p>
    <div style={cardGridStyle}>
      <AlertCard type="Speed" message="No speed violations" color="#22c55e" />
      <AlertCard type="Geofence" message="No geofence breaches" color="#22c55e" />
      <AlertCard type="Battery" message="All batteries healthy" color="#22c55e" />
      <AlertCard type="Connection" message="All devices connected" color="#22c55e" />
    </div>
  </div>
);

interface AlertCardProps {
  type: string;
  message: string;
  color: string;
}

const AlertCard: React.FC<AlertCardProps> = ({ type, message, color }) => (
  <div style={{ ...cardStyle, borderLeft: `4px solid ${color}` }}>
    <h3 style={{ color, marginBottom: 8 }}>{type}</h3>
    <p style={{ color: '#9ca3af', fontSize: 14 }}>{message}</p>
  </div>
);

const AdminPanel: React.FC = () => (
  <div style={panelStyle}>
    <h2 style={headingStyle}>⚙️ Administration</h2>
    <p style={subtextStyle}>Manage devices, users, and system configuration.</p>
    <div style={cardGridStyle}>
      <AdminCard title="Devices" description="Manage registered GPS devices" icon="📡" />
      <AdminCard title="Users" description="Manage user accounts and permissions" icon="👥" />
      <AdminCard title="Settings" description="System configuration and preferences" icon="🔧" />
      <AdminCard title="Database" description="Database status and maintenance" icon="🗄️" />
    </div>
  </div>
);

interface AdminCardProps {
  title: string;
  description: string;
  icon: string;
}

const AdminCard: React.FC<AdminCardProps> = ({ title, description, icon }) => (
  <div style={cardStyle}>
    <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
    <h3 style={{ color: '#e0e0e0', marginBottom: 8 }}>{title}</h3>
    <p style={{ color: '#9ca3af', fontSize: 14 }}>{description}</p>
  </div>
);

const panelStyle: React.CSSProperties = {
  padding: '32px',
  maxWidth: '1200px',
  margin: '0 auto',
};

const headingStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: '#e0e0e0',
  marginBottom: 8,
};

const subtextStyle: React.CSSProperties = {
  color: '#9ca3af',
  marginBottom: 24,
  fontSize: 16,
};

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '1px solid #2d2d44',
  borderRadius: 8,
  padding: 20,
};

export default App;
