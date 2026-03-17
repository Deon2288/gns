-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced devices table
CREATE TABLE IF NOT EXISTS devices (
    device_id SERIAL PRIMARY KEY,
    user_id INT,
    device_name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    mac_address VARCHAR(17),
    model VARCHAR(100) DEFAULT 'Unknown',
    firmware VARCHAR(100),
    device_type VARCHAR(50) DEFAULT 'unknown',
    snmp_community VARCHAR(100) DEFAULT 'public',
    snmp_version VARCHAR(10) DEFAULT 'v2c',
    status VARCHAR(20) DEFAULT 'unknown',
    last_seen TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    location VARCHAR(255),
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- GPS data table
CREATE TABLE IF NOT EXISTS gps_data (
    gps_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Telemetry table
CREATE TABLE IF NOT EXISTS telemetry (
    telemetry_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    data JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Device commands table
CREATE TABLE IF NOT EXISTS device_commands (
    command_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    command VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- SNMP metrics table
CREATE TABLE IF NOT EXISTS snmp_metrics (
    metric_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    value DOUBLE PRECISION,
    raw_value TEXT,
    unit VARCHAR(20),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Discovery scans table
CREATE TABLE IF NOT EXISTS discovery_scans (
    scan_id VARCHAR(36) PRIMARY KEY,
    ip_range VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_hosts INT DEFAULT 0,
    discovered_count INT DEFAULT 0,
    results JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Device alerts table
CREATE TABLE IF NOT EXISTS device_alerts (
    alert_id SERIAL PRIMARY KEY,
    device_id INT,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_snmp_metrics_device_timestamp ON snmp_metrics(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_alerts_device ON device_alerts(device_id, is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_data_device_timestamp ON gps_data(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip_address);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
