-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    device_id SERIAL PRIMARY KEY,
    user_id INTEGER,
    device_name VARCHAR(255) NOT NULL,
    imei VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPS data table
CREATE TABLE IF NOT EXISTS gps_data (
    gps_id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(device_id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    speed DECIMAL(10, 2),
    heading DECIMAL(5, 2),
    altitude DECIMAL(10, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(device_id),
    alert_type VARCHAR(100),
    message TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    analytics_id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(device_id),
    distance_traveled DECIMAL(10, 2),
    duration_minutes INTEGER,
    average_speed DECIMAL(10, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_gps_device_id ON gps_data(device_id);
CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- Insert sample data
INSERT INTO devices (user_id, device_name, imei, status, latitude, longitude)
VALUES (1, 'Sample GPS Device', '123456789012345', 'active', -33.9249, 18.6242)
ON CONFLICT (imei) DO NOTHING;

INSERT INTO alerts (device_id, alert_type, message, severity, status)
VALUES (1, 'GEOFENCE', 'Device left geofence zone', 'warning', 'active')
ON CONFLICT DO NOTHING;
