/**
 * Calculates the great-circle distance between two GPS points (Haversine formula).
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

export interface GpsRecord {
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    timestamp: string;
}

export interface DeviceStats {
    deviceId: string;
    status: 'active' | 'idle' | 'offline';
    totalDistance: number;
    averageSpeed: number;
    maxSpeed: number;
    totalRecords: number;
    lastUpdate?: string;
    lastPosition?: { latitude: number; longitude: number };
}

export interface FleetStats {
    totalDevices: number;
    activeDevices: number;
    idleDevices: number;
    offlineDevices: number;
    totalDistance: number;
    averageSpeed: number;
    devices: DeviceStats[];
}

/**
 * Determines a device's status based on its last GPS record.
 */
export function getDeviceStatus(lastRecord: GpsRecord | undefined): 'active' | 'idle' | 'offline' {
    if (!lastRecord) return 'offline';
    const minutesSinceUpdate = (Date.now() - new Date(lastRecord.timestamp).getTime()) / 60000;
    if (minutesSinceUpdate > 5) return 'offline';
    return lastRecord.speed > 2 ? 'active' : 'idle';
}

/**
 * Computes statistics for a single device from its GPS history.
 */
export function computeDeviceStats(deviceId: string, records: GpsRecord[]): DeviceStats {
    if (records.length === 0) {
        return { deviceId, status: 'offline', totalDistance: 0, averageSpeed: 0, maxSpeed: 0, totalRecords: 0 };
    }

    const lastRecord = records[records.length - 1];
    const status = getDeviceStatus(lastRecord);

    let totalDistance = 0;
    for (let i = 1; i < records.length; i++) {
        totalDistance += calculateDistance(
            records[i - 1].latitude, records[i - 1].longitude,
            records[i].latitude, records[i].longitude
        );
    }

    const speeds = records.map(r => r.speed || 0);
    const averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeed = Math.max(...speeds);

    return {
        deviceId,
        status,
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        maxSpeed: Math.round(maxSpeed * 100) / 100,
        totalRecords: records.length,
        lastUpdate: lastRecord.timestamp,
        lastPosition: { latitude: lastRecord.latitude, longitude: lastRecord.longitude },
    };
}

/**
 * Computes fleet-wide statistics from a map of device GPS histories.
 */
export function computeFleetStats(deviceHistories: Map<string, GpsRecord[]>): FleetStats {
    const devices: DeviceStats[] = [];
    deviceHistories.forEach((records, deviceId) => {
        devices.push(computeDeviceStats(deviceId, records));
    });

    const activeDevices = devices.filter(d => d.status === 'active').length;
    const idleDevices = devices.filter(d => d.status === 'idle').length;
    const offlineDevices = devices.filter(d => d.status === 'offline').length;
    const totalDistance = devices.reduce((sum, d) => sum + d.totalDistance, 0);
    const averageSpeed = devices.length > 0
        ? devices.reduce((sum, d) => sum + d.averageSpeed, 0) / devices.length
        : 0;

    return {
        totalDevices: devices.length,
        activeDevices,
        idleDevices,
        offlineDevices,
        totalDistance: Math.round(totalDistance * 100) / 100,
        averageSpeed: Math.round(averageSpeed * 100) / 100,
        devices,
    };
}

/**
 * Builds a speed distribution histogram for charting.
 */
export function buildSpeedDistribution(records: GpsRecord[]): { range: string; count: number }[] {
    const buckets = [
        { range: '0-20', count: 0 },
        { range: '20-40', count: 0 },
        { range: '40-60', count: 0 },
        { range: '60-80', count: 0 },
        { range: '80-100', count: 0 },
        { range: '100+', count: 0 },
    ];
    records.forEach(r => {
        const speed = r.speed || 0;
        if (speed < 20) buckets[0].count++;
        else if (speed < 40) buckets[1].count++;
        else if (speed < 60) buckets[2].count++;
        else if (speed < 80) buckets[3].count++;
        else if (speed < 100) buckets[4].count++;
        else buckets[5].count++;
    });
    return buckets;
}

/**
 * Formats a duration in minutes to a human-readable string (e.g. "1h 23m").
 */
export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
}
