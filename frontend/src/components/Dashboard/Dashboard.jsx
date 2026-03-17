import React, { useEffect, useState } from 'react';
import Stats from './Stats';
import { discoveryService } from '../../services/discoveryService';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalDevices: 0, onlineDevices: 0, offlineDevices: 0, metrics: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const devicesRes = await discoveryService.listDevices();
        const devices = devicesRes.devices || [];
        setStats({
          totalDevices: devices.length,
          onlineDevices: devices.filter((d) => d.status === 'online').length,
          offlineDevices: devices.filter((d) => d.status === 'offline').length,
          metrics: devices.reduce((acc, d) => acc + (d.metrics?.length || 0), 0),
        });
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>📊 Dashboard</h2>
        <p>System overview and network statistics</p>
      </div>
      {loading ? (
        <div className="loading">Loading dashboard...</div>
      ) : (
        <Stats stats={stats} />
      )}
    </div>
  );
};

export default Dashboard;
