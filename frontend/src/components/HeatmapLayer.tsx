import React, { useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export interface HeatmapPoint {
    lng: number;
    lat: number;
    weight?: number;
}

interface HeatmapLayerProps {
    map: mapboxgl.Map | null;
    points: HeatmapPoint[];
    visible: boolean;
}

const SOURCE_ID = 'heatmap-source';
const LAYER_ID = 'heatmap-layer';

/**
 * Renders a Mapbox GL heatmap layer showing device activity concentration.
 * The heatmap transitions to a circle layer at higher zoom levels.
 */
const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ map, points, visible }) => {
    const initialised = useRef(false);

    const buildGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
        type: 'FeatureCollection',
        features: points.map((p) => ({
            type: 'Feature' as const,
            properties: { weight: p.weight ?? 1 },
            geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
    }), [points]);

    useEffect(() => {
        if (!map) return;

        function addLayer() {
            if (!map) return;

            if (!map.getSource(SOURCE_ID)) {
                map.addSource(SOURCE_ID, { type: 'geojson', data: buildGeoJSON() });
            }

            if (!map.getLayer(LAYER_ID)) {
                map.addLayer({
                    id: LAYER_ID,
                    type: 'heatmap',
                    source: SOURCE_ID,
                    maxzoom: 15,
                    paint: {
                        // Increase weight as activity increases
                        'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 6, 1],
                        // Increase intensity as zoom level increases
                        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                        // Use a colour ramp from blue (low) → red (high)
                        'heatmap-color': [
                            'interpolate',
                            ['linear'],
                            ['heatmap-density'],
                            0, 'rgba(33,102,172,0)',
                            0.2, 'rgb(103,169,207)',
                            0.4, 'rgb(209,229,240)',
                            0.6, 'rgb(253,219,199)',
                            0.8, 'rgb(239,138,98)',
                            1, 'rgb(178,24,43)',
                        ],
                        // Adjust radius with zoom
                        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
                        // Reduce opacity at higher zoom levels
                        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 15, 0],
                    },
                });
            }

            initialised.current = true;
        }

        if (map.isStyleLoaded()) {
            addLayer();
        } else {
            map.once('styledata', addLayer);
        }

        return () => {
            if (!map || (map as unknown as { _removed?: boolean })._removed) return;
            if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
            initialised.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, buildGeoJSON]);

    // Update data
    useEffect(() => {
        if (!map || !initialised.current) return;
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (src) src.setData(buildGeoJSON());
    }, [map, points, buildGeoJSON]);

    // Toggle visibility
    useEffect(() => {
        if (!map || !initialised.current) return;
        if (map.getLayer(LAYER_ID)) {
            map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        }
    }, [map, visible]);

    return null;
};

export default HeatmapLayer;
