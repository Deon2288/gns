import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const auth = {
  login: (username: string, password: string) =>
    api.post('/api/users/login', { username, password }).then((r) => r.data),
  register: (data: { username: string; email: string; password: string; full_name: string; role: string }) =>
    api.post('/api/users/register', data).then((r) => r.data),
  getMe: () => api.get('/api/users/me').then((r) => r.data),
};

export const devices = {
  getAll: () => api.get('/api/devices').then((r) => r.data),
  getById: (id: number) => api.get(`/api/devices/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/api/devices', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/api/devices/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/devices/${id}`).then((r) => r.data),
};

export const gps = {
  getHistory: (deviceId: number, params?: { from?: string; to?: string; limit?: number }) =>
    api.get(`/api/gps/${deviceId}/history`, { params }).then((r) => r.data),
  getAllLatest: () => api.get('/api/gps/all/latest').then((r) => r.data),
};

export const alerts = {
  getRules: () => api.get('/api/alerts/rules').then((r) => r.data),
  createRule: (data: any) => api.post('/api/alerts/rules', data).then((r) => r.data),
  updateRule: (id: number, data: any) => api.put(`/api/alerts/rules/${id}`, data).then((r) => r.data),
  deleteRule: (id: number) => api.delete(`/api/alerts/rules/${id}`).then((r) => r.data),
  getHistory: (params?: any) => api.get('/api/alerts/history', { params }).then((r) => r.data),
  acknowledgeAlert: (id: number) => api.put(`/api/alerts/history/${id}/acknowledge`).then((r) => r.data),
  getSummary: () => api.get('/api/alerts/summary').then((r) => r.data),
};

export const geofences = {
  getAll: () => api.get('/api/geofences').then((r) => r.data),
  getById: (id: number) => api.get(`/api/geofences/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/api/geofences', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/api/geofences/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/geofences/${id}`).then((r) => r.data),
  assign: (id: number, data: { device_id: number; alert_on_enter: boolean; alert_on_exit: boolean }) =>
    api.post(`/api/geofences/${id}/assign`, data).then((r) => r.data),
};

export const trips = {
  getAll: (params?: any) => api.get('/api/trips', { params }).then((r) => r.data),
  getById: (id: number) => api.get(`/api/trips/${id}`).then((r) => r.data),
  startTrip: (data: { device_id: number; driver_id?: number }) =>
    api.post('/api/trips/start', data).then((r) => r.data),
  endTrip: (id: number) => api.put(`/api/trips/${id}/end`).then((r) => r.data),
};

export const driverBehavior = {
  getEvents: (params?: any) => api.get('/api/driver-behavior', { params }).then((r) => r.data),
  getScore: (deviceId: number) =>
    api.get(`/api/driver-behavior/score/${deviceId}`).then((r) => r.data),
};

export const reports = {
  getTripsReport: (params?: any) => api.get('/api/reports/trips', { params }).then((r) => r.data),
  getDriverBehaviorReport: (params?: any) =>
    api.get('/api/reports/driver-behavior', { params }).then((r) => r.data),
  getFuelReport: (params?: any) => api.get('/api/reports/fuel', { params }).then((r) => r.data),
};

export const deviceGroups = {
  getAll: () => api.get('/api/device-groups').then((r) => r.data),
  create: (data: any) => api.post('/api/device-groups', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/api/device-groups/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/device-groups/${id}`).then((r) => r.data),
};

export const notifications = {
  getAll: () => api.get('/api/notifications').then((r) => r.data),
  markRead: (id: number) => api.put(`/api/notifications/${id}/read`).then((r) => r.data),
  getUnreadCount: () => api.get('/api/notifications/unread-count').then((r) => r.data),
};

export default api;
