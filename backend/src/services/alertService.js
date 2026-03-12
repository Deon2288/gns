// Default speed limit in km/h
const DEFAULT_SPEED_LIMIT = 120;

// Device-specific speed limits (device_id -> km/h)
const deviceSpeedLimits = new Map();

// Offline threshold in milliseconds (5 minutes)
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Checks if a device is exceeding the speed limit.
 * @param {string|number} deviceId
 * @param {number} speed - Current speed in km/h
 * @returns {object|null} Alert object or null
 */
function checkSpeedAlert(deviceId, speed) {
    if (speed === undefined || speed === null) return null;
    const limit = deviceSpeedLimits.get(String(deviceId)) || DEFAULT_SPEED_LIMIT;
    if (speed > limit) {
        return {
            device_id: deviceId,
            type: 'speed',
            severity: speed > limit * 1.2 ? 'critical' : 'warning',
            message: `Speed limit exceeded: ${speed} km/h (limit: ${limit} km/h)`,
            acknowledged: false,
            created_at: new Date().toISOString(),
        };
    }
    return null;
}

/**
 * Checks if a device appears to be offline.
 * @param {string|number} deviceId
 * @param {string} lastUpdate - ISO timestamp of the last GPS update
 * @returns {object|null} Alert object or null
 */
function checkOfflineAlert(deviceId, lastUpdate) {
    if (!lastUpdate) return null;
    const elapsed = Date.now() - new Date(lastUpdate).getTime();
    if (elapsed > OFFLINE_THRESHOLD_MS) {
        const minutes = Math.round(elapsed / 60000);
        return {
            device_id: deviceId,
            type: 'offline',
            severity: 'warning',
            message: `Device has been offline for ${minutes} minutes`,
            acknowledged: false,
            created_at: new Date().toISOString(),
        };
    }
    return null;
}

/**
 * Checks if a device has low battery.
 * @param {string|number} deviceId
 * @param {number} batteryLevel - Battery percentage (0-100)
 * @returns {object|null} Alert object or null
 */
function checkBatteryAlert(deviceId, batteryLevel) {
    if (batteryLevel === undefined || batteryLevel === null) return null;
    if (batteryLevel < 20) {
        return {
            device_id: deviceId,
            type: 'battery',
            severity: batteryLevel < 10 ? 'critical' : 'warning',
            message: `Low battery: ${batteryLevel}%`,
            acknowledged: false,
            created_at: new Date().toISOString(),
        };
    }
    return null;
}

/**
 * Checks for harsh acceleration or braking.
 * @param {string|number} deviceId
 * @param {number} previousSpeed - Previous speed in km/h
 * @param {number} currentSpeed - Current speed in km/h
 * @param {number} intervalSeconds - Time elapsed in seconds
 * @returns {object|null} Alert object or null
 */
function checkHarshDrivingAlert(deviceId, previousSpeed, currentSpeed, intervalSeconds) {
    if (intervalSeconds <= 0 || previousSpeed === undefined || currentSpeed === undefined) return null;
    const acceleration = Math.abs(currentSpeed - previousSpeed) / intervalSeconds;
    const threshold = 8; // km/h per second
    if (acceleration > threshold) {
        const type = currentSpeed > previousSpeed ? 'harsh_acceleration' : 'harsh_braking';
        return {
            device_id: deviceId,
            type,
            severity: 'warning',
            message: `${type === 'harsh_acceleration' ? 'Harsh acceleration' : 'Harsh braking'} detected`,
            acknowledged: false,
            created_at: new Date().toISOString(),
        };
    }
    return null;
}

/**
 * Checks geofence boundary — placeholder for geofence logic.
 * Full implementation requires registered geofence zones.
 * @param {string|number} deviceId
 * @param {number} latitude
 * @param {number} longitude
 * @returns {object|null} Alert object or null
 */
function checkGeofenceAlert(deviceId, latitude, longitude) {
    // Geofence zones are managed by geoService
    const { checkGeofences } = require('./geoService');
    return checkGeofences(deviceId, latitude, longitude);
}

/**
 * Sets a custom speed limit for a device.
 * @param {string|number} deviceId
 * @param {number} limit - Speed limit in km/h
 */
function setDeviceSpeedLimit(deviceId, limit) {
    deviceSpeedLimits.set(String(deviceId), limit);
}

module.exports = {
    checkSpeedAlert,
    checkOfflineAlert,
    checkBatteryAlert,
    checkHarshDrivingAlert,
    checkGeofenceAlert,
    setDeviceSpeedLimit,
};
