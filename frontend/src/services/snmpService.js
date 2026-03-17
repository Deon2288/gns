import apiClient from './authService';

export const snmpService = {
  pollMetrics: (deviceId) => apiClient.post(`/api/snmp/poll/${deviceId}`),
  getHistory: (deviceId, params) => apiClient.get(`/api/snmp/history/${deviceId}`, { params }),
  configureSNMP: (data) => apiClient.post('/api/snmp/configure', data),
};
