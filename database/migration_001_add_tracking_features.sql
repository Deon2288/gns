-- Migration: Add alerts, geofences, and trips tables

-- Geofence zones
CREATE TABLE IF NOT EXISTS geofences (
    geofence_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    radius_km DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device-geofence association (which devices are monitored for a zone)
CREATE TABLE IF NOT EXISTS geofence_devices (
    geofence_id INT NOT NULL REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    PRIMARY KEY (geofence_id, device_id)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,           -- 'speed', 'offline', 'battery', 'geofence_enter', 'geofence_exit', 'harsh_acceleration', 'harsh_braking'
    severity VARCHAR(20) NOT NULL DEFAULT 'info',  -- 'info', 'warning', 'critical'
    message TEXT NOT NULL,
    geofence_id INT REFERENCES geofences(geofence_id) ON DELETE SET NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    trip_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
    duration_minutes DOUBLE PRECISION NOT NULL DEFAULT 0,
    average_speed DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_speed DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip waypoints (GPS points that make up a trip)
CREATE TABLE IF NOT EXISTS trip_waypoints (
    waypoint_id SERIAL PRIMARY KEY,
    trip_id INT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION NOT NULL DEFAULT 0,
    altitude DOUBLE PRECISION NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_device_id ON trips(device_id);
CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);
CREATE INDEX IF NOT EXISTS idx_trip_waypoints_trip_id ON trip_waypoints(trip_id);
CREATE INDEX IF NOT EXISTS idx_gps_data_device_timestamp ON gps_data(device_id, timestamp);

-- Add speed and altitude columns to gps_data if they don't exist
ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS speed DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE gps_data ADD COLUMN IF NOT EXISTS altitude DOUBLE PRECISION NOT NULL DEFAULT 0;
