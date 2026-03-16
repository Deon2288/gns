CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) DEFAULT 'teltonika',
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    imei VARCHAR(20),
    serial_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP,
    group_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE gps_data (
    gps_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    course DOUBLE PRECISION,
    satellites INT,
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
    status VARCHAR(20) DEFAULT 'pending',
    response TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- ─── Auto-Discovery ──────────────────────────────────────────────────────────

CREATE TABLE device_discovery_scans (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES users(user_id),
    ip_range VARCHAR(50) NOT NULL,
    protocols TEXT[],
    status VARCHAR(20) DEFAULT 'running',
    devices_found INT DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE discovered_devices (
    discovered_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES device_discovery_scans(scan_id),
    ip VARCHAR(45) NOT NULL,
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    protocol VARCHAR(50),
    status VARCHAR(20) DEFAULT 'online',
    response_time INT,
    registration_status VARCHAR(20) DEFAULT 'pending',
    device_id INT REFERENCES devices(device_id),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registered_at TIMESTAMP
);

-- ─── Geolocation ─────────────────────────────────────────────────────────────

CREATE TABLE notification_config (
    config_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    email_on_scan_complete BOOLEAN DEFAULT TRUE,
    email_on_new_devices BOOLEAN DEFAULT TRUE,
    new_device_threshold INT DEFAULT 1,
    email_on_registration BOOLEAN DEFAULT TRUE,
    email_on_failure BOOLEAN DEFAULT TRUE,
    recipients TEXT[],
    reply_to VARCHAR(255) DEFAULT 'noreply@gns.example.com',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_logs (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    recipients TEXT[],
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP
);

-- ─── Analytics ───────────────────────────────────────────────────────────────

CREATE TABLE discovery_analytics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES device_discovery_scans(scan_id),
    metric_type VARCHAR(50) NOT NULL,
    metric_value NUMERIC,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_protocol VARCHAR(50),
    manufacturer VARCHAR(100),
    device_model VARCHAR(100),
    ip_range VARCHAR(100),
    data JSONB
);

-- ─── Continuous Monitoring ───────────────────────────────────────────────────

CREATE TABLE monitoring_config (
    config_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    enabled BOOLEAN DEFAULT FALSE,
    pull_interval INT DEFAULT 300,
    monitor_type VARCHAR(20) DEFAULT 'all',
    retry_on_failure BOOLEAN DEFAULT TRUE,
    max_retries INT DEFAULT 3,
    timeout INT DEFAULT 10000,
    parallel_checks INT DEFAULT 10,
    alert_on_status_change BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_monitoring_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id INT REFERENCES devices(device_id),
    check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20),
    response_time INT,
    uptime_percentage NUMERIC,
    error_message TEXT
);

-- ─── Device Naming Rules ─────────────────────────────────────────────────────

CREATE TABLE device_naming_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INT REFERENCES users(user_id),
    rule_name VARCHAR(100) NOT NULL,
    pattern VARCHAR(500) NOT NULL,
    variables JSONB,
    conditions JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 1,
    snmp_enabled BOOLEAN DEFAULT FALSE,
    snmp_config JSONB,
    apply_to_new_scans BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);