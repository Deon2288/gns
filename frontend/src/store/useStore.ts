import { create } from 'zustand';
import axios from 'axios';
import { User, Device, Alert, AlertSummary, DashboardKPIs } from '../types';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface AuthState {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

interface DeviceState {
  devices: Device[];
  fetchDevices: () => Promise<void>;
}

interface AlertState {
  alerts: Alert[];
  alertSummary: AlertSummary;
  fetchAlerts: (params?: Record<string, string>) => Promise<void>;
  fetchAlertSummary: () => Promise<void>;
  acknowledgeAlert: (id: number) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
}

interface DashboardState {
  kpis: DashboardKPIs | null;
  fetchKPIs: () => Promise<void>;
}

type AppStore = AuthState & DeviceState & AlertState & DashboardState;

export const useStore = create<AppStore>((set, get) => ({
  // Auth
  user: null,
  token: localStorage.getItem('token'),
  login: async (username, password) => {
    const { data } = await api.post('/api/users/login', { username, password });
    localStorage.setItem('token', data.token);
    set({ token: data.token, user: data.user });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },

  // Devices
  devices: [],
  fetchDevices: async () => {
    try {
      const { data } = await api.get('/api/devices');
      set({ devices: data });
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  },

  // Alerts
  alerts: [],
  alertSummary: { critical: 0, warning: 0, info: 0 },
  fetchAlerts: async (params = {}) => {
    try {
      const { data } = await api.get('/api/alerts', { params });
      set({ alerts: data });
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    }
  },
  fetchAlertSummary: async () => {
    try {
      const { data } = await api.get('/api/alerts/summary');
      set({ alertSummary: data });
    } catch (err) {
      console.error('Failed to fetch alert summary', err);
    }
  },
  acknowledgeAlert: async (id) => {
    await api.patch(`/api/alerts/${id}/acknowledge`);
    await get().fetchAlerts();
    await get().fetchAlertSummary();
  },
  acknowledgeAll: async () => {
    await api.patch('/api/alerts/acknowledge-all');
    await get().fetchAlerts();
    await get().fetchAlertSummary();
  },

  // Dashboard
  kpis: null,
  fetchKPIs: async () => {
    try {
      const { data } = await api.get('/api/analytics/dashboard');
      set({ kpis: data });
    } catch (err) {
      console.error('Failed to fetch KPIs', err);
    }
  },
}));

export { api };
