#!/bin/bash

echo "======================================"
echo "🔧 INITIALIZING DATABASE"
echo "======================================"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 5

# Create tables
echo "Creating database tables..."
docker exec gns-postgres psql -U gns_user -d gns_database << SQL
-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100),
    ip_address INET,
    status VARCHAR(50) DEFAULT 'active',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPS data table
CREATE TABLE IF NOT EXISTS gps_data (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id),
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
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id),
    alert_type VARCHAR(100),
    message TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id),
    distance_traveled DECIMAL(10, 2),
    duration_minutes INTEGER,
    average_speed DECIMAL(10, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_gps_device_id ON gps_data(device_id);
CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- Insert sample device
INSERT INTO devices (name, device_type, ip_address, status, latitude, longitude)
VALUES ('Sample Device', 'GPS Tracker', '192.168.1.100', 'active', -33.9249, 18.6242)
ON CONFLICT DO NOTHING;

SELECT 'Database initialized successfully!' AS status;
SQL

echo ""
echo "✅ Database initialized!"
