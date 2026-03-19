import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import { MapView } from './components/MapContainer';
import { DevicesPage } from './components/DevicesPage';
import { Dashboard } from './components/Dashboard';
import { AlertsComponent } from './components/AlertsComponent';
import { AdminPanel } from './components/AdminPanel';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState(0);

  useEffect(() => {
    const fetchAlertsCount = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const res = await axios.get('http://197.242.150.120:5000/api/alerts?limit=100', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const unacknowledged = res.data.filter((a: any) => !a.acknowledged).length;
        setUnacknowledgedAlerts(unacknowledged);
      } catch (err: any) {
        // Silently fail for alerts - it's not critical
        if (err.code !== 'ECONNABORTED') {
          console.debug('Alerts check skipped');
        }
      }
    };

    fetchAlertsCount();
    const interval = setInterval(fetchAlertsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <div className="nav-brand">
            <h1>🚀 GNS - GPS Tracking System</h1>
          </div>
          <div className="nav-tabs">
            <Link
              to="/"
              className={`nav-tab ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              📍 Live Map
            </Link>
            <Link
              to="/devices"
              className={`nav-tab ${activeTab === 'devices' ? 'active' : ''}`}
              onClick={() => setActiveTab('devices')}
            >
              🚗 Devices
            </Link>
            <Link
              to="/dashboard"
              className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </Link>
            <Link
              to="/alerts"
              className={`nav-tab ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              🚨 Alerts {unacknowledgedAlerts > 0 && <span className="alert-badge">{unacknowledgedAlerts}</span>}
            </Link>
            <Link
              to="/admin"
              className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              ⚙️ Admin
            </Link>
          </div>
        </nav>

        <div className="content-area">
          <Routes>
            <Route path="/" element={<MapView />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/alerts" element={<AlertsComponent />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
