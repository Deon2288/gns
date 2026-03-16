import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import {
    MAP_STYLES,
    MapStyle,
    DEFAULT_CENTER,
    DEFAULT_ZOOM,
    DeviceStatus,
    upsertDeviceMarker,
    fitMapToBounds,
    throttle,
} from '../utils/mapbox-utils';
import MapStyleSwitcher from './MapStyleSwitcher';
import MapLayerControl, { LayerVisibility } from './MapLayerControl';
import GeofenceLayer, { Geofence } from './GeofenceLayer';
import HeatmapLayer, { HeatmapPoint } from './HeatmapLayer';
import RouteAnimation, { RoutePoint } from './RouteAnimation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceLocation {
    id: number;
    name: string;
    /** [longitude, latitude] */
    lngLat: [number, number];
    status?: DeviceStatus;
    /** Bearing in degrees (0 = north). */
    heading?: number;
    /** Extended telemetry fields. */
    speed?: number;
    altitude?: number;
    battery?: number;
    imei?: string;
}

interface MapContainerProps {
    /** Mapbox public token. Falls back to REACT_APP_MAPBOX_TOKEN env var. */
    mapboxToken?: string;
    devices?: DeviceLocation[];
    geofences?: Geofence[];
    heatmapPoints?: HeatmapPoint[];
    /** Route used by the animation player (single device path). */
    animationRoute?: RoutePoint[];
    /** Initial map style. Default: 'streets'. */
    initialStyle?: MapStyle;
    /** Map centre as [longitude, latitude]. */
    center?: [number, number];
    zoom?: number;
    /** Enable 3-D terrain visualisation (requires satellite or outdoors style). */
    terrain?: boolean;
}

// ---------------------------------------------------------------------------
// MapContainer
// ---------------------------------------------------------------------------

/**
 * Full-featured Mapbox GL map component for the GNS device tracking system.
 *
 * Features:
 * - Multiple map styles via {@link MapStyleSwitcher}
 * - Layer toggles via {@link MapLayerControl}
 * - Geofence polygon rendering via {@link GeofenceLayer}
 * - Activity heatmap via {@link HeatmapLayer}
 * - Animated route playback via {@link RouteAnimation}
 * - Custom SVG device markers with status indicators
 * - Real-time marker position updates (animated transitions)
 * - Info popup with extended telemetry on marker click
 * - "Fit to devices" button
 */
