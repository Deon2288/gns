import React, { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

export interface RoutePoint {
    lng: number;
    lat: number;
    timestamp?: number;
}

interface RouteAnimationProps {
    map: mapboxgl.Map | null;
    route: RoutePoint[];
    /** Whether playback is active */
    playing: boolean;
    /** Playback speed multiplier (default 1) */
    speed?: number;
    /** Colour of the animated route line */
    lineColor?: string;
    onComplete?: () => void;
}

const ROUTE_SOURCE = 'route-anim-source';
const ROUTE_LAYER = 'route-anim-layer';
const DOT_SOURCE = 'route-dot-source';
const DOT_LAYER = 'route-dot-layer';

/** Base milliseconds between animation steps at speed=1. */
const BASE_STEP_MS = 80;

/**
 * Animates a moving dot along a route polyline on a Mapbox GL map.
 * The dot advances frame by frame and leaves a coloured trail behind it.
 */
const RouteAnimation: React.FC<RouteAnimationProps> = ({
    map,
    route,
    playing,
    speed = 1,
    lineColor = '#f59e0b',
    onComplete,
}) => {
    const frameRef = useRef<number | null>(null);
    const indexRef = useRef(0);
    const lastTimeRef = useRef<number | null>(null);
    const [, forceUpdate] = useState(0);

    const initLayers = useCallback(() => {
        if (!map) return;

        if (!map.getSource(ROUTE_SOURCE)) {
            map.addSource(ROUTE_SOURCE, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
        }

        if (!map.getLayer(ROUTE_LAYER)) {
            map.addLayer({
                id: ROUTE_LAYER,
                type: 'line',
                source: ROUTE_SOURCE,
                paint: {
                    'line-color': lineColor,
                    'line-width': 3,
                    'line-opacity': 0.8,
                },
            });
        }

        if (!map.getSource(DOT_SOURCE)) {
            map.addSource(DOT_SOURCE, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
        }

        if (!map.getLayer(DOT_LAYER)) {
            map.addLayer({
                id: DOT_LAYER,
                type: 'circle',
                source: DOT_SOURCE,
                paint: {
                    'circle-radius': 8,
                    'circle-color': lineColor,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#fff',
                },
            });
        }
    }, [map, lineColor]);

    // Initialise / reinitialise layers whenever map or route changes
    useEffect(() => {
        if (!map) return;

        function setup() {
            initLayers();
            indexRef.current = 0;
            lastTimeRef.current = null;
            forceUpdate((n) => n + 1);
        }

        if (map.isStyleLoaded()) {
            setup();
        } else {
            map.once('styledata', setup);
        }

        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            if (!map || (map as unknown as { _removed?: boolean })._removed) return;
            [DOT_SOURCE, ROUTE_SOURCE].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, route]);

    // Drive the animation loop
    useEffect(() => {
        if (!map || !playing || route.length < 2) return;

        const msPerStep = BASE_STEP_MS / speed; // milliseconds between steps

        function animate(now: number) {
            if (!map) return;
            if (lastTimeRef.current === null) lastTimeRef.current = now;

            if (now - lastTimeRef.current >= msPerStep) {
                lastTimeRef.current = now;
                indexRef.current = Math.min(indexRef.current + 1, route.length - 1);

                const trail = route
                    .slice(0, indexRef.current + 1)
                    .map((p) => [p.lng, p.lat]);

                const trailGeoJSON: GeoJSON.FeatureCollection = {
                    type: 'FeatureCollection',
                    features: trail.length >= 2
                        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: trail } }]
                        : [],
                };

                const dotGeoJSON: GeoJSON.FeatureCollection = {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'Point', coordinates: trail[trail.length - 1] },
                    }],
                };

                (map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource)?.setData(trailGeoJSON);
                (map.getSource(DOT_SOURCE) as mapboxgl.GeoJSONSource)?.setData(dotGeoJSON);

                if (indexRef.current >= route.length - 1) {
                    onComplete?.();
                    return;
                }
            }

            frameRef.current = requestAnimationFrame(animate);
        }

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, playing, route, speed]);

    return null;
};

export default RouteAnimation;
