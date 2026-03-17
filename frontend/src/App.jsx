import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import useAuth from './hooks/useAuth';
import Navbar from './components/Common/Navbar';
import Sidebar from './components/Common/Sidebar';
import Loading from './components/Common/Loading';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import DiscoveryPanel from './components/Discovery/DiscoveryPanel';
import DeviceList from './components/Devices/DeviceList';
import DeviceDetails from './components/Devices/DeviceDetails';
import MetricsViewer from './components/SNMP/MetricsViewer';
import Settings from './components/Settings/Settings';
import './App.css';

const AuthPage = () => {
  const [showRegister, setShowRegister] = useState(false);
  return showRegister
    ? <Register onSwitchToLogin={() => setShowRegister(false)} />
    : <Login onSwitchToRegister={() => setShowRegister(true)} />;
};

const ProtectedLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const [selectedDevice, setSelectedDevice] = useState(null);

  if (loading) return <Loading fullPage message="Authenticating..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/discovery" element={<DiscoveryPanel />} />
            <Route
              path="/devices"
              element={
                selectedDevice
                  ? <DeviceDetails device={selectedDevice} onBack={() => setSelectedDevice(null)} />
                  : <DeviceList onSelectDevice={setSelectedDevice} />
              }
            />
            <Route path="/snmp" element={<MetricsViewer />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Loading fullPage message="Starting GNS..." />;
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
