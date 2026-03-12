const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export interface Device {
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
    speed?: number;
    status?: 'active' | 'idle' | 'offline';
    lastUpdate?: string;
}

export interface Alert {
    id: number;
    device_id: string;
    type: string;
    severity: string;
    message: string;
    acknowledged: boolean;
    created_at: string;
}

/**
 * Fetches all devices from the API.
 */
export async function fetchDevices(): Promise<Device[]> {
    const response = await fetch(`${API_BASE}/api/devices`);
    if (!response.ok) throw new Error(`Failed to fetch devices: ${response.status}`);
    return response.json();
}

/**
 * Fetches all alerts from the API.
 */
export async function fetchAlerts(deviceId?: string): Promise<Alert[]> {
    const url = deviceId
        ? `${API_BASE}/api/alerts?device_id=${encodeURIComponent(deviceId)}`
        : `${API_BASE}/api/alerts`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch alerts: ${response.status}`);
    return response.json();
}

/**
 * Acknowledges an alert.
 */
export async function acknowledgeAlert(alertId: number): Promise<Alert> {
    const response = await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, {
        method: 'PUT',
    });
    if (!response.ok) throw new Error(`Failed to acknowledge alert: ${response.status}`);
    return response.json();
}

/**
 * Fetches fleet analytics stats.
 */
export async function fetchFleetStats() {
    const response = await fetch(`${API_BASE}/api/analytics/fleet`);
    if (!response.ok) throw new Error(`Failed to fetch fleet stats: ${response.status}`);
    return response.json();
}
