import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import LiveMap from './components/LiveMap';
import AlertCenter from './components/AlertCenter';
import GeofenceManager from './components/GeofenceManager';
import TripHistory from './components/TripHistory';
import DriverPerformance from './components/DriverPerformance';
import Analytics from './components/Analytics';
import DeviceManagement from './components/DeviceManagement';
import Login from './pages/Login';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useStore();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
};

const App: React.FC = () => {
  const { token } = useStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/map" element={<ProtectedLayout><LiveMap /></ProtectedLayout>} />
        <Route path="/alerts" element={<ProtectedLayout><AlertCenter /></ProtectedLayout>} />
        <Route path="/geofences" element={<ProtectedLayout><GeofenceManager /></ProtectedLayout>} />
        <Route path="/trips" element={<ProtectedLayout><TripHistory /></ProtectedLayout>} />
        <Route path="/drivers" element={<ProtectedLayout><DriverPerformance /></ProtectedLayout>} />
        <Route path="/analytics" element={<ProtectedLayout><Analytics /></ProtectedLayout>} />
        <Route path="/devices" element={<ProtectedLayout><DeviceManagement /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
