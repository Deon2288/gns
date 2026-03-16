import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

export interface RoutePoint {
    longitude: number;
    latitude: number;
    timestamp?: string;
}

interface RouteAnimationProps {
    map: mapboxgl.Map | null;
    route: RoutePoint[];
    /** Milliseconds between each animation step. Default: 200 */
    stepIntervalMs?: number;
    visible: boolean;
}

const ROUTE_SOURCE = 'route-animation-source';
const ROUTE_LAYER = 'route-animation-layer';
const ROUTE_TRAIL_SOURCE = 'route-trail-source';
const ROUTE_TRAIL_LAYER = 'route-trail-layer';

function buildLineGeoJson(
    points: RoutePoint[],
): GeoJSON.Feature<GeoJSON.LineString> {
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: points.map((p) => [p.longitude, p.latitude]),
        },
    };
}

/**
 * Renderless component that animates a device route on a Mapbox GL map.
 *
 * - A faded trail line shows the completed portion of the route.
 * - A marker advances along the route at `stepIntervalMs` intervals.
 * - Playback controls (Play / Pause / Reset) are exposed via an overlay.
 */
const RouteAnimation: React.FC<RouteAnimationProps> = ({
    map,
    route,
    stepIntervalMs = 200,
    visible,
}) => {
    const [playing, setPlaying] = useState(false);
    const [step, setStep] = useState(0);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Setup sources & layers ──────────────────────────────────────────────
    useEffect(() => {
        if (!map) return;

        const setupLayers = () => {
            if (!map.getSource(ROUTE_TRAIL_SOURCE)) {
                map.addSource(ROUTE_TRAIL_SOURCE, {
                    type: 'geojson',
                    data: buildLineGeoJson([]),
                });
            }
            if (!map.getLayer(ROUTE_TRAIL_LAYER)) {
                map.addLayer({
                    id: ROUTE_TRAIL_LAYER,
                    type: 'line',
                    source: ROUTE_TRAIL_SOURCE,
                    paint: {
                        'line-color': '#3b82f6',
                        'line-width': 3,
                        'line-opacity': 0.5,
                        'line-dasharray': [2, 2],
                    },
                });
            }
            if (!map.getSource(ROUTE_SOURCE)) {
                map.addSource(ROUTE_SOURCE, {
                    type: 'geojson',
                    data: buildLineGeoJson(route),
                });
            }
            if (!map.getLayer(ROUTE_LAYER)) {
                map.addLayer({
                    id: ROUTE_LAYER,
                    type: 'line',
                    source: ROUTE_SOURCE,
                    paint: {
                        'line-color': '#93c5fd',
                        'line-width': 2,
                        'line-opacity': 0.3,
                    },
                });
            }
        };

        if (map.isStyleLoaded()) {
            setupLayers();
        } else {
            map.once('load', setupLayers);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            markerRef.current?.remove();
            if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER);
            if (map.getLayer(ROUTE_TRAIL_LAYER)) map.removeLayer(ROUTE_TRAIL_LAYER);
            if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
            if (map.getSource(ROUTE_TRAIL_SOURCE)) map.removeSource(ROUTE_TRAIL_SOURCE);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    // ── Update full-route line when route prop changes ─────────────────────
    useEffect(() => {
        if (!map || !map.isStyleLoaded()) return;
        const src = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        src?.setData(buildLineGeoJson(route));
        setStep(0);
        setPlaying(false);
    }, [map, route]);

    // ── Advance animation each step ────────────────────────────────────────
    const advanceStep = useCallback(() => {
        setStep((prev) => {
            const next = prev + 1;
            if (next >= route.length) {
                setPlaying(false);
                return route.length - 1;
            }
            return next;
        });
    }, [route.length]);

    useEffect(() => {
        if (playing) {
            intervalRef.current = setInterval(advanceStep, stepIntervalMs);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [playing, advanceStep, stepIntervalMs]);

    // ── Update trail & marker position on each step ─────────────────────────
    useEffect(() => {
        if (!map || !map.isStyleLoaded() || route.length === 0) return;

        const currentPoint = route[step];

        // Update trail line
        const trailSrc = map.getSource(ROUTE_TRAIL_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        trailSrc?.setData(buildLineGeoJson(route.slice(0, step + 1)));

        // Move or create the animated marker
        const lngLat: [number, number] = [currentPoint.longitude, currentPoint.latitude];
        if (markerRef.current) {
            markerRef.current.setLngLat(lngLat);
        } else {
            const el = document.createElement('div');
            el.style.cssText =
                'width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 2px #3b82f6;';
            markerRef.current = new mapboxgl.Marker({ element: el })
                .setLngLat(lngLat)
                .addTo(map);
        }
    }, [map, route, step]);

    // ── Toggle visibility ──────────────────────────────────────────────────
    useEffect(() => {
        if (!map || !map.isStyleLoaded()) return;
        const v = visible ? 'visible' : 'none';
        if (map.getLayer(ROUTE_LAYER)) map.setLayoutProperty(ROUTE_LAYER, 'visibility', v);
        if (map.getLayer(ROUTE_TRAIL_LAYER)) map.setLayoutProperty(ROUTE_TRAIL_LAYER, 'visibility', v);
        if (markerRef.current) {
            markerRef.current.getElement().style.display = visible ? '' : 'none';
        }
    }, [map, visible]);

    if (!visible || route.length === 0) return null;

    const progress = route.length > 1 ? Math.round((step / (route.length - 1)) * 100) : 100;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 120,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000,
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 8,
                padding: '8px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minWidth: 220,
            }}
            role="toolbar"
            aria-label="Route animation controls"
        >
            <button
                onClick={() => { setStep(0); setPlaying(false); }}
                aria-label="Reset route animation"
                style={controlBtnStyle}
            >
                ⏮
            </button>
            <button
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? 'Pause route animation' : 'Play route animation'}
                style={{ ...controlBtnStyle, background: '#3b82f6', color: '#fff', minWidth: 40 }}
            >
                {playing ? '⏸' : '▶'}
            </button>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>
                    Step {step + 1} / {route.length} ({progress}%)
                </div>
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: '#3b82f6',
                            borderRadius: 2,
                            transition: 'width 0.15s',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

const controlBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: 5,
    border: '1px solid #d1d5db',
    cursor: 'pointer',
    fontSize: 16,
    background: '#f9fafb',
    color: '#374151',
};

export default RouteAnimation;
