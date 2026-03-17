import React, { useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface DeviceStats {
  deviceId: string;
  name: string;
  totalDistance: number;
  totalTrips: number;
  avgSpeed: number;
  maxSpeed: number;
  onlineTime: number;
  lastSeen: string;
}

interface Trip {
  tripId: string;
  deviceId: string;
  startTime: string;
  endTime: string;
  distance: number;
  avgSpeed: number;
  maxSpeed: number;
  duration: number;
  startLocation: string;
  endLocation: string;
}

interface SpeedPoint {
  time: string;
  speed: number;
}

const MOCK_DEVICES: DeviceStats[] = [
  { deviceId: '1', name: 'RUTX12-001', totalDistance: 1420.5, totalTrips: 38, avgSpeed: 62.3, maxSpeed: 118.0, onlineTime: 98.5, lastSeen: '2 min ago' },
  { deviceId: '2', name: 'FMB920-002', totalDistance: 980.2, totalTrips: 27, avgSpeed: 54.7, maxSpeed: 105.0, onlineTime: 95.1, lastSeen: '5 min ago' },
  { deviceId: '3', name: 'FMT100-003', totalDistance: 2310.8, totalTrips: 61, avgSpeed: 71.0, maxSpeed: 132.0, onlineTime: 99.2, lastSeen: 'Just now' },
  { deviceId: '4', name: 'RUTX11-004', totalDistance: 545.3, totalTrips: 14, avgSpeed: 48.6, maxSpeed: 95.0,  onlineTime: 87.4, lastSeen: '1 hr ago' },
];

function generateTrips(deviceId: string, count = 8): Trip[] {
  const locations = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Oxford', 'Cambridge', 'Edinburgh'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(now - (i + 1) * 3600000 * 6);
    const duration = Math.floor(Math.random() * 120) + 20;
    const end = new Date(start.getTime() + duration * 60000);
    const distance = Math.round((Math.random() * 150 + 10) * 10) / 10;
    const avgSpd = Math.round(distance / (duration / 60));
    return {
      tripId: `trip-${deviceId}-${i}`,
      deviceId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      distance,
      avgSpeed: avgSpd,
      maxSpeed: avgSpd + Math.round(Math.random() * 40),
      duration,
      startLocation: locations[Math.floor(Math.random() * locations.length)],
      endLocation: locations[Math.floor(Math.random() * locations.length)],
    };
  });
}

function generateSpeedHistory(): SpeedPoint[] {
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    speed: Math.round(Math.random() * 90 + 10),
  }));
}

function generateDailyDistance(): Array<{ day: string; distance: number }> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({ day, distance: Math.round(Math.random() * 300 + 50) }));
}

