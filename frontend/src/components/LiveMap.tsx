import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../store/useStore';
import { Device, Geofence } from '../types';

// Fix default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const statusColor: Record<string, string> = { online: '#4caf50', offline: '#9e9e9e', idle: '#ff9800' };

function makeIcon(status: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${statusColor[status] || '#9e9e9e'};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const LiveMap: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [devRes, geoRes] = await Promise.all([
        api.get('/api/gps/latest'),
        api.get('/api/geofences'),
      ]);
      setDevices(devRes.data);
      setGeofences(geoRes.data);
    } catch (err) {
      console.error('Map fetch error', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const center: [number, number] = devices.length > 0 && devices[0].latitude
    ? [devices[0].latitude, devices[0].longitude!]
    : [-26.2, 28.0]; // Johannesburg default

  return (
    <div style={{ height: 'calc(100vh - 56px)', position: 'relative' }}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Devices ({devices.length})</div>
        {devices.map((d) => (
          <div key={d.device_id} style={{ ...styles.deviceItem, background: selected?.device_id === d.device_id ? '#e3f2fd' : '#fff' }}
            onClick={() => setSelected(d)}>
            <span style={{ ...styles.dot, background: statusColor[d.status] || '#9e9e9e' }} />
            <span style={styles.deviceName}>{d.device_name}</span>
            <span style={styles.deviceSpeed}>{d.speed != null ? `${d.speed.toFixed(0)} km/h` : ''}</span>
          </div>
        ))}
      </div>

      <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Geofences */}
        {geofences.map((g) => {
          if (g.shape_type === 'circle' && g.center_lat && g.center_lon && g.radius_meters) {
            return <Circle key={g.geofence_id} center={[g.center_lat, g.center_lon]} radius={g.radius_meters}
              pathOptions={{ color: '#1976d2', fillOpacity: 0.1 }}>
              <Popup>{g.name}</Popup>
            </Circle>;
          }
          if (g.shape_type === 'polygon' && g.polygon_coords) {
            return <Polygon key={g.geofence_id} positions={g.polygon_coords as [number, number][]}
              pathOptions={{ color: '#7b1fa2', fillOpacity: 0.1 }}>
              <Popup>{g.name}</Popup>
            </Polygon>;
          }
          return null;
        })}

        {/* Device markers */}
        {devices.map((d) => d.latitude != null && d.longitude != null ? (
          <Marker key={d.device_id} position={[d.latitude, d.longitude]} icon={makeIcon(d.status)}
            eventHandlers={{ click: () => setSelected(d) }}>
            <Popup>
              <strong>{d.device_name}</strong><br />
              Status: {d.status}<br />
              Speed: {d.speed != null ? `${d.speed.toFixed(1)} km/h` : '—'}<br />
              Fuel: {d.fuel_level != null ? `${d.fuel_level.toFixed(0)}%` : '—'}<br />
              {d.last_seen && <>Last seen: {new Date(d.last_seen).toLocaleTimeString()}</>}
            </Popup>
          </Marker>
        ) : null)}
      </MapContainer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: { position: 'absolute', top: 10, left: 10, zIndex: 1000, background: '#fff', borderRadius: 8, width: 200, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  sidebarTitle: { padding: '10px 12px', fontWeight: 700, borderBottom: '1px solid #eee', fontSize: 13, color: '#1a1a2e' },
  deviceItem: { padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f5f5f5', fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  deviceName: { flex: 1, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deviceSpeed: { color: '#888', fontSize: 11 },
};

export default LiveMap;
