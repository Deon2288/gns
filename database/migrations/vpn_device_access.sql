-- VPN Bridge & Device Access System Migration
-- Creates tables for VPN management, ICMP ping, SNMP monitoring, and audit logging

-- VPN Bridge connection configuration and status
CREATE TABLE IF NOT EXISTS vpn_bridge_connections (
    vpn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_name VARCHAR(100) NOT NULL,
    vpn_type VARCHAR(20) NOT NULL DEFAULT 'openvpn',  -- openvpn, wireguard, ipsec
    core_host VARCHAR(255) NOT NULL,
    core_port INT NOT NULL DEFAULT 1194,
    protocol VARCHAR(10) NOT NULL DEFAULT 'udp',      -- tcp, udp
    auth_method VARCHAR(30) NOT NULL DEFAULT 'certificate',  -- certificate, preshared-key
    ca_cert_path VARCHAR(500),
    client_cert_path VARCHAR(500),
    client_key_path VARCHAR(500),
    tls_key_path VARCHAR(500),
    vpn_subnet VARCHAR(50),
    gns_vpn_ip VARCHAR(45),
    core_vpn_ip VARCHAR(45),
    device_subnet VARCHAR(50),
    routes JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'disconnected',        -- connected, disconnected, error
    vpn_ip VARCHAR(45),
    uptime_seconds BIGINT DEFAULT 0,
    bandwidth_up_mb NUMERIC(12, 2) DEFAULT 0,
    bandwidth_down_mb NUMERIC(12, 2) DEFAULT 0,
    current_rate_mbps NUMERIC(8, 2) DEFAULT 0,
    latency_ms INT,
    packet_loss_percent NUMERIC(5, 2),
    connection_quality VARCHAR(20),                   -- excellent, good, fair, poor
    last_reconnect TIMESTAMP,
    last_connected TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VPN event logs
CREATE TABLE IF NOT EXISTS vpn_bridge_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vpn_id UUID REFERENCES vpn_bridge_connections(vpn_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,                  -- connected, disconnected, error, reconnect
    vpn_ip VARCHAR(45),
    core_ip VARCHAR(45),
    bandwidth_up NUMERIC(12, 2),
    bandwidth_down NUMERIC(12, 2),
    latency_ms INT,
    status VARCHAR(20),
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ICMP ping configuration
CREATE TABLE IF NOT EXISTS ping_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT TRUE,
    method VARCHAR(20) DEFAULT 'icmp',               -- icmp, tcp-syn, udp
    interval_seconds INT DEFAULT 60,
    timeout_ms INT DEFAULT 5000,
    packet_size INT DEFAULT 56,
    ttl INT DEFAULT 64,
    parallel_pings INT DEFAULT 10,
    alert_on_timeout BOOLEAN DEFAULT TRUE,
    alert_threshold INT DEFAULT 3,
    packet_loss_alert BOOLEAN DEFAULT TRUE,
    packet_loss_threshold NUMERIC(5, 2) DEFAULT 10,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual ICMP ping results
CREATE TABLE IF NOT EXISTS icmp_ping_results (
    ping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id INT REFERENCES devices(device_id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL,                     -- reachable, unreachable, timeout
    latency_ms INT,
    packet_loss_percent NUMERIC(5, 2),
    packets_sent INT,
    packets_received INT,
    min_latency INT,
    max_latency INT,
    avg_latency INT,
    stddev_latency NUMERIC(8, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-device reachability state
CREATE TABLE IF NOT EXISTS device_reachability (
    reachability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id INT UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'unknown',            -- online, offline, degraded, unknown
    last_ping TIMESTAMP,
    last_successful_ping TIMESTAMP,
    consecutive_failures INT DEFAULT 0,
    uptime_percentage NUMERIC(5, 2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SNMP global configuration
CREATE TABLE IF NOT EXISTS snmp_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT TRUE,
    version VARCHAR(5) DEFAULT '2c',                 -- 1, 2c, 3
    community_string VARCHAR(100) DEFAULT 'public',
    timeout_ms INT DEFAULT 5000,
    retries INT DEFAULT 3,
    port INT DEFAULT 161,
    poll_interval_seconds INT DEFAULT 300,
    parallel_queries INT DEFAULT 10,
    security_level VARCHAR(30) DEFAULT 'noAuthNoPriv',
    auth_protocol VARCHAR(10) DEFAULT 'md5',         -- md5, sha
    priv_protocol VARCHAR(10) DEFAULT 'des',         -- des, 3des, aes
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SNMP query history
CREATE TABLE IF NOT EXISTS snmp_queries (
    query_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id INT REFERENCES devices(device_id) ON DELETE CASCADE,
    oid VARCHAR(200) NOT NULL,
    query_type VARCHAR(20) NOT NULL DEFAULT 'get',   -- get, walk, bulk
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SNMP query results
CREATE TABLE IF NOT EXISTS snmp_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES snmp_queries(query_id) ON DELETE CASCADE,
    oid VARCHAR(200) NOT NULL,
    value TEXT,
    value_type VARCHAR(20),                          -- STRING, INTEGER, OBJECT, BITS, etc.
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cached SNMP metadata per device
CREATE TABLE IF NOT EXISTS device_snmp_metadata (
    metadata_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id INT UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    snmp_name VARCHAR(255),
    snmp_description TEXT,
    snmp_location VARCHAR(255),
    snmp_contact VARCHAR(255),
    sys_uptime_seconds BIGINT,
    last_query TIMESTAMP,
    query_success_rate NUMERIC(5, 2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for all device access operations
CREATE TABLE IF NOT EXISTS device_access_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_type VARCHAR(20) NOT NULL,                -- ping, snmp_query, command
    device_id INT REFERENCES devices(device_id) ON DELETE SET NULL,
    source_ip VARCHAR(45),
    status VARCHAR(20) NOT NULL,                     -- success, timeout, error
    response_time_ms INT,
    error_message TEXT,
    query_details JSONB,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default ping configuration if not already present
INSERT INTO ping_config (enabled, method, interval_seconds, timeout_ms, packet_size, ttl, parallel_pings,
    alert_on_timeout, alert_threshold, packet_loss_alert, packet_loss_threshold)
SELECT TRUE, 'icmp', 60, 5000, 56, 64, 10, TRUE, 3, TRUE, 10
WHERE NOT EXISTS (SELECT 1 FROM ping_config LIMIT 1);

-- Seed default SNMP configuration if not already present
INSERT INTO snmp_config (enabled, version, community_string, timeout_ms, retries, port,
    poll_interval_seconds, parallel_queries, security_level, auth_protocol, priv_protocol)
SELECT TRUE, '2c', 'public', 5000, 3, 161, 300, 10, 'noAuthNoPriv', 'md5', 'des'
WHERE NOT EXISTS (SELECT 1 FROM snmp_config LIMIT 1);
