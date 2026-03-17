-- SimControl Integration Tables
-- Run this migration to add SIM management support to GNS

-- SIMDevice: links a GNS device to a SimControl SIM
CREATE TABLE IF NOT EXISTS sim_devices (
    id              SERIAL PRIMARY KEY,
    device_id       INTEGER NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    sim_control_id  VARCHAR(128) NOT NULL UNIQUE,  -- external SIM ID from SimControl
    phone_number    VARCHAR(32),
    iccid           VARCHAR(22),
    imsi            VARCHAR(16),
    last_synced     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_devices_device_id ON sim_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_sim_devices_sim_control_id ON sim_devices(sim_control_id);

-- SIMMetrics: caches SIM data fetched from SimControl
CREATE TABLE IF NOT EXISTS sim_metrics (
    id              SERIAL PRIMARY KEY,
    sim_device_id   INTEGER NOT NULL REFERENCES sim_devices(id) ON DELETE CASCADE,
    data_used_mb    NUMERIC(10, 2) DEFAULT 0,
    data_limit_mb   NUMERIC(10, 2),
    balance         NUMERIC(10, 2),
    signal_strength INTEGER,        -- e.g. 0-100 percent or RSSI value
    status          VARCHAR(32),    -- active, suspended, dormant, etc.
    operator        VARCHAR(64),
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_metrics_sim_device_id ON sim_metrics(sim_device_id);
CREATE INDEX IF NOT EXISTS idx_sim_metrics_timestamp ON sim_metrics(timestamp DESC);
