import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Device } from '../types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const statusColor: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  offline: '#ef4444',
};

function createDeviceIcon(status: string) {
  const color = statusColor[status] || '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 0 6px ${color};
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const FitBounds: React.FC<{ devices: Device[] }> = ({ devices }) => {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    const valid = devices.filter((d) => d.last_lat != null && d.last_lon != null);
    if (valid.length > 0 && !fitted.current) {
      const bounds = L.latLngBounds(valid.map((d) => [d.last_lat!, d.last_lon!]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      fitted.current = true;
    }
  }, [devices, map]);

  return null;
};

interface DeviceMapProps {
  devices: Device[];
  selectedDevice?: Device | null;
  onDeviceSelect?: (device: Device) => void;
  height?: string;
}

const DeviceMap: React.FC<DeviceMapProps> = ({
  devices,
  selectedDevice,
  onDeviceSelect,
  height = '100%',
}) => {
  const validDevices = devices.filter((d) => d.last_lat != null && d.last_lon != null);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height, width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBounds devices={validDevices} />
      {validDevices.map((device) => (
        <Marker
          key={device.device_id}
          position={[device.last_lat!, device.last_lon!]}
          icon={createDeviceIcon(device.status)}
          eventHandlers={{ click: () => onDeviceSelect && onDeviceSelect(device) }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{device.device_name}</strong>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                <div>Status: <span style={{ color: statusColor[device.status] }}>{device.status}</span></div>
                {device.last_speed != null && <div>Speed: {device.last_speed} km/h</div>}
                {device.last_seen && (
                  <div>Last seen: {new Date(device.last_seen).toLocaleString()}</div>
                )}
                {device.group_name && <div>Group: {device.group_name}</div>}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default DeviceMap;