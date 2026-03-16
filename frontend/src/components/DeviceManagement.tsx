import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../store/useStore';
import { DeviceCommand } from '../types';

const COMMANDS = ['lock', 'unlock', 'immobilize', 'activate', 'reboot', 'request_location'];

const DeviceManagement: React.FC = () => {
  const { devices, fetchDevices } = useStore();
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [selectedCommand, setSelectedCommand] = useState('request_location');

  useEffect(() => { fetchDevices(); const i = setInterval(fetchDevices, 15000); return () => clearInterval(i); }, [fetchDevices]);

  const fetchCommands = useCallback(async (deviceId: number) => {
    try {
      const { data } = await api.get('/api/commands', { params: { device_id: deviceId } });
      setCommands(data);
    } catch { setCommands([]); }
  }, []);

  const selectDevice = (id: number) => {
    setSelectedDevice(id);
    fetchCommands(id);
  };

  const sendCommand = async () => {
    if (!selectedDevice) return;
    await api.post('/api/commands', { device_id: selectedDevice, command: selectedCommand });
    fetchCommands(selectedDevice);
  };

  const statusColor: Record<string, string> = { online: '#4caf50', offline: '#9e9e9e', idle: '#ff9800' };
  const cmdColor: Record<string, string> = { pending: '#ff9800', sent: '#2196f3', acknowledged: '#1976d2', completed: '#4caf50', failed: '#f44336' };

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>🔧 Device Management</h2>
      <div style={styles.layout}>
        {/* Device list */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Devices ({devices.length})</div>
          {devices.map((d) => (
            <div key={d.device_id} onClick={() => selectDevice(d.device_id)}
              style={{ ...styles.deviceRow, background: selectedDevice === d.device_id ? '#e3f2fd' : '#fff' }}>
              <span style={{ ...styles.statusDot, background: statusColor[d.status] }} />
              <div style={styles.deviceInfo}>
                <div style={styles.deviceName}>{d.device_name}</div>
                {d.imei && <div style={styles.imei}>IMEI: {d.imei}</div>}
              </div>
              <span style={{ ...styles.statusLabel, color: statusColor[d.status] }}>{d.status}</span>
            </div>
          ))}
        </div>

        {/* Device detail */}
        <div style={styles.main}>
          {!selectedDevice ? (
            <div style={styles.empty}>Select a device to manage it</div>
          ) : (() => {
            const device = devices.find((d) => d.device_id === selectedDevice);
            if (!device) return null;
            return (
              <>
                <div style={styles.deviceCard}>
                  <h3 style={{ margin: '0 0 12px' }}>{device.device_name}</h3>
                  <div style={styles.detailGrid}>
                    <Detail label="Status" value={<span style={{ color: statusColor[device.status] }}>{device.status}</span>} />
                    <Detail label="Model" value={device.model || '—'} />
                    <Detail label="IMEI" value={device.imei || '—'} />
                    <Detail label="Group" value={device.group_name || '—'} />
                    <Detail label="Speed" value={device.speed != null ? `${device.speed.toFixed(1)} km/h` : '—'} />
                    <Detail label="Fuel" value={device.fuel_level != null ? `${device.fuel_level.toFixed(0)}%` : '—'} />
                    <Detail label="Ignition" value={device.ignition != null ? (device.ignition ? 'On' : 'Off') : '—'} />
                    <Detail label="Last Seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : '—'} />
                  </div>
                </div>

                {/* Command panel */}
                <div style={styles.commandPanel}>
                  <h4 style={{ margin: '0 0 12px' }}>Send Command</h4>
                  <div style={styles.commandRow}>
                    <select value={selectedCommand} onChange={(e) => setSelectedCommand(e.target.value)} style={styles.select}>
                      {COMMANDS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                    </select>
                    <button onClick={sendCommand} style={styles.sendBtn}>▶ Send</button>
                  </div>
                </div>

                {/* Command queue */}
                <div style={styles.commandQueue}>
                  <h4 style={{ margin: '0 0 12px' }}>Command Queue</h4>
                  {commands.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No commands</div>}
                  {commands.map((c) => (
                    <div key={c.command_id} style={styles.cmdRow}>
                      <span style={styles.cmdName}>{c.command}</span>
                      <span style={{ ...styles.cmdStatus, color: cmdColor[c.status] }}>{c.status}</span>
                      <span style={styles.cmdTime}>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const Detail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 13, color: '#333' }}>{value}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, background: '#f5f5f5', minHeight: '100vh' },
  title: { margin: '0 0 20px', color: '#1a1a2e' },
  layout: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' },
  sidebar: { background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' },
  sidebarTitle: { padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid #eee', fontSize: 13, color: '#1a1a2e' },
  deviceRow: { padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f5f5f5' },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  deviceInfo: { flex: 1, minWidth: 0 },
  deviceName: { fontSize: 13, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  imei: { fontSize: 10, color: '#999' },
  statusLabel: { fontSize: 11, fontWeight: 600 },
  main: { display: 'flex', flexDirection: 'column', gap: 16 },
  empty: { background: '#fff', borderRadius: 8, padding: 40, textAlign: 'center', color: '#888', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  deviceCard: { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  commandPanel: { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  commandRow: { display: 'flex', gap: 8 },
  select: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, flex: 1 },
  sendBtn: { background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 20px', cursor: 'pointer', fontSize: 13 },
  commandQueue: { background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cmdRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 },
  cmdName: { fontWeight: 600, flex: 1 },
  cmdStatus: { fontWeight: 600, fontSize: 12 },
  cmdTime: { fontSize: 11, color: '#999' },
};

export default DeviceManagement;
