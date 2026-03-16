import React, { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import {
    MAP_STYLES,
    DEVICE_STATUS_COLORS,
    createDeviceMarkerElement,
    animateMarkerTo,
    escapeHTML,
} from '../utils/mapbox-utils';
import MapStyleSwitcher from './MapStyleSwitcher';
import MapLayerControl, { LayerState } from './MapLayerControl';
import GeofenceLayer, { Geofence } from './GeofenceLayer';
import HeatmapLayer, { HeatmapPoint } from './HeatmapLayer';
import RouteAnimation, { RoutePoint } from './RouteAnimation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceData {
    id: number | string;
    name: string;
    lat: number;
    lng: number;
    status?: 'online' | 'offline' | 'idle' | 'moving';
    speed?: number;
    altitude?: number;
    heading?: number;
    battery?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mapbox GL layer IDs to toggle per control key.
 * These IDs are present in the default Mapbox "streets", "outdoors", and "light/dark" styles.
 * Satellite style uses a simplified road layer set; missing layers are safely skipped
 * at runtime because each toggle already guards with `map.getLayer(layerId)`.
 */
const TOGGLEABLE_LAYERS: Record<keyof Omit<LayerState, 'heatmap' | 'geofences'>, string[]> = {
    roads: ['road-simple', 'road-label-simple', 'road-label'],
    traffic: ['traffic'],
    boundaries: ['admin-0-boundary', 'admin-1-boundary', 'admin-0-boundary-disputed'],
    labels: ['settlement-label', 'state-label', 'country-label', 'poi-label'],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MapContainer: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

    const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [currentStyle, setCurrentStyle] = useState<string>('streets');
    const [devices, setDevices] = useState<DeviceData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [layers, setLayers] = useState<LayerState>({
        roads: true,
        traffic: false,
        boundaries: true,
        labels: true,
        heatmap: false,
        geofences: false,
    });

    // Demo geofences
    const [geofences] = useState<Geofence[]>([
        {
            id: 'gf-1',
            name: 'Zone A',
            coordinates: [[
                [-0.11, 51.50],
                [-0.08, 51.50],
                [-0.08, 51.52],
                [-0.11, 51.52],
                [-0.11, 51.50],
            ]],
            fillColor: '#3b82f6',
            strokeColor: '#1d4ed8',
        },
    ]);

    // Route animation state
    const [animRoute] = useState<RoutePoint[]>([
        { lng: -0.09, lat: 51.505 },
        { lng: -0.091, lat: 51.507 },
        { lng: -0.093, lat: 51.509 },
        { lng: -0.096, lat: 51.510 },
        { lng: -0.100, lat: 51.511 },
    ]);
    const [animPlaying, setAnimPlaying] = useState(false);

    // Heatmap data derived from device positions
    const heatmapPoints: HeatmapPoint[] = devices.map((d) => ({
        lng: d.lng,
        lat: d.lat,
        weight: d.status === 'moving' ? 2 : 1,
    }));

    // ------------------------------------------------------------------
    // Initialise Mapbox GL map
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const token = process.env.REACT_APP_MAPBOX_TOKEN ?? '';
        if (!token || token === 'your_mapbox_token_here') {
            console.warn(
                '[MapContainer] REACT_APP_MAPBOX_TOKEN is not set. ' +
                'Please add your Mapbox token to frontend/.env.local',
            );
        }
        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: MAP_STYLES[currentStyle],
            center: [-0.09, 51.505],
            zoom: 13,
            attributionControl: false,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120 }), 'bottom-left');
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
        map.addControl(new mapboxgl.FullscreenControl(), 'bottom-right');

        map.on('load', () => {
            setMapInstance(map);
            setMapReady(true);
        });

        mapRef.current = map;
        // Capture the markers map now so the cleanup closure doesn't
        // reference the mutable ref value (react-hooks/exhaustive-deps).
        const markers = markersRef.current;

        return () => {
            markers.forEach((m) => m.remove());
            markers.clear();
            map.remove();
            mapRef.current = null;
            setMapInstance(null);
            setMapReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------------------
    // Switch map style
    // ------------------------------------------------------------------
    const handleStyleChange = useCallback((styleKey: string) => {
        const map = mapRef.current;
        if (!map) return;

        setCurrentStyle(styleKey);
        setMapReady(false);
        setMapInstance(null);

        // Remove existing markers before style change (they'll be re-added on load)
        markersRef.current.forEach((m) => m.remove());
        markersRef.current.clear();

        map.setStyle(MAP_STYLES[styleKey]);
        map.once('styledata', () => {
            setMapInstance(map);
            setMapReady(true);
        });
    }, []);

    // ------------------------------------------------------------------
    // Fetch device data (mock — replace with real API call)
    // ------------------------------------------------------------------
    useEffect(() => {
        const mockDevices: DeviceData[] = [
            { id: 1, name: 'DEV-001', lat: 51.505, lng: -0.09, status: 'moving', speed: 42, altitude: 15, heading: 90, battery: 87 },
            { id: 2, name: 'DEV-002', lat: 51.510, lng: -0.10, status: 'online', speed: 0, altitude: 12, heading: 0, battery: 65 },
            { id: 3, name: 'DEV-003', lat: 51.512, lng: -0.12, status: 'idle', speed: 0, altitude: 18, heading: 180, battery: 42 },
            { id: 4, name: 'DEV-004', lat: 51.500, lng: -0.08, status: 'offline', speed: 0, altitude: 10, heading: 270, battery: 10 },
        ];
        setDevices(mockDevices);

        const interval = setInterval(() => {
            setDevices((prev) =>
                prev.map((d) =>
                    d.status === 'moving'
                        ? { ...d, lat: d.lat + (Math.random() - 0.5) * 0.001, lng: d.lng + (Math.random() - 0.5) * 0.001 }
                        : d,
                ),
            );
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // ------------------------------------------------------------------
    // Sync device markers
    // ------------------------------------------------------------------
    useEffect(() => {
        const map = mapInstance;
        if (!map || !mapReady) return;

        const filteredDevices = devices.filter(
            (d) =>
                searchQuery === '' ||
                d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(d.id).includes(searchQuery),
        );

        const activeIds = new Set(filteredDevices.map((d) => String(d.id)));

        // Remove stale markers
        markersRef.current.forEach((marker, id) => {
            if (!activeIds.has(id)) {
                marker.remove();
                markersRef.current.delete(id);
            }
        });

        filteredDevices.forEach((device) => {
            const id = String(device.id);
            const existing = markersRef.current.get(id);

            if (existing) {
                // Animate to new position
                animateMarkerTo(existing, device.lng, device.lat);
            } else {
                // Create new marker
                const el = createDeviceMarkerElement(device.status ?? 'offline', device.name.slice(0, 3));

                const popup = new mapboxgl.Popup({ offset: 28, closeButton: true }).setHTML(
                    buildPopupHTML(device),
                );

                const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([device.lng, device.lat])
                    .setPopup(popup)
                    .addTo(map);

                markersRef.current.set(id, marker);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devices, mapInstance, mapReady, searchQuery]);

    // ------------------------------------------------------------------
    // Apply layer visibility
    // ------------------------------------------------------------------
    useEffect(() => {
        const map = mapInstance;
        if (!map || !mapReady) return;

        (Object.keys(TOGGLEABLE_LAYERS) as Array<keyof typeof TOGGLEABLE_LAYERS>).forEach((key) => {
            const vis = layers[key] ? 'visible' : 'none';
            TOGGLEABLE_LAYERS[key].forEach((layerId) => {
                if (map.getLayer(layerId)) {
                    map.setLayoutProperty(layerId, 'visibility', vis);
                }
            });
        });
    }, [layers, mapInstance, mapReady]);

    // ------------------------------------------------------------------
    // Layer toggle handler
    // ------------------------------------------------------------------
    const handleLayerToggle = useCallback((layer: keyof LayerState) => {
        setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    }, []);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            {/* Map canvas */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Overlaid controls */}
            {mapReady && (
                <>
                    <MapStyleSwitcher currentStyle={currentStyle} onStyleChange={handleStyleChange} />
                    <MapLayerControl layers={layers} onToggle={handleLayerToggle} />
                </>
            )}

            {/* Search bar */}
            <div style={searchBarStyle}>
                <input
                    type="text"
                    placeholder="Search device name or ID…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={searchInputStyle}
                />
            </div>

            {/* Route animation control */}
            <div style={routeControlStyle}>
                <button
                    onClick={() => setAnimPlaying((p) => !p)}
                    style={routeButtonStyle}
                    title={animPlaying ? 'Pause route animation' : 'Play route animation'}
                >
                    {animPlaying ? '⏸ Pause Route' : '▶ Play Route'}
                </button>
            </div>

            {/* Device count badge */}
            <div style={badgeStyle}>
                {devices.filter((d) => d.status !== 'offline').length} / {devices.length} devices online
            </div>

            {/* Sub-components that operate on the map imperatively */}
            <GeofenceLayer
                map={mapInstance}
                geofences={geofences}
                visible={layers.geofences}
            />
            <HeatmapLayer
                map={mapInstance}
                points={heatmapPoints}
                visible={layers.heatmap}
            />
            <RouteAnimation
                map={mapInstance}
                route={animRoute}
                playing={animPlaying}
                speed={2}
                onComplete={() => setAnimPlaying(false)}
            />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Popup HTML builder
// ---------------------------------------------------------------------------
function buildPopupHTML(device: DeviceData): string {
    const color = DEVICE_STATUS_COLORS[device.status ?? 'offline'];
    const safeName = escapeHTML(String(device.name));
    const safeStatus = escapeHTML(device.status ?? 'unknown');
    return `
<div style="font-family:sans-serif;font-size:13px;min-width:160px">
  <div style="font-weight:700;margin-bottom:6px;font-size:14px">${safeName}</div>
  <div style="margin-bottom:4px">
    <span style="display:inline-block;background:${color};color:#fff;border-radius:4px;padding:1px 7px;font-size:11px;text-transform:uppercase">
      ${safeStatus}
    </span>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:6px">
    <tr><td style="color:#888;padding:2px 0">Speed</td><td style="text-align:right">${device.speed ?? 0} km/h</td></tr>
    <tr><td style="color:#888;padding:2px 0">Altitude</td><td style="text-align:right">${device.altitude ?? 0} m</td></tr>
    <tr><td style="color:#888;padding:2px 0">Heading</td><td style="text-align:right">${device.heading ?? 0}°</td></tr>
    <tr><td style="color:#888;padding:2px 0">Battery</td><td style="text-align:right">${device.battery ?? 0}%</td></tr>
    <tr><td style="color:#888;padding:2px 0">Lat / Lng</td>
        <td style="text-align:right">${device.lat.toFixed(5)}, ${device.lng.toFixed(5)}</td></tr>
  </table>
</div>`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const searchBarStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    zIndex: 10,
};

const searchInputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    fontSize: '13px',
    width: '220px',
    outline: 'none',
};

const routeControlStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '60px',
    left: '10px',
    zIndex: 10,
};

const routeButtonStyle: React.CSSProperties = {
    padding: '8px 14px',
    background: '#f59e0b',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
};

const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    padding: '5px 14px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

export default MapContainer;
