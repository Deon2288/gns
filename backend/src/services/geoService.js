// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

// Registered geofence zones: { id, name, centerLat, centerLng, radiusKm, deviceIds? }
const geofenceZones = [];
let geofenceIdCounter = 1;

// Track whether a device was last inside each geofence
const deviceGeofenceState = new Map(); // key: `${deviceId}:${geofenceId}` -> boolean (inside)

/**
 * Calculates the great-circle distance between two GPS coordinates (Haversine formula).
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

/**
 * Converts degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Calculates the average speed from an array of speeds.
 * @param {number[]} speeds - Array of speed values in km/h
 * @returns {number} Average speed in km/h
 */
function calculateAverageSpeed(speeds) {
    if (!speeds || speeds.length === 0) return 0;
    return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

/**
 * Checks if a point is inside a circular geofence zone.
 * @param {number} lat
 * @param {number} lon
 * @param {object} zone - { centerLat, centerLng, radiusKm }
 * @returns {boolean}
 */
function isInsideGeofence(lat, lon, zone) {
    const distance = calculateDistance(lat, lon, zone.centerLat, zone.centerLng);
    return distance <= zone.radiusKm;
}

/**
 * Checks all geofences for a device and returns an alert if a boundary was crossed.
 * @param {string|number} deviceId
 * @param {number} latitude
 * @param {number} longitude
 * @returns {object|null} Alert object or null
 */
function checkGeofences(deviceId, latitude, longitude) {
    for (const zone of geofenceZones) {
        if (zone.deviceIds && zone.deviceIds.length > 0 && !zone.deviceIds.includes(String(deviceId))) {
            continue;
        }

        const stateKey = `${deviceId}:${zone.id}`;
        const wasInside = deviceGeofenceState.get(stateKey) || false;
        const isInside = isInsideGeofence(latitude, longitude, zone);

        deviceGeofenceState.set(stateKey, isInside);

        if (!wasInside && isInside) {
            return {
                device_id: deviceId,
                type: 'geofence_enter',
                severity: 'info',
                message: `Device entered geofence zone: ${zone.name}`,
                geofence_id: zone.id,
                acknowledged: false,
                created_at: new Date().toISOString(),
            };
        }
        if (wasInside && !isInside) {
            return {
                device_id: deviceId,
                type: 'geofence_exit',
                severity: 'info',
                message: `Device exited geofence zone: ${zone.name}`,
                geofence_id: zone.id,
                acknowledged: false,
                created_at: new Date().toISOString(),
            };
        }
    }
    return null;
}

/**
 * Registers a new geofence zone.
 * @param {string} name
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusKm
 * @param {string[]} [deviceIds] - Optional list of device IDs to monitor
 * @returns {object} The created geofence zone
 */
function addGeofenceZone(name, centerLat, centerLng, radiusKm, deviceIds) {
    const zone = {
        id: geofenceIdCounter++,
        name,
        centerLat,
        centerLng,
        radiusKm,
        deviceIds: deviceIds ? deviceIds.map(String) : [],
        created_at: new Date().toISOString(),
    };
    geofenceZones.push(zone);
    return zone;
}

/**
 * Removes a geofence zone by ID.
 * @param {number} id
 * @returns {boolean} True if removed, false if not found
 */
function removeGeofenceZone(id) {
    const index = geofenceZones.findIndex(z => z.id === id);
    if (index === -1) return false;
    geofenceZones.splice(index, 1);
    return true;
}

/**
 * Returns all registered geofence zones.
 * @returns {object[]}
 */
function getGeofenceZones() {
    return [...geofenceZones];
}

module.exports = {
    calculateDistance,
    calculateAverageSpeed,
    isInsideGeofence,
    checkGeofences,
    addGeofenceZone,
    removeGeofenceZone,
    getGeofenceZones,
};
