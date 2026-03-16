import React, { useEffect, useState, useCallback } from 'react';
import { devices as devicesApi } from '../services/api';
import { Device } from '../types';
import DeviceMap from '../components/DeviceMap';

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  offline: '#ef4444',
};

const LiveMap: React.FC = () => {
  const [deviceList, setDeviceList] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(() => {
    devicesApi.getAll()
      .then((data: any) => setDeviceList(Array.isArray(data) ? data : data.devices || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const filtered = deviceList.filter((d) =>
    d.device_name.toLowerCase().includes(search.toLowerCase())
  );

  const s: Record<string, React.CSSProperties> = {
    container: { display: 'flex', height: '100vh', overflow: 'hidden' },
    panel: {
      width: 280,
      background: '#1a1a2e',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #0f3460',
      flexShrink: 0,
    },
    panelHeader: { padding: '16px 16px 8px', borderBottom: '1px solid #0f3460' },
    panelTitle: { color: '#ccd6f6', fontWeight: 600, fontSize: 15, margin: 0 },
    search: {
      width: '100%',
      padding: '8px 10px',
      background: '#0f3460',
      border: '1px solid #16213e',
      borderRadius: 6,
      color: '#ccd6f6',
      fontSize: 13,
      marginTop: 8,
      boxSizing: 'border-box',
      outline: 'none',
    },
    deviceList: { flex: 1, overflowY: 'auto', padding: '8px 0' },
    deviceItem: {
      padding: '10px 16px',
      cursor: 'pointer',
      borderBottom: '1px solid #0f3460',
      transition: 'background 0.15s',
    },
    mapArea: { flex: 1, position: 'relative' },
    detailPanel: {
      position: 'absolute' as const,
      top: 16,
      right: 16,
      background: '#0f3460',
      borderRadius: 10,
      padding: 16,
      minWidth: 220,
      zIndex: 1000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      color: '#ccd6f6',
    },
  };

  return (
    <div style={s.container}>
      <div style={s.panel}>
        <div style={s.panelHeader}>
          <h3 style={s.panelTitle}>Live Tracking</h3>
          <input
            style={s.search}
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={s.deviceList}>
          {loading && (
            <div style={{ color: '#8892b0', fontSize: 13, padding: 16 }}>Loading devices...</div>
          )}
          {filtered.map((device) => (
            <div
              key={device.device_id}
              style={{
                ...s.deviceItem,
                background: selected?.device_id === device.device_id ? '#0f3460' : 'transparent',
              }}
              onClick={() => setSelected(device)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: STATUS_COLOR[device.status] || '#6b7280',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                <span style={{ color: '#ccd6f6', fontSize: 13, fontWeight: 500 }}>
                  {device.device_name}
                </span>
              </div>
              {device.last_speed != null && (
                <div style={{ color: '#8892b0', fontSize: 11, marginTop: 3, paddingLeft: 18 }}>
                  {device.last_speed} km/h
                  {device.last_seen && ` · ${new Date(device.last_seen).toLocaleTimeString()}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={s.mapArea}>
        <DeviceMap
          devices={deviceList}
          selectedDevice={selected}
          onDeviceSelect={setSelected}
          height="100%"
        />
        {selected && (
          <div style={s.detailPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 15 }}>{selected.device_name}</strong>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 16 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div>
                Status:{' '}
                <span style={{ color: STATUS_COLOR[selected.status], textTransform: 'capitalize' }}>
                  {selected.status}
                </span>
              </div>
              {selected.last_speed != null && <div>Speed: {selected.last_speed} km/h</div>}
              {selected.last_lat != null && (
                <div>
                  Position: {selected.last_lat.toFixed(5)}, {selected.last_lon!.toFixed(5)}
                </div>
              )}
              {selected.last_seen && (
                <div>Last seen: {new Date(selected.last_seen).toLocaleString()}</div>
              )}
              {selected.group_name && <div>Group: {selected.group_name}</div>}
              {selected.model && <div>Model: {selected.model}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMap;
