import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapStyleSwitcher from './MapStyleSwitcher';
import MapLayerControl, { LayerConfig } from './MapLayerControl';
import GeofenceLayer, { GeofencePolygon } from './GeofenceLayer';
import HeatmapLayer, { HeatmapPoint } from './HeatmapLayer';
import RouteAnimation, { RoutePoint } from './RouteAnimation';
import {
  MapStyle,
  MAP_STYLES,
  STATUS_COLORS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  createMarkerElement,
  animateMarkerToPosition,
  getBoundsFromCoordinates,
} from '../utils/mapbox-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Device {
  id: number;
  name: string;
  /** Longitude */
  lng: number;
  /** Latitude */
  lat: number;
  status?: 'active' | 'idle' | 'offline' | 'unknown';
  heading?: number;
  speed?: number;
  altitude?: number;
  battery?: number;
  imei?: string;
  lastUpdate?: string;
}

interface MapContainerProps {
  devices?: Device[];
  geofences?: GeofencePolygon[];
  heatmapPoints?: HeatmapPoint[];
  routePoints?: RoutePoint[];
  /** Called when the user clicks a device marker. */
  onDeviceSelect?: (device: Device) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAPBOX_TOKEN =
  process.env.REACT_APP_MAPBOX_TOKEN ?? '';

const DEFAULT_LAYERS: LayerConfig[] = [
  { id: 'geofences', label: 'Geofences', enabled: true },
  { id: 'heatmap', label: 'Activity Heatmap', enabled: false },
  { id: 'route', label: 'Route Replay', enabled: false },
  { id: 'terrain', label: '3D Terrain', enabled: false },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MapContainer: React.FC<MapContainerProps> = ({
  devices = [],
  geofences = [],
  heatmapPoints = [],
  routePoints = [],
  onDeviceSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const popupsRef = useRef<Map<number, mapboxgl.Popup>>(new Map());

  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYERS);

  // Derive layer visibility from layer config
  const layerEnabled = useCallback(
    (id: string) => layers.find((l) => l.id === id)?.enabled ?? false,
    [layers]
  );

  // Collect all device coordinates for fit-bounds
  const allCoordinates = useMemo(
    (): Array<[number, number]> =>
      devices.map((d) => [d.lng, d.lat] as [number, number]),
    [devices]
  );

  // ------------------------------------------------------------------
  // Initialise map
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!MAPBOX_TOKEN) {
      console.warn(
        '[MapContainer] REACT_APP_MAPBOX_TOKEN is not set. ' +
          'Add it to frontend/.env.local to enable Mapbox GL rendering.'
      );
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyle],
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
    });

    // Built-in navigation controls (zoom / rotate)
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    // Scale indicator
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ------------------------------------------------------------------
  // Update map style
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAP_STYLES[mapStyle]);
    // After a style change the map re-fires 'load'; wait for it before
    // re-adding custom layers/sources in other effects.
    map.once('style.load', () => setMapReady(true));
    setMapReady(false);
  }, [mapStyle]);

  // ------------------------------------------------------------------
  // 3D Terrain
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (layerEnabled('terrain')) {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    } else {
      map.setTerrain(null);
      if (map.getSource('mapbox-dem')) {
        map.removeSource('mapbox-dem');
      }
    }
  }, [mapReady, layers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Device markers
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const currentIds = new Set(devices.map((d) => d.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        popupsRef.current.get(id)?.remove();
        popupsRef.current.delete(id);
      }
    });

    // Add / update markers
    devices.forEach((device) => {
      const existing = markersRef.current.get(device.id);

      if (existing) {
        // Animate to new position
        animateMarkerToPosition(existing, device.lng, device.lat);
        // Update popup content
        const popup = popupsRef.current.get(device.id);
        if (popup) {
          popup.setHTML(buildPopupHTML(device));
        }
      } else {
        // Create popup
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: true })
          .setHTML(buildPopupHTML(device));

        // Create marker element
        const el = createMarkerElement(device.status, device.heading);

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([device.lng, device.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => {
          onDeviceSelect?.(device);
        });

        markersRef.current.set(device.id, marker);
        popupsRef.current.set(device.id, popup);
      }
    });
  }, [mapReady, devices, onDeviceSelect]);

  // ------------------------------------------------------------------
  // Fit bounds when devices change
  // ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || allCoordinates.length === 0) return;

    const bounds = getBoundsFromCoordinates(allCoordinates);
    if (bounds) {
      map.fitBounds(bounds as mapboxgl.LngLatBoundsLike, {
        padding: 60,
        maxZoom: 14,
        duration: 800,
      });
    }
  }, [mapReady, allCoordinates]);

  // ------------------------------------------------------------------
  // Layer toggle handler
  // ------------------------------------------------------------------
  const handleLayerChange = useCallback(
    (id: string, enabled: boolean) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, enabled } : l))
      );
    },
    []
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Map canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Overlay controls */}
      <MapStyleSwitcher currentStyle={mapStyle} onChange={setMapStyle} />
      <MapLayerControl layers={layers} onChange={handleLayerChange} />

      {/* Render-less map layers (rendered after map is ready) */}
      {mapReady && (
        <>
          <GeofenceLayer
            map={mapRef.current}
            geofences={layerEnabled('geofences') ? geofences : []}
          />
          <HeatmapLayer
            map={mapRef.current}
            points={heatmapPoints}
            visible={layerEnabled('heatmap')}
          />
          {layerEnabled('route') && (
            <RouteAnimation
              map={mapRef.current}
              routePoints={routePoints}
              visible
            />
          )}
        </>
      )}

      {/* Missing token warning */}
      {!MAPBOX_TOKEN && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.75)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: 8,
            textAlign: 'center',
            maxWidth: 360,
            fontSize: 14,
            zIndex: 10,
          }}
        >
          <strong>Mapbox token not configured.</strong>
          <br />
          Add <code>REACT_APP_MAPBOX_TOKEN=&lt;your token&gt;</code> to{' '}
          <code>frontend/.env.local</code> and restart the dev server.
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Popup HTML helper
// ---------------------------------------------------------------------------

function buildPopupHTML(device: Device): string {
  const rows: string[] = [
    `<strong>${device.name}</strong>`,
    device.imei ? `<small>IMEI: ${device.imei}</small>` : '',
    `<span style="color:${statusColor(device.status)}">● ${device.status ?? 'unknown'}</span>`,
    device.speed !== undefined
      ? `Speed: <strong>${device.speed} km/h</strong>`
      : '',
    device.altitude !== undefined
      ? `Altitude: <strong>${device.altitude} m</strong>`
      : '',
    device.heading !== undefined
      ? `Heading: <strong>${device.heading}°</strong>`
      : '',
    device.battery !== undefined
      ? `Battery: <strong>${device.battery}%</strong>`
      : '',
    device.lastUpdate
      ? `<small>Updated: ${device.lastUpdate}</small>`
      : '',
  ];

  return `<div style="font-family:sans-serif;font-size:13px;line-height:1.6">
    ${rows.filter(Boolean).join('<br/>')}
  </div>`;
}

function statusColor(status?: string): string {
  return STATUS_COLORS[status ?? 'unknown'] ?? STATUS_COLORS.unknown;
}

export default MapContainer;
