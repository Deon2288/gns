import apiClient from './authService';

export const discoveryService = {
  startScan: (ipRange) => apiClient.post('/api/discovery/scan', { ipRange }),
  getScanStatus: (jobId) => apiClient.get(`/api/discovery/scan/${jobId}`),
  listDevices: (params) => apiClient.get('/api/discovery/devices', { params }),
  getDevice: (id) => apiClient.get(`/api/discovery/devices/${id}`),
  deleteDevice: (id) => apiClient.delete(`/api/discovery/devices/${id}`),
};
