import React from 'react';
import './DeviceList.css';

interface Device {
  device_id?: number;
  id?: number;
  device_name: string;
  imei: string;
  status: string;
}

interface DeviceListProps {
  devices: Device[];
  onDeleteDevice: (id: number) => void;
  onUpdateDevice: (id: number, device: Omit<Device, 'id' | 'device_id'>) => void;
}

const DeviceList: React.FC<DeviceListProps> = ({ devices, onDeleteDevice, onUpdateDevice }) => {
  const getId = (device: Device) => device.id || device.device_id || 0;

  return (
    <div className="device-list">
      {devices.map((device) => (
        <div key={getId(device)} className="device-card">
          <div className="device-info">
            <h3>{device.device_name}</h3>
            <p><strong>IMEI:</strong> {device.imei}</p>
            <p><strong>Status:</strong> <span className={`status ${device.status}`}>{device.status}</span></p>
          </div>
          <div className="device-actions">
            <button
              onClick={() => {
                const newStatus = device.status === 'active' ? 'inactive' : 'active';
                onUpdateDevice(getId(device), { ...device, status: newStatus });
              }}
              className="btn btn-toggle"
            >
              {device.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
            </button>
            <button
              onClick={() => onDeleteDevice(getId(device))}
              className="btn btn-delete"
            >
              🗑 Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeviceList;
