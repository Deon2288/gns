import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useStore from './store';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import Devices from './pages/Devices';
import DeviceGroups from './pages/DeviceGroups';
import Alerts from './pages/Alerts';
import Geofences from './pages/Geofences';
import Trips from './pages/Trips';
import DriverBehavior from './pages/DriverBehavior';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';

const ProtectedRoute: React.FC = () => {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#16213e' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live-map" element={<LiveMap />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/device-groups" element={<DeviceGroups />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/geofences" element={<Geofences />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/driver-behavior" element={<DriverBehavior />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
