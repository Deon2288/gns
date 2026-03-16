CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE gps_data (
    gps_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

CREATE TABLE telemetry (
    telemetry_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    data JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

CREATE TABLE device_commands (
    command_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    command VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Device groups for organising discovered / registered devices
CREATE TABLE device_groups (
    group_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discovery system tables

CREATE TABLE device_discovery_scans (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, scheduled, continuous
    ip_range VARCHAR(100) NOT NULL,
    ports TEXT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    devices_found INT DEFAULT 0,
    devices_registered INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    created_by INT REFERENCES users(user_id),
    error_message TEXT
);

CREATE TABLE discovered_devices (
    discovered_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES device_discovery_scans(scan_id),
    ip_address INET NOT NULL,
    port INT,
    protocol VARCHAR(50), -- teltonika, nmea, ublox, http, mqtt, unknown
    manufacturer VARCHAR(100),
    device_model VARCHAR(100),
    firmware_version VARCHAR(50),
    imei VARCHAR(20),
    device_name VARCHAR(100),
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'new', -- new, registered, offline, ignored
    registered_device_id INT REFERENCES devices(device_id),
    response_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_scan_configs (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES users(user_id),
    name VARCHAR(100) NOT NULL,
    ip_ranges TEXT[], -- array of CIDR/ranges
    ports INT[],
    protocol_types TEXT[], -- which protocols to scan
    enabled BOOLEAN DEFAULT TRUE,
    scan_schedule VARCHAR(100), -- cron format
    auto_register BOOLEAN DEFAULT FALSE,
    default_group_id INT REFERENCES device_groups(group_id),
    alert_threshold_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_registration_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discovered_device_id UUID REFERENCES discovered_devices(discovered_id),
    user_id INT REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, registering, registered, failed
    device_id INT REFERENCES devices(device_id),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_discovered_devices_scan_id ON discovered_devices(scan_id);
CREATE INDEX idx_discovered_devices_ip ON discovered_devices(ip_address);
CREATE INDEX idx_discovered_devices_status ON discovered_devices(status);
CREATE INDEX idx_discovery_scans_status ON device_discovery_scans(status);
CREATE INDEX idx_registration_jobs_status ON device_registration_jobs(status);