import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

/** Supported Mapbox map style identifiers */
export type MapStyle =
  | 'streets'
  | 'outdoors'
  | 'light'
  | 'dark'
  | 'satellite'
  | 'satellite-streets';

/** Map style URL registry */
export const MAP_STYLES: Record<MapStyle, string> = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v12',
};

/** Default map center (London) */
export const DEFAULT_CENTER: [number, number] = [-0.09, 51.505];

/** Default zoom level */
export const DEFAULT_ZOOM = 12;

/** Device status colours used across components */
export const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  idle: '#f59e0b',
  offline: '#ef4444',
  unknown: '#6b7280',
};

/**
 * Return a SVG string for a device marker.
 * @param status - The current device status.
 * @param heading - Optional compass heading in degrees (0-360).
 */
export function createDeviceMarkerSVG(
  status: string = 'unknown',
  heading?: number
): string {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  const rotation =
    heading !== undefined ? `transform="rotate(${heading}, 20, 20)"` : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="${color}" fill-opacity="0.25" />
      <circle cx="20" cy="20" r="9" fill="${color}" />
      ${
        heading !== undefined
          ? `<polygon points="20,6 24,16 20,13 16,16" fill="white" ${rotation} />`
          : ''
      }
      <circle cx="20" cy="20" r="4" fill="white" />
    </svg>
  `;
}

/**
 * Create a Mapbox GL marker element for a device.
 * @param status - Device status string.
 * @param heading - Optional compass heading.
 */
export function createMarkerElement(
  status: string = 'unknown',
  heading?: number
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'device-marker';
  el.innerHTML = createDeviceMarkerSVG(status, heading);
  el.style.cursor = 'pointer';
  el.style.width = '40px';
  el.style.height = '40px';
  return el;
}

/**
 * Smoothly animate a Mapbox marker from its current position to a new one.
 * Uses requestAnimationFrame for a 600ms ease-in-out transition.
 */
export function animateMarkerToPosition(
  marker: mapboxgl.Marker,
  targetLng: number,
  targetLat: number,
  durationMs = 600
): void {
  const startLngLat = marker.getLngLat();
  const startLng = startLngLat.lng;
  const startLat = startLngLat.lat;
  const startTime = performance.now();

  function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function step(now: number): void {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / durationMs, 1);
    const easedT = easeInOut(t);

    marker.setLngLat([
      startLng + (targetLng - startLng) * easedT,
      startLat + (targetLat - startLat) * easedT,
    ]);

    if (t < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/**
 * Build a GeoJSON FeatureCollection from an array of [lng, lat] coordinate pairs.
 */
export function buildRouteGeoJSON(
  coordinates: Array<[number, number]>
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  };
}

/**
 * Calculate the distance (in km) between two [lng, lat] points using Turf.js.
 */
export function calculateDistance(
  from: [number, number],
  to: [number, number]
): number {
  const fromPoint = turf.point(from);
  const toPoint = turf.point(to);
  return turf.distance(fromPoint, toPoint, { units: 'kilometers' });
}

/**
 * Calculate the total length of a route in kilometres.
 */
export function calculateRouteLength(
  coordinates: Array<[number, number]>
): number {
  if (coordinates.length < 2) return 0;
  const line = turf.lineString(coordinates);
  return turf.length(line, { units: 'kilometers' });
}

/**
 * Compute the bounding box for a set of [lng, lat] coordinates and return
 * a Mapbox-compatible LngLatBoundsLike.
 */
export function getBoundsFromCoordinates(
  coordinates: Array<[number, number]>
): mapboxgl.LngLatBoundsLike | null {
  if (coordinates.length === 0) return null;

  const bbox = turf.bbox(turf.multiPoint(coordinates));
  // bbox is [minLng, minLat, maxLng, maxLat]
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}

/**
 * Convert a hex colour string to an RGBA array accepted by Mapbox GL.
 * @param hex - Hex colour, e.g. "#ff0000"
 * @param alpha - Opacity 0-1 (default 1).
 */
export function hexToRgba(
  hex: string,
  alpha = 1
): [number, number, number, number] {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b, alpha];
}
