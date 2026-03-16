import React, { useState } from 'react';
import './DeviceForm.css';

interface Device {
  device_name: string;
  imei: string;
  status: string;
}

interface DeviceFormProps {
  onAddDevice: (device: Device) => void;
}

const DeviceForm: React.FC<DeviceFormProps> = ({ onAddDevice }) => {
  const [formData, setFormData] = useState<Device>({
    device_name: '',
    imei: '',
    status: 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.device_name || !formData.imei) {
      alert('Please fill in all fields');
      return;
    }
    onAddDevice(formData);
    setFormData({ device_name: '', imei: '', status: 'active' });
  };

  return (
    <form onSubmit={handleSubmit} className="device-form">
      <div className="form-group">
        <label htmlFor="device_name">Device Name:</label>
        <input
          type="text"
          id="device_name"
          name="device_name"
          value={formData.device_name}
          onChange={handleChange}
          placeholder="e.g., Truck 1"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="imei">IMEI:</label>
        <input
          type="text"
          id="imei"
          name="imei"
          value={formData.imei}
          onChange={handleChange}
          placeholder="e.g., 123456789012345"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="status">Status:</label>
        <select
          id="status"
          name="status"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <button type="submit" className="btn btn-primary">
        ➕ Add Device
      </button>
    </form>
  );
};

export default DeviceForm;
