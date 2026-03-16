import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

export interface HeatmapPoint {
  /** Longitude */
  lng: number;
  /** Latitude */
  lat: number;
  /** Optional activity weight (defaults to 1). */
  weight?: number;
}

interface HeatmapLayerProps {
  map: mapboxgl.Map | null;
  points: HeatmapPoint[];
  visible?: boolean;
}

const HEATMAP_SOURCE_ID = 'heatmap-source';
const HEATMAP_LAYER_ID = 'heatmap-layer';

/**
 * HeatmapLayer adds a Mapbox GL heatmap layer showing device activity
 * concentration.  It is a render-less component.
 */
const HeatmapLayer: React.FC<HeatmapLayerProps> = ({
  map,
  points,
  visible = true,
}) => {
  // Add/update source data
  useEffect(() => {
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        properties: { weight: p.weight ?? 1 },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    };

    if (map.getSource(HEATMAP_SOURCE_ID)) {
      (map.getSource(HEATMAP_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(
        geojson
      );
    } else {
      map.addSource(HEATMAP_SOURCE_ID, { type: 'geojson', data: geojson });

      map.addLayer({
        id: HEATMAP_LAYER_ID,
        type: 'heatmap',
        source: HEATMAP_SOURCE_ID,
        paint: {
          // Increase weight as feature weight property increases
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'weight'],
            0,
            0,
            1,
            1,
          ],
          // Increase intensity as zoom level increases
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            1,
            15,
            3,
          ],
          // Colour ramp: blue -> cyan -> green -> yellow -> red
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)',
          ],
          // Adjust radius with zoom
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            2,
            15,
            30,
          ],
          'heatmap-opacity': 0.8,
        },
      });
    }

    return () => {
      // Cleanup when component unmounts
      if (map.getLayer(HEATMAP_LAYER_ID)) map.removeLayer(HEATMAP_LAYER_ID);
      if (map.getSource(HEATMAP_SOURCE_ID)) map.removeSource(HEATMAP_SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update data when points change
  useEffect(() => {
    if (!map || !map.getSource(HEATMAP_SOURCE_ID)) return;

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        properties: { weight: p.weight ?? 1 },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      })),
    };

    (map.getSource(HEATMAP_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(
      geojson
    );
  }, [map, points]);

  // Toggle visibility
  useEffect(() => {
    if (!map || !map.getLayer(HEATMAP_LAYER_ID)) return;
    map.setLayoutProperty(
      HEATMAP_LAYER_ID,
      'visibility',
      visible ? 'visible' : 'none'
    );
  }, [map, visible]);

  return null;
};

export default HeatmapLayer;