const AnalyticsDashboard: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<DeviceStats>(MOCK_DEVICES[0]);
  const [trips, setTrips] = useState<Trip[]>(() => generateTrips(MOCK_DEVICES[0].deviceId));
  const [speedHistory, setSpeedHistory] = useState<SpeedPoint[]>(() => generateSpeedHistory());
  const [dailyDistance, setDailyDistance] = useState<Array<{ day: string; distance: number }>>(() => generateDailyDistance());
  const [activeSection, setActiveSection] = useState<'overview' | 'trips' | 'speed'>('overview');

  const loadDeviceData = useCallback((device: DeviceStats) => {
    setSelectedDevice(device);
    setTrips(generateTrips(device.deviceId));
    setSpeedHistory(generateSpeedHistory());
    setDailyDistance(generateDailyDistance());
  }, []);

  return (
    <div style={pageStyle}>
      <h2 style={headingStyle}>📊 Analytics Dashboard</h2>
      <p style={subtextStyle}>Device statistics, trip history, and speed analytics.</p>

      {/* Fleet Summary Cards */}
      <div style={statsGridStyle}>
        <StatCard label="Total Devices" value={String(MOCK_DEVICES.length)} icon="📡" color="#6366f1" />
        <StatCard label="Total Trips Today" value="23" icon="🗺️" color="#22c55e" />
        <StatCard label="Fleet Distance (km)" value="6,257" icon="📍" color="#f59e0b" />
        <StatCard label="Avg Fleet Speed" value="59.2 km/h" icon="⚡" color="#3b82f6" />
      </div>

      <div style={layoutStyle}>
        {/* Device Selector */}
        <aside style={sidebarStyle}>
          <h3 style={sectionHeadingStyle}>Devices</h3>
          {MOCK_DEVICES.map(device => (
            <button
              key={device.deviceId}
              onClick={() => loadDeviceData(device)}
              style={{
                ...deviceBtnStyle,
                ...(selectedDevice.deviceId === device.deviceId ? activeDeviceBtnStyle : {}),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>{device.name}</span>
                <span style={{ fontSize: 10, color: '#22c55e' }}>● online</span>
              </div>
              <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                Last seen: {device.lastSeen}
              </div>
            </button>
          ))}
        </aside>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Device Stats */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={sectionHeadingStyle}>{selectedDevice.name}</h3>
            <div style={deviceStatsGridStyle}>
              <MiniStat label="Total Distance" value={`${selectedDevice.totalDistance.toLocaleString()} km`} />
              <MiniStat label="Total Trips" value={String(selectedDevice.totalTrips)} />
              <MiniStat label="Avg Speed" value={`${selectedDevice.avgSpeed} km/h`} />
              <MiniStat label="Max Speed" value={`${selectedDevice.maxSpeed} km/h`} />
              <MiniStat label="Online Time" value={`${selectedDevice.onlineTime}%`} />
              <MiniStat label="Last Seen" value={selectedDevice.lastSeen} />
            </div>
          </div>

          {/* Section Tabs */}
          <div style={sectionTabBarStyle}>
            {(['overview', 'trips', 'speed'] as const).map(section => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                style={{
                  ...sectionTabBtnStyle,
                  ...(activeSection === section ? activeSectionTabStyle : {}),
                }}
              >
                {section === 'overview' && '📈 Overview'}
                {section === 'trips'    && '🗺️ Trip History'}
                {section === 'speed'   && '⚡ Speed Analytics'}
              </button>
            ))}
          </div>

          {/* Overview Charts */}
          {activeSection === 'overview' && (
            <div style={cardStyle}>
              <h4 style={{ color: '#c4c4f3', marginBottom: 16, fontSize: 15 }}>Daily Distance (km) — Last 7 Days</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyDistance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" />
                  <XAxis dataKey="day" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: 6 }}
                    labelStyle={{ color: '#e0e0e0' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <Bar dataKey="distance" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trip History */}
          {activeSection === 'trips' && (
            <div style={cardStyle}>
              <h4 style={{ color: '#c4c4f3', marginBottom: 16, fontSize: 15 }}>Trip History</h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Start</th>
                      <th style={thStyle}>End</th>
                      <th style={thStyle}>From</th>
                      <th style={thStyle}>To</th>
                      <th style={thStyle}>Distance</th>
                      <th style={thStyle}>Duration</th>
                      <th style={thStyle}>Avg Speed</th>
                      <th style={thStyle}>Max Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map(trip => (
                      <tr key={trip.tripId} style={{ borderBottom: '1px solid #2d2d44' }}>
                        <td style={tdStyle}>{formatTime(trip.startTime)}</td>
                        <td style={tdStyle}>{formatTime(trip.endTime)}</td>
                        <td style={tdStyle}>{trip.startLocation}</td>
                        <td style={tdStyle}>{trip.endLocation}</td>
                        <td style={tdStyle}>{trip.distance} km</td>
                        <td style={tdStyle}>{trip.duration} min</td>
                        <td style={tdStyle}>{trip.avgSpeed} km/h</td>
                        <td style={{ ...tdStyle, color: trip.maxSpeed > 120 ? '#f87171' : '#d1d5db' }}>
                          {trip.maxSpeed} km/h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Speed Analytics */}
          {activeSection === 'speed' && (
            <div style={cardStyle}>
              <h4 style={{ color: '#c4c4f3', marginBottom: 16, fontSize: 15 }}>Speed Over Time (km/h) — Last 24 Hours</h4>
              <ResponsiveContainer width="100%" height={270}>
                <LineChart data={speedHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d2d44" />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" km/h" />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: 6 }}
                    labelStyle={{ color: '#e0e0e0' }}
                    itemStyle={{ color: '#22c55e' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="speed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                <MiniStat label="Max Speed (24h)" value={`${Math.max(...speedHistory.map(p => p.speed))} km/h`} />
                <MiniStat label="Avg Speed (24h)" value={`${Math.round(speedHistory.reduce((s, p) => s + p.speed, 0) / speedHistory.length)} km/h`} />
                <MiniStat label="Speeding Events" value={String(speedHistory.filter(p => p.speed > 100).length)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-components

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div style={{ ...cardStyle, borderTop: `3px solid ${color}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ color: '#9ca3af', fontSize: 12 }}>{label}</div>
        <div style={{ color: '#e0e0e0', fontSize: 22, fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  </div>
);

interface MiniStatProps {
  label: string;
  value: string;
}

const MiniStat: React.FC<MiniStatProps> = ({ label, value }) => (
  <div style={{ background: '#0f0f1a', borderRadius: 6, padding: '10px 14px' }}>
    <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>{label}</div>
    <div style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 15 }}>{value}</div>
  </div>
);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Styles
const pageStyle: React.CSSProperties = { padding: 32, maxWidth: 1400, margin: '0 auto' };
const headingStyle: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: '#e0e0e0', marginBottom: 8 };
const subtextStyle: React.CSSProperties = { color: '#9ca3af', marginBottom: 24, fontSize: 16 };
const statsGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 };
const layoutStyle: React.CSSProperties = { display: 'flex', gap: 20, alignItems: 'flex-start' };
const sidebarStyle: React.CSSProperties = { width: 220, flexShrink: 0 };
const cardStyle: React.CSSProperties = { background: '#1a1a2e', border: '1px solid #2d2d44', borderRadius: 8, padding: 20 };
const sectionHeadingStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: '#c4c4f3', marginBottom: 12 };
const deviceBtnStyle: React.CSSProperties = { width: '100%', background: '#0f0f1a', border: '1px solid #2d2d44', borderRadius: 6, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' };
const activeDeviceBtnStyle: React.CSSProperties = { border: '1px solid #6366f1', background: '#1e1e3f' };
const deviceStatsGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 };
const sectionTabBarStyle: React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 16 };
const sectionTabBtnStyle: React.CSSProperties = { padding: '8px 16px', borderRadius: 6, border: '1px solid #2d2d44', background: '#0f0f1a', color: '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: 500 };
const activeSectionTabStyle: React.CSSProperties = { background: '#1e1e3f', border: '1px solid #6366f1', color: '#818cf8' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', color: '#6b7280', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid #2d2d44', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: '#d1d5db', verticalAlign: 'middle' };

export default AnalyticsDashboard;
