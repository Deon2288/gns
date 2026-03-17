-- SimControl integration tables

CREATE TABLE IF NOT EXISTS sim_devices (
  id SERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(device_id) ON DELETE SET NULL,
  sim_control_id VARCHAR UNIQUE NOT NULL,
  phone_number VARCHAR,
  iccid VARCHAR,
  imsi VARCHAR,
  operator VARCHAR,
  status VARCHAR DEFAULT 'active',
  last_synced TIMESTAMP,
  sync_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim_metrics (
  id SERIAL PRIMARY KEY,
  sim_device_id INTEGER REFERENCES sim_devices(id) ON DELETE CASCADE,
  data_used_mb FLOAT,
  data_limit_mb FLOAT,
  balance DECIMAL(10,2),
  signal_strength INTEGER,
  operator VARCHAR,
  status VARCHAR,
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim_sync_logs (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR DEFAULT 'automatic',
  status VARCHAR,
  items_synced INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sim_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sim_devices_device_id ON sim_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_sim_devices_sim_control_id ON sim_devices(sim_control_id);
CREATE INDEX IF NOT EXISTS idx_sim_metrics_sim_device_id ON sim_metrics(sim_device_id);
CREATE INDEX IF NOT EXISTS idx_sim_sync_logs_started_at ON sim_sync_logs(started_at DESC);
