import mapboxgl from 'mapbox-gl';

/** Supported Mapbox map styles. */
export type MapStyle = 'streets' | 'light' | 'dark' | 'satellite' | 'outdoors';

/** Map from style key to the Mapbox style URL. */
export const MAP_STYLES: Record<MapStyle, string> = {
    streets: 'mapbox://styles/mapbox/streets-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};

/** Default map centre (London). */
export const DEFAULT_CENTER: [number, number] = [-0.09, 51.505];
export const DEFAULT_ZOOM = 13;

/** Device status values used for marker colour selection. */
export type DeviceStatus = 'online' | 'offline' | 'warning';

/** Colour mapping for device status indicators. */
export const STATUS_COLORS: Record<DeviceStatus, string> = {
    online: '#22c55e',
    offline: '#6b7280',
    warning: '#f59e0b',
};

/**
 * Build an SVG data-URL for a device marker.
 *
 * @param status  - Current device status (controls fill colour).
 * @param heading - Optional bearing in degrees (0 = north) to rotate the arrow.
 */
export function buildMarkerSvg(status: DeviceStatus = 'online', heading?: number): string {
    const fill = STATUS_COLORS[status];
    const rotation = heading !== undefined ? heading : 0;
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <g transform="rotate(${rotation}, 18, 18)">
    <!-- Pin body -->
    <ellipse cx="18" cy="18" rx="14" ry="14" fill="${fill}" stroke="#fff" stroke-width="2"/>
    <!-- Heading arrow -->
    <polygon points="18,2 24,18 18,14 12,18" fill="#fff" opacity="0.85"/>
  </g>
  <!-- Pin tail -->
  <polygon points="12,28 24,28 18,44" fill="${fill}"/>
</svg>`.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Add or update a custom device marker on the map.
 *
 * Returns the created / updated {@link mapboxgl.Marker} instance so the caller
 * can store it for later removal or position updates.
 */
export function upsertDeviceMarker(
    map: mapboxgl.Map,
    existingMarker: mapboxgl.Marker | null,
    lngLat: [number, number],
    status: DeviceStatus = 'online',
    heading?: number,
): mapboxgl.Marker {
    const el = document.createElement('div');
    el.style.backgroundImage = `url('${buildMarkerSvg(status, heading)}')`;
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.width = '36px';
    el.style.height = '44px';
    el.style.cursor = 'pointer';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `Device marker – ${status}`);

    if (existingMarker) {
        existingMarker.remove();
    }

    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(lngLat)
        .addTo(map);

    return marker;
}

/**
 * Fit the map viewport to the bounding box of the supplied coordinates with a
 * small amount of padding so markers are not clipped by the edges.
 */
export function fitMapToBounds(
    map: mapboxgl.Map,
    coords: Array<[number, number]>,
    paddingPx = 60,
): void {
    if (coords.length === 0) return;

    const bounds = coords.reduce(
        (acc, [lng, lat]) => acc.extend([lng, lat]),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
    );

    map.fitBounds(bounds, { padding: paddingPx, maxZoom: 16 });
}

/**
 * Calculate the straight-line distance (metres) between two lon/lat points
 * using the Haversine formula.
 */
export function haversineDistance(
    [lng1, lat1]: [number, number],
    [lng2, lat2]: [number, number],
): number {
    const R = 6_371_000; // Earth radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Throttle a function so it is called at most once per `limitMs` milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => void>(
    fn: T,
    limitMs: number,
): T {
    let lastCall = 0;
    return ((...args: unknown[]) => {
        const now = Date.now();
        if (now - lastCall >= limitMs) {
            lastCall = now;
            fn(...args);
        }
    }) as T;
}
