import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { buildRouteGeoJSON, calculateRouteLength } from '../utils/mapbox-utils';

export interface RoutePoint {
  lng: number;
  lat: number;
  timestamp?: string;
}

interface RouteAnimationProps {
  map: mapboxgl.Map | null;
  routePoints: RoutePoint[];
  /** Total animation duration in milliseconds (default 10 000). */
  durationMs?: number;
  /** Colour of the animated route trail (default #3b82f6). */
  trailColor?: string;
  /** Colour of the faded history trail (default #93c5fd). */
  historyColor?: string;
  visible?: boolean;
}

const ROUTE_SOURCE_ID = 'route-animation-source';
const ROUTE_LAYER_ID = 'route-animation-layer';
const HISTORY_SOURCE_ID = 'route-history-source';
const HISTORY_LAYER_ID = 'route-history-layer';

/**
 * RouteAnimation renders an animated device movement replay on a Mapbox map.
 * It draws a faded history trail and animates the current route segment.
 */
const RouteAnimation: React.FC<RouteAnimationProps> = ({
  map,
  routePoints,
  durationMs = 10000,
  trailColor = '#3b82f6',
  historyColor = '#93c5fd',
  visible = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const routeLengthKm = useRef(0);

  const coordinates: Array<[number, number]> = routePoints.map((p) => [
    p.lng,
    p.lat,
  ]);

  // Initialise/cleanup Mapbox sources and layers
  useEffect(() => {
    if (!map) return;

    const emptyGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: 'FeatureCollection',
      features: [],
    };

    if (!map.getSource(HISTORY_SOURCE_ID)) {
      map.addSource(HISTORY_SOURCE_ID, { type: 'geojson', data: emptyGeoJSON });
      map.addLayer({
        id: HISTORY_LAYER_ID,
        type: 'line',
        source: HISTORY_SOURCE_ID,
        paint: {
          'line-color': historyColor,
          'line-width': 3,
          'line-opacity': 0.5,
          'line-dasharray': [2, 2],
        },
      });
    }

    if (!map.getSource(ROUTE_SOURCE_ID)) {
      map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: emptyGeoJSON });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        paint: {
          'line-color': trailColor,
          'line-width': 4,
          'line-opacity': 1,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      if (map.getLayer(HISTORY_LAYER_ID)) map.removeLayer(HISTORY_LAYER_ID);
      if (map.getSource(HISTORY_SOURCE_ID)) map.removeSource(HISTORY_SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Recalculate route length when points change
  useEffect(() => {
    routeLengthKm.current = calculateRouteLength(coordinates);
    // Draw full history trail
    if (map && map.getSource(HISTORY_SOURCE_ID) && coordinates.length >= 2) {
      (map.getSource(HISTORY_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(
        buildRouteGeoJSON(coordinates)
      );
    }
  }, [map, routePoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle visibility
  useEffect(() => {
    if (!map) return;
    const vis = visible ? 'visible' : 'none';
    if (map.getLayer(ROUTE_LAYER_ID))
      map.setLayoutProperty(ROUTE_LAYER_ID, 'visibility', vis);
    if (map.getLayer(HISTORY_LAYER_ID))
      map.setLayoutProperty(HISTORY_LAYER_ID, 'visibility', vis);
  }, [map, visible]);

  const animate = useCallback(
    (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const t = Math.min(elapsed / durationMs, 1);
      setProgress(t);

      if (!map || coordinates.length < 2) return;

      // Slice the coordinates up to the current animated point
      const sliceCount = Math.max(
        2,
        Math.round(t * coordinates.length)
      );
      const animatedCoords = coordinates.slice(0, sliceCount);

      (map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource)?.setData(
        buildRouteGeoJSON(animatedCoords)
      );

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        animationRef.current = null;
      }
    },
    [map, coordinates, durationMs]
  );

  const play = useCallback(() => {
    if (coordinates.length < 2) return;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }
    startTimeRef.current = null;
    setProgress(0);
    setIsPlaying(true);
    animationRef.current = requestAnimationFrame(animate);
  }, [animate, coordinates.length]);

  const stop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);
    startTimeRef.current = null;
    setProgress(0);
    if (map && map.getSource(ROUTE_SOURCE_ID)) {
      (map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [map]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 260,
      }}
    >
      <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
        Route Replay
      </span>
      <button
        onClick={isPlaying ? stop : play}
        disabled={coordinates.length < 2}
        style={{
          padding: '4px 12px',
          border: 'none',
          borderRadius: 4,
          background: isPlaying ? '#ef4444' : '#3b82f6',
          color: 'white',
          cursor: coordinates.length < 2 ? 'not-allowed' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {isPlaying ? 'Stop' : 'Play'}
      </button>
      <div
        style={{
          flex: 1,
          height: 6,
          background: '#e5e7eb',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.round(progress * 100)}%`,
            background: trailColor,
            borderRadius: 3,
            transition: 'width 0.1s linear',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 32 }}>
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
};

export default RouteAnimation;
