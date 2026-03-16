-- Enhanced GNS Fleet Management Database Schema

-- Users table (enhanced)
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer', 'driver')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device groups
CREATE TABLE IF NOT EXISTS device_groups (
    group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#4A90E2',
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices table (enhanced)
CREATE TABLE IF NOT EXISTS devices (
    device_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    device_name VARCHAR(100) NOT NULL,
    imei VARCHAR(20) UNIQUE,
    model VARCHAR(100),
    sim_number VARCHAR(30),
    group_id INT REFERENCES device_groups(group_id),
    assigned_driver_id INT REFERENCES users(user_id),
    speed_limit INT DEFAULT 120,
    fuel_capacity DECIMAL(6,2),
    odometer_km DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPS data (enhanced)
CREATE TABLE IF NOT EXISTS gps_data (
    gps_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DECIMAL(6,2) DEFAULT 0,
    heading DECIMAL(5,2) DEFAULT 0,
    altitude DECIMAL(8,2) DEFAULT 0,
    satellites INT DEFAULT 0,
    accuracy DECIMAL(6,2) DEFAULT 0,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gps_device_time ON gps_data(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_data(timestamp DESC);

-- Telemetry (enhanced)
CREATE TABLE IF NOT EXISTS telemetry (
    telemetry_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, timestamp DESC);

-- Device sensors
CREATE TABLE IF NOT EXISTS device_sensors (
    sensor_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    sensor_type VARCHAR(50) NOT NULL,
    value DECIMAL(10,4),
    unit VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sensors_device_time ON device_sensors(device_id, recorded_at DESC);

-- Device commands (enhanced)
CREATE TABLE IF NOT EXISTS device_commands (
    command_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    command VARCHAR(255) NOT NULL,
    parameters JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'executed', 'failed')),
    issued_by INT REFERENCES users(user_id),
    response TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
    rule_id SERIAL PRIMARY KEY,
    device_id INT REFERENCES devices(device_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(10,4),
    threshold_unit VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    recipients JSONB,
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    alert_id SERIAL PRIMARY KEY,
    device_id INT REFERENCES devices(device_id) ON DELETE CASCADE,
    rule_id INT REFERENCES alert_rules(rule_id),
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'low', 'warning', 'medium', 'high', 'critical')),
    data JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by INT REFERENCES users(user_id),
    acknowledged_at TIMESTAMP,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_device_time ON alert_history(device_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alert_history(alert_type);

-- Geofences
CREATE TABLE IF NOT EXISTS geofences (
    geofence_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    geofence_type VARCHAR(20) NOT NULL CHECK (geofence_type IN ('circle', 'polygon', 'route')),
    coordinates JSONB NOT NULL,
    radius DECIMAL(10,2),
    color VARCHAR(20) DEFAULT '#FF6B6B',
    is_active BOOLEAN DEFAULT true,
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Geofence assignments
CREATE TABLE IF NOT EXISTS geofence_assignments (
    assignment_id SERIAL PRIMARY KEY,
    geofence_id INT NOT NULL REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    alert_on_enter BOOLEAN DEFAULT true,
    alert_on_exit BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(geofence_id, device_id)
);

-- Geofence events
CREATE TABLE IF NOT EXISTS geofence_events (
    event_id SERIAL PRIMARY KEY,
    geofence_id INT NOT NULL REFERENCES geofences(geofence_id) ON DELETE CASCADE,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('enter', 'exit')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_time ON geofence_events(event_time DESC);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
    trip_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    driver_id INT REFERENCES users(user_id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    start_latitude DOUBLE PRECISION,
    start_longitude DOUBLE PRECISION,
    end_latitude DOUBLE PRECISION,
    end_longitude DOUBLE PRECISION,
    distance_km DECIMAL(10,3) DEFAULT 0,
    duration_minutes INT DEFAULT 0,
    avg_speed DECIMAL(6,2) DEFAULT 0,
    max_speed DECIMAL(6,2) DEFAULT 0,
    idle_time_minutes INT DEFAULT 0,
    fuel_consumed DECIMAL(8,3),
    harsh_events INT DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_device_time ON trips(device_id, start_time DESC);

-- Driver behavior events
CREATE TABLE IF NOT EXISTS driver_behavior (
    behavior_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    driver_id INT REFERENCES users(user_id),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    speed DECIMAL(6,2),
    g_force DECIMAL(5,3),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_behavior_driver_time ON driver_behavior(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_device_time ON driver_behavior(device_id, recorded_at DESC);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_time ON notifications(user_id, created_at DESC);

-- Maintenance schedule
CREATE TABLE IF NOT EXISTS maintenance_schedule (
    maintenance_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    maintenance_type VARCHAR(100) NOT NULL,
    scheduled_date DATE,
    scheduled_km DECIMAL(10,2),
    completed_date DATE,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fuel readings
CREATE TABLE IF NOT EXISTS fuel_readings (
    reading_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    fuel_level DECIMAL(5,2),
    fuel_consumed DECIMAL(8,3),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
