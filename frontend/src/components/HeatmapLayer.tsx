import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

export interface HeatmapPoint {
    longitude: number;
    latitude: number;
    /** Optional intensity weight (0–1). Defaults to 1 if omitted. */
    weight?: number;
}

interface HeatmapLayerProps {
    map: mapboxgl.Map | null;
    points: HeatmapPoint[];
    visible: boolean;
}

const HEATMAP_SOURCE = 'heatmap-source';
const HEATMAP_LAYER = 'heatmap-layer';

function buildGeoJson(
    points: HeatmapPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
    return {
        type: 'FeatureCollection',
        features: points.map((p) => ({
            type: 'Feature',
            properties: { weight: p.weight ?? 1 },
            geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        })),
    };
}

/**
 * Renderless component that adds a heatmap layer to a Mapbox GL map.
 * The heatmap visualises device activity concentration using the supplied
 * point data.  Layer visibility is controlled by the `visible` prop.
 */
const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ map, points, visible }) => {
    // Add source & layer on mount
    useEffect(() => {
        if (!map) return;

        const geoJson = buildGeoJson(points);

        const addLayer = () => {
            if (!map.getSource(HEATMAP_SOURCE)) {
                map.addSource(HEATMAP_SOURCE, { type: 'geojson', data: geoJson });
            }
            if (!map.getLayer(HEATMAP_LAYER)) {
                map.addLayer({
                    id: HEATMAP_LAYER,
                    type: 'heatmap',
                    source: HEATMAP_SOURCE,
                    paint: {
                        // Increase weight as the 'weight' property increases
                        'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
                        // Colour ramp: cool → warm
                        'heatmap-color': [
                            'interpolate',
                            ['linear'],
                            ['heatmap-density'],
                            0,   'rgba(33,102,172,0)',
                            0.2, 'rgb(103,169,207)',
                            0.4, 'rgb(209,229,240)',
                            0.6, 'rgb(253,219,199)',
                            0.8, 'rgb(239,138,98)',
                            1,   'rgb(178,24,43)',
                        ],
                        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
                        'heatmap-opacity': 0.75,
                    },
                });
            }
        };

        if (map.isStyleLoaded()) {
            addLayer();
        } else {
            map.once('load', addLayer);
        }

        return () => {
            if (map.getLayer(HEATMAP_LAYER)) map.removeLayer(HEATMAP_LAYER);
            if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    // Update data when points change
    useEffect(() => {
        if (!map || !map.isStyleLoaded()) return;
        const src = map.getSource(HEATMAP_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        src?.setData(buildGeoJson(points));
    }, [map, points]);

    // Toggle visibility
    useEffect(() => {
        if (!map || !map.isStyleLoaded()) return;
        if (map.getLayer(HEATMAP_LAYER)) {
            map.setLayoutProperty(HEATMAP_LAYER, 'visibility', visible ? 'visible' : 'none');
        }
    }, [map, visible]);

    return null;
};

export default HeatmapLayer;
