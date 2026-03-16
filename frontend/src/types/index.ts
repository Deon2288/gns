export interface User {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export interface Device {
  device_id: number;
  device_name: string;
  imei: string;
  model: string;
  status: 'online' | 'idle' | 'offline';
  last_lat: number | null;
  last_lon: number | null;
  last_speed: number | null;
  last_seen: string | null;
  group_name: string | null;
  speed_limit: number | null;
  group_id?: number | null;
  sim_number?: string | null;
}

export interface GpsPoint {
  gps_id: number;
  device_id: number;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
  altitude: number | null;
  timestamp: string;
}

export interface AlertRule {
  rule_id: number;
  device_id: number | null;
  device_name: string | null;
  alert_type: string;
  threshold_value: number | null;
  threshold_unit: string | null;
  is_active: boolean;
  recipients: string[];
}

export interface AlertHistory {
  alert_id: number;
  device_id: number | null;
  device_name: string | null;
  alert_type: string;
  message: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  acknowledged: boolean;
  triggered_at: string;
}

export interface Geofence {
  geofence_id: number;
  name: string;
  description: string | null;
  geofence_type: 'circle' | 'polygon' | 'route';
  coordinates: Array<{ lat: number; lon: number }>;
  radius: number | null;
  color: string;
  is_active: boolean;
  assigned_devices?: number[];
}

export interface Trip {
  trip_id: number;
  device_id: number;
  device_name?: string;
  start_time: string;
  end_time: string | null;
  distance_km: number | null;
  duration_minutes: number | null;
  avg_speed: number | null;
  max_speed: number | null;
  status: 'active' | 'completed';
}

export interface DriverBehavior {
  behavior_id: number;
  device_id: number;
  device_name?: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  speed: number | null;
  recorded_at: string;
}

export interface DeviceGroup {
  group_id: number;
  group_name: string;
  description: string | null;
  color: string;
  device_count: number;
}

export interface Notification {
  notification_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface AlertSummary {
  total: number;
  unacknowledged: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
}
