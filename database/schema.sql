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

-- PostgreSQL NOTIFY trigger: fires after each INSERT into gps_data and
-- sends the new record as a JSON payload on the "gps_update" channel.
-- The WebSocket server (backend/src/websocket-server.js) listens on this
-- channel and broadcasts the payload to all connected WebSocket clients.
CREATE OR REPLACE FUNCTION notify_gps_update()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'gps_update',
        json_build_object(
            'device_id', NEW.device_id,
            'latitude',  NEW.latitude,
            'longitude', NEW.longitude,
            'timestamp', NEW.timestamp
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gps_data_insert_trigger
AFTER INSERT ON gps_data
FOR EACH ROW EXECUTE FUNCTION notify_gps_update();