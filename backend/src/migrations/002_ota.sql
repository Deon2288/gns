-- OTA Firmware Update System Migration

-- Firmware versions table
CREATE TYPE upload_status_enum AS ENUM ('uploading', 'uploaded', 'verified', 'failed');

CREATE TABLE IF NOT EXISTS firmware_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL UNIQUE,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  changelog TEXT,
  device_type VARCHAR(100),
  compatible_devices TEXT[],
  min_version VARCHAR(50),
  max_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(user_id),
  upload_status upload_status_enum DEFAULT 'uploading'
);

-- OTA update status enum
CREATE TYPE ota_status_enum AS ENUM (
  'pending', 'scheduled', 'downloading', 'installing',
  'completed', 'failed', 'cancelled', 'rolled_back'
);

-- OTA updates table
CREATE TABLE IF NOT EXISTS ota_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(device_id),
  firmware_id UUID REFERENCES firmware_versions(id),
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status ota_status_enum DEFAULT 'pending',
  progress_percentage INTEGER DEFAULT 0,
  current_step VARCHAR(100),
  error_message TEXT,
  previous_firmware_id UUID REFERENCES firmware_versions(id),
  rollback_available BOOLEAN DEFAULT true,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTA update log level enum
CREATE TYPE log_level_enum AS ENUM ('info', 'warning', 'error');

-- OTA update logs table
CREATE TABLE IF NOT EXISTS ota_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID REFERENCES ota_updates(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  level log_level_enum DEFAULT 'info',
  message TEXT,
  device_response JSONB
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_ota_updates_device_id ON ota_updates(device_id);
CREATE INDEX IF NOT EXISTS idx_ota_updates_status ON ota_updates(status);
CREATE INDEX IF NOT EXISTS idx_ota_update_logs_update_id ON ota_update_logs(update_id);
