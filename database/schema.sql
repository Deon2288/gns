-- GNS Fleet Management Database Schema

-- Users with roles
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'driver', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
    device_id SERIAL PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    imei VARCHAR(20) UNIQUE,
    model VARCHAR(100),
    group_name VARCHAR(100),
    description TEXT,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'idle')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPS data points
CREATE TABLE IF NOT EXISTS gps_data (
    gps_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    altitude DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    accuracy DOUBLE PRECISION DEFAULT 0,
    ignition BOOLEAN DEFAULT false,
    fuel_level DOUBLE PRECISION,
    odometer DOUBLE PRECISION,
    satellites INT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gps_device_time ON gps_data(device_id, timestamp DESC);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    device_id INT REFERENCES devices(device_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('geofence','speed','harsh_driving','engine_on','engine_off','fuel_level','temperature','offline','sos','custom')),
    severity VARCHAR(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical','warning','info')),
    message TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,
    acknowledged_by INT REFERENCES users(user_id),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged, triggered_at DESC);

-- Geofences
CREATE TABLE IF NOT EXISTS geofences (
    geofence_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    shape_type VARCHAR(20) NOT NULL CHECK (shape_type IN ('circle','polygon')),
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION,
    polygon_coords JSONB,
    speed_limit DOUBLE PRECISION,
    alert_on_entry BOOLEAN DEFAULT true,
    alert_on_exit BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geofence events
CREATE TABLE IF NOT EXISTS geofence_events (
    event_id SERIAL PRIMARY KEY,
    geofence_id INT NOT NULL REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entry','exit')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_geofence_events ON geofence_events(geofence_id, device_id, occurred_at DESC);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
    trip_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    driver_id INT REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INT,
    start_lat DOUBLE PRECISION,
    start_lon DOUBLE PRECISION,
    end_lat DOUBLE PRECISION,
    end_lon DOUBLE PRECISION,
    distance_km DOUBLE PRECISION DEFAULT 0,
    fuel_used DOUBLE PRECISION DEFAULT 0,
    max_speed DOUBLE PRECISION DEFAULT 0,
    avg_speed DOUBLE PRECISION DEFAULT 0,
    idle_time_seconds INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_trips_device ON trips(device_id, start_time DESC);

-- Trip waypoints
CREATE TABLE IF NOT EXISTS trip_waypoints (
    waypoint_id SERIAL PRIMARY KEY,
    trip_id INT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0,
    altitude DOUBLE PRECISION DEFAULT 0,
    heading DOUBLE PRECISION DEFAULT 0,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_waypoints_trip ON trip_waypoints(trip_id, recorded_at);

-- Driver behavior events
CREATE TABLE IF NOT EXISTS behavior_events (
    event_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    driver_id INT REFERENCES users(user_id),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('harsh_acceleration','harsh_braking','harsh_cornering','speeding','excessive_idling','seatbelt','phone_usage')),
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('critical','warning','info')),
    value DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_behavior_driver ON behavior_events(driver_id, occurred_at DESC);

-- Driver scores
CREATE TABLE IF NOT EXISTS driver_scores (
    score_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    safety_score INT DEFAULT 100 CHECK (safety_score BETWEEN 0 AND 100),
    events_last_30d INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device command queue
CREATE TABLE IF NOT EXISTS device_command_queue (
    command_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    command VARCHAR(50) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','acknowledged','completed','failed')),
    issued_by INT REFERENCES users(user_id),
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telemetry (extended)
CREATE TABLE IF NOT EXISTS telemetry (
    telemetry_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_telemetry_device ON telemetry(device_id, timestamp DESC);