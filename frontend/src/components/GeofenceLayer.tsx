import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export interface GeofencePolygon {
  id: string;
  name: string;
  /** Array of [lng, lat] ring coordinates (closed polygon). */
  coordinates: Array<[number, number]>;
  fillColor?: string;
  strokeColor?: string;
  fillOpacity?: number;
}

interface GeofenceLayerProps {
  map: mapboxgl.Map | null;
  geofences: GeofencePolygon[];
}

const SOURCE_PREFIX = 'geofence-source-';
const FILL_LAYER_PREFIX = 'geofence-fill-';
const STROKE_LAYER_PREFIX = 'geofence-stroke-';

/**
 * GeofenceLayer renders geofence polygons on a Mapbox GL map.
 * It is a render-less component that manages Mapbox sources/layers
 * as a side effect.
 */
const GeofenceLayer: React.FC<GeofenceLayerProps> = ({ map, geofences }) => {
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!map) return;

    const addedIds = new Set<string>();

    geofences.forEach((fence) => {
      const sourceId = `${SOURCE_PREFIX}${fence.id}`;
      const fillLayerId = `${FILL_LAYER_PREFIX}${fence.id}`;
      const strokeLayerId = `${STROKE_LAYER_PREFIX}${fence.id}`;

      const fillColor = fence.fillColor ?? '#3b82f6';
      const strokeColor = fence.strokeColor ?? '#1d4ed8';
      const fillOpacity = fence.fillOpacity ?? 0.15;

      const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
        type: 'Feature',
        properties: { name: fence.name },
        geometry: {
          type: 'Polygon',
          coordinates: [fence.coordinates],
        },
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource(sourceId, { type: 'geojson', data: geojson });

        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': fillColor,
            'fill-opacity': fillOpacity,
          },
        });

        map.addLayer({
          id: strokeLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': strokeColor,
            'line-width': 2,
          },
        });
      }

      addedIds.add(fence.id);
    });

    // Remove layers/sources for geofences no longer in the list
    prevIdsRef.current.forEach((id) => {
      if (!addedIds.has(id)) {
        const sourceId = `${SOURCE_PREFIX}${id}`;
        const fillLayerId = `${FILL_LAYER_PREFIX}${id}`;
        const strokeLayerId = `${STROKE_LAYER_PREFIX}${id}`;

        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getLayer(strokeLayerId)) map.removeLayer(strokeLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    });

    prevIdsRef.current = addedIds;
  }, [map, geofences]);

  return null;
};

export default GeofenceLayer;