const MapContainer: React.FC<MapContainerProps> = ({
    mapboxToken,
    devices = [],
    geofences = [],
    heatmapPoints = [],
    animationRoute = [],
    initialStyle = 'streets',
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM,
    terrain = false,
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
    const popupsRef = useRef<Map<number, mapboxgl.Popup>>(new Map());
    const [mapReady, setMapReady] = useState(false);
    const [currentStyle, setCurrentStyle] = useState<MapStyle>(initialStyle);
    const [layers, setLayers] = useState<LayerVisibility>({
        roads: true,
        traffic: false,
        boundaries: true,
        labels: true,
        heatmap: false,
        geofences: true,
        deviceTrails: true,
    });

    // ── Resolve Mapbox token ──────────────────────────────────────────────
    const token = mapboxToken || process.env.REACT_APP_MAPBOX_TOKEN || '';

    // ── Initialise map ────────────────────────────────────────────────────
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        if (!token) {
            console.warn(
                'MapContainer: No Mapbox token provided. ' +
                'Set REACT_APP_MAPBOX_TOKEN in your environment or pass the mapboxToken prop.',
            );
            return;
        }

        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: MAP_STYLES[currentStyle],
            center,
            zoom,
            antialias: true,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-left');
        map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');
        map.addControl(
            new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
            'top-left',
        );

        map.on('load', () => {
            if (terrain) {
                map.addSource('mapbox-dem', {
                    type: 'raster-dem',
                    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    tileSize: 512,
                    maxzoom: 14,
                });
                map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
            }
            setMapReady(true);
        });

        mapRef.current = map;

        return () => {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current.clear();
            popupsRef.current.forEach((p) => p.remove());
            popupsRef.current.clear();
            map.remove();
            mapRef.current = null;
            setMapReady(false);
        };
        // Run only once on mount – changes to center/zoom are handled separately.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // ── Style switcher ────────────────────────────────────────────────────
    const handleStyleChange = useCallback((style: MapStyle) => {
        setCurrentStyle(style);
        if (!mapRef.current) return;
        mapRef.current.setStyle(MAP_STYLES[style]);
        // Sub-layers (geofences, heatmap, etc.) re-attach via their own effects
        // once the 'style.load' event fires; setMapReady toggles them.
        // Briefly set mapReady to false so sub-components unmount their layers,
        // then restore it to true once the new style has loaded so they re-attach.
        setMapReady(false);
        mapRef.current.once('style.load', () => setMapReady(true));
    }, []);

    // ── Layer visibility toggles ──────────────────────────────────────────
    const handleLayerToggle = useCallback((layer: keyof LayerVisibility) => {
        setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
    }, []);

    // ── Mapbox built-in layer visibility ─────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;

        const setLayerVisibility = (pattern: RegExp, visible: boolean) => {
            map.getStyle()?.layers?.forEach((l) => {
                if (pattern.test(l.id)) {
                    map.setLayoutProperty(l.id, 'visibility', visible ? 'visible' : 'none');
                }
            });
        };

        setLayerVisibility(/road|street/i, layers.roads);
        setLayerVisibility(/traffic/i, layers.traffic);
        setLayerVisibility(/admin|boundary/i, layers.boundaries);
        setLayerVisibility(/label|place-/i, layers.labels);
    }, [mapReady, layers.roads, layers.traffic, layers.boundaries, layers.labels]);

    // ── Device markers ────────────────────────────────────────────────────
    // Throttle marker updates to at most once per 100 ms for performance.
    const updateMarkers = useCallback(
        throttle(() => {
            const map = mapRef.current;
            if (!map) return;

            const seen = new Set<number>();

            devices.forEach((device) => {
                seen.add(device.id);
                const existing = markersRef.current.get(device.id) ?? null;
                const marker = upsertDeviceMarker(
                    map,
                    existing,
                    device.lngLat,
                    device.status ?? 'online',
                    device.heading,
                );

                // Attach popup with telemetry
                const popup = popupsRef.current.get(device.id) ?? new mapboxgl.Popup({ offset: 25 });
                popup.setHTML(buildPopupHtml(device));
                marker.setPopup(popup);
                popupsRef.current.set(device.id, popup);
                markersRef.current.set(device.id, marker);
            });

            // Remove markers for devices no longer in the list
            markersRef.current.forEach((marker, id) => {
                if (!seen.has(id)) {
                    marker.remove();
                    markersRef.current.delete(id);
                    popupsRef.current.get(id)?.remove();
                    popupsRef.current.delete(id);
                }
            });
        }, 100),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [devices],
    );

    useEffect(() => {
        if (!mapReady) return;
        updateMarkers();
    }, [mapReady, updateMarkers]);

    // ── Fit-to-devices button ─────────────────────────────────────────────
    const handleFitToDevices = useCallback(() => {
        const map = mapRef.current;
        if (!map || devices.length === 0) return;
        fitMapToBounds(map, devices.map((d) => d.lngLat));
    }, [devices]);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            {/* Map canvas */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* No-token warning */}
            {!token && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 16,
                        zIndex: 2000,
                        textAlign: 'center',
                        padding: 24,
                    }}
                >
                    ⚠️ Mapbox token is missing.
                    <br />
                    Set <code>REACT_APP_MAPBOX_TOKEN</code> in <code>frontend/.env.local</code>.
                </div>
            )}

            {/* Overlay controls – only shown once map is initialised */}
            {mapReady && (
                <>
                    <MapStyleSwitcher currentStyle={currentStyle} onStyleChange={handleStyleChange} />
                    <MapLayerControl layers={layers} onToggle={handleLayerToggle} />

                    {/* Fit-to-devices button */}
                    {devices.length > 0 && (
                        <button
                            onClick={handleFitToDevices}
                            title="Fit map to all devices"
                            aria-label="Fit map to all devices"
                            style={{
                                position: 'absolute',
                                top: 10,
                                left: 50,
                                zIndex: 1000,
                                padding: '6px 12px',
                                background: 'rgba(255,255,255,0.95)',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 600,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            }}
                        >
                            📍 Fit Devices
                        </button>
                    )}

                    {/* Device count badge */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 10,
                            right: 180,
                            zIndex: 1000,
                            padding: '4px 10px',
                            background: 'rgba(255,255,255,0.95)',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#374151',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        }}
                    >
                        {devices.length} device{devices.length !== 1 ? 's' : ''}
                    </div>
                </>
            )}

            {/* Renderless sub-components */}
            <GeofenceLayer map={mapReady ? mapRef.current : null} geofences={geofences} visible={layers.geofences} />
            <HeatmapLayer map={mapReady ? mapRef.current : null} points={heatmapPoints} visible={layers.heatmap} />
            <RouteAnimation
                map={mapReady ? mapRef.current : null}
                route={animationRoute}
                visible={layers.deviceTrails && animationRoute.length > 0}
            />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPopupHtml(device: DeviceLocation): string {
    const rows = [
        ['Name', device.name],
        device.imei ? ['IMEI', device.imei] : null,
        ['Status', device.status ?? 'online'],
        device.speed !== undefined ? ['Speed', `${device.speed} km/h`] : null,
        device.altitude !== undefined ? ['Altitude', `${device.altitude} m`] : null,
        device.heading !== undefined ? ['Heading', `${device.heading}°`] : null,
        device.battery !== undefined ? ['Battery', `${device.battery}%`] : null,
    ]
        .filter(Boolean)
        .map(
            (row) =>
                `<tr><td style="color:#6b7280;padding-right:8px">${row![0]}</td><td><b>${row![1]}</b></td></tr>`,
        )
        .join('');

    return `<table style="font-size:13px;line-height:1.6;border-collapse:collapse">${rows}</table>`;
}

export default MapContainer;
