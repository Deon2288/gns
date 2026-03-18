import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import OTADashboard from './components/OTA/OTADashboard';
import FirmwareManager from './components/OTA/FirmwareManager';
import UpdateHistory from './components/OTA/UpdateHistory';
import DeviceMap from './components/DeviceMap';

const App: React.FC = () => {
  return (
    <Router>
      <div style={{ fontFamily: 'sans-serif' }}>
        <nav style={{
          background: '#1a1a2e',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
        }}>
          <span style={{ color: '#e94560', fontWeight: 700, fontSize: '1.1rem', marginRight: '1rem' }}>
            🛰 GNS
          </span>
          <NavLink to="/" style={navStyle} end>🗺 Live Map</NavLink>
          <NavLink to="/ota" style={navStyle}>🔄 Firmware Updates</NavLink>
          <NavLink to="/ota/firmware" style={navStyle}>📦 Firmware Manager</NavLink>
          <NavLink to="/ota/history" style={navStyle}>📋 Update History</NavLink>
        </nav>

        <main>
          <Routes>
            <Route path="/" element={<DeviceMap />} />
            <Route path="/ota" element={<OTADashboard />} />
            <Route path="/ota/firmware" element={<FirmwareManager />} />
            <Route path="/ota/history" element={<UpdateHistory />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const navStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  color: isActive ? '#e94560' : '#aaa',
  textDecoration: 'none',
  fontWeight: isActive ? 600 : 400,
  padding: '0.25rem 0.5rem',
  borderRadius: 4,
  background: isActive ? 'rgba(233,69,96,0.1)' : 'transparent',
});

export default App;
