import React from 'react';

const StatCard = ({ icon, label, value, color }) => (
  <div className={`stat-card stat-card--${color}`}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-info">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

const Stats = ({ stats }) => (
  <div className="stats-grid">
    <StatCard icon="🖥️" label="Total Devices" value={stats.totalDevices} color="blue" />
    <StatCard icon="✅" label="Online" value={stats.onlineDevices} color="green" />
    <StatCard icon="❌" label="Offline" value={stats.offlineDevices} color="red" />
    <StatCard icon="📈" label="Metrics Collected" value={stats.metrics} color="purple" />
  </div>
);

export default Stats;
