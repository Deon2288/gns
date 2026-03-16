export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'driver' | 'viewer';
}

export interface Device {
  device_id: number;
  device_name: string;
  imei?: string;
  model?: string;
  group_name?: string;
  description?: string;
  status: 'online' | 'offline' | 'idle';
  latitude?: number;
  longitude?: number;
  speed?: number;
  altitude?: number;
  heading?: number;
  last_seen?: string;
  ignition?: boolean;
  fuel_level?: number;
  created_at: string;
}

export interface GpsPoint {
  gps_id: number;
  device_id: number;
  latitude: number;
  longitude: number;
  speed: number;
  altitude: number;
  heading: number;
  accuracy: number;
  ignition: boolean;
  fuel_level?: number;
  odometer?: number;
  satellites: number;
  timestamp: string;
}

export type AlertType = 'geofence' | 'speed' | 'harsh_driving' | 'engine_on' | 'engine_off' | 'fuel_level' | 'temperature' | 'offline' | 'sos' | 'custom';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  alert_id: number;
  device_id: number;
  device_name?: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledged_at?: string;
  triggered_at: string;
}

export interface Geofence {
  geofence_id: number;
  name: string;
  description?: string;
  shape_type: 'circle' | 'polygon';
  center_lat?: number;
  center_lon?: number;
  radius_meters?: number;
  polygon_coords?: [number, number][];
  speed_limit?: number;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  active: boolean;
  created_at: string;
}

export interface GeofenceEvent {
  event_id: number;
  geofence_id: number;
  device_id: number;
  device_name?: string;
  event_type: 'entry' | 'exit';
  latitude?: number;
  longitude?: number;
  occurred_at: string;
}

export interface Trip {
  trip_id: number;
  device_id: number;
  device_name?: string;
  driver_id?: number;
  status: 'active' | 'completed' | 'cancelled';
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  start_lat?: number;
  start_lon?: number;
  end_lat?: number;
  end_lon?: number;
  distance_km: number;
  fuel_used: number;
  max_speed: number;
  avg_speed: number;
  idle_time_seconds: number;
}

export interface TripWaypoint {
  waypoint_id: number;
  trip_id: number;
  latitude: number;
  longitude: number;
  speed: number;
  altitude: number;
  heading: number;
  recorded_at: string;
}

export interface DriverScore {
  score_id: number;
  user_id: number;
  username?: string;
  email?: string;
  safety_score: number;
  events_last_30d: number;
  updated_at: string;
}

export interface BehaviorEvent {
  event_id: number;
  device_id: number;
  device_name?: string;
  driver_id?: number;
  event_type: 'harsh_acceleration' | 'harsh_braking' | 'harsh_cornering' | 'speeding' | 'excessive_idling' | 'seatbelt' | 'phone_usage';
  severity: AlertSeverity;
  value?: number;
  latitude?: number;
  longitude?: number;
  occurred_at: string;
}

export interface DeviceCommand {
  command_id: number;
  device_id: number;
  device_name?: string;
  command: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  issued_by?: number;
  response?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardKPIs {
  devices: { total: number; online: number };
  alerts: { total: number; unacknowledged: number };
  trips: { total: number; total_km: number; total_fuel: number };
  drivers: { avg_score: number };
}

export interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
}
