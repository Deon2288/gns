import mapboxgl from 'mapbox-gl';

/**
 * Map style definitions for Mapbox GL JS.
 */
export const MAP_STYLES: Record<string, string> = {
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    streets: 'mapbox://styles/mapbox/streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};

/**
 * Device status colour mapping used for custom markers and UI badges.
 */
export const DEVICE_STATUS_COLORS: Record<string, string> = {
    online: '#22c55e',
    offline: '#ef4444',
    idle: '#f59e0b',
    moving: '#3b82f6',
};

/**
 * Escape HTML special characters to prevent XSS when injecting into innerHTML.
 */
export function escapeHTML(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build an SVG string for a device marker given a status colour.
 */
export function buildMarkerSVG(color: string, label?: string): string {
    const safeLabel = label ? escapeHTML(label.slice(0, 3)) : '';
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
        fill="${color}" stroke="#fff" stroke-width="2"/>
  <circle cx="18" cy="18" r="8" fill="#fff" fill-opacity="0.9"/>
  <text x="18" y="22" text-anchor="middle" font-family="sans-serif"
        font-size="8" font-weight="bold" fill="${color}">${safeLabel}</text>
</svg>`;
}

/**
 * Create a Mapbox GL HTMLElement marker element for a device.
 */
export function createDeviceMarkerElement(status: string, label?: string): HTMLElement {
    const color = DEVICE_STATUS_COLORS[status] ?? DEVICE_STATUS_COLORS.offline;
    const svg = buildMarkerSVG(color, label);

    const el = document.createElement('div');
    el.className = 'device-marker';
    el.style.cssText = 'cursor:pointer;width:36px;height:44px;';
    el.innerHTML = svg;
    return el;
}

/**
 * Animate a marker smoothly from its current LngLat to a new LngLat.
 * Uses requestAnimationFrame for a 600 ms linear interpolation.
 */
export function animateMarkerTo(
    marker: mapboxgl.Marker,
    targetLng: number,
    targetLat: number,
    durationMs = 600,
): void {
    const start = marker.getLngLat();
    const startLng = start.lng;
    const startLat = start.lat;
    const startTime = performance.now();

    function step(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        marker.setLngLat([
            startLng + (targetLng - startLng) * progress,
            startLat + (targetLat - startLat) * progress,
        ]);
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

/**
 * Build a GeoJSON FeatureCollection from an array of device objects.
 */
export function devicesToGeoJSON(
    devices: Array<{ id: number | string; name: string; lat: number; lng: number; status?: string; speed?: number; altitude?: number; heading?: number; battery?: number }>,
): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: devices.map((d) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
            properties: {
                id: d.id,
                name: d.name,
                status: d.status ?? 'offline',
                speed: d.speed ?? 0,
                altitude: d.altitude ?? 0,
                heading: d.heading ?? 0,
                battery: d.battery ?? 100,
            },
        })),
    };
}

/**
 * Convert a trail of [lng, lat] pairs into a GeoJSON LineString feature.
 * Each position is also assigned a `time` property (index) used for
 * line-gradient fade effects.
 */
export function trailToGeoJSON(
    trail: Array<[number, number]>,
): GeoJSON.Feature<GeoJSON.LineString> {
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: trail,
        },
    };
}
