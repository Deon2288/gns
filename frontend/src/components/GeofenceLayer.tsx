import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

/** A single geofence polygon. */
export interface Geofence {
    id: string;
    name: string;
    /** Array of [longitude, latitude] coordinate pairs forming the polygon ring. */
    coordinates: Array<[number, number]>;
    fillColor?: string;
    strokeColor?: string;
}

interface GeofenceLayerProps {
    map: mapboxgl.Map | null;
    geofences: Geofence[];
    visible: boolean;
}

const FILL_SOURCE = 'geofence-fill-source';
const STROKE_SOURCE = 'geofence-stroke-source';
const FILL_LAYER = 'geofence-fill-layer';
const STROKE_LAYER = 'geofence-stroke-layer';

/** Convert a list of {@link Geofence} objects into a GeoJSON FeatureCollection. */
function buildGeoJson(
    geofences: Geofence[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
    return {
        type: 'FeatureCollection',
        features: geofences.map((gf) => ({
            type: 'Feature',
            id: gf.id,
            properties: {
                id: gf.id,
                name: gf.name,
                fillColor: gf.fillColor ?? '#ef4444',
                strokeColor: gf.strokeColor ?? '#b91c1c',
            },
            geometry: {
                type: 'Polygon',
                // Close the ring by repeating the first coordinate at the end
                coordinates: [[...gf.coordinates, gf.coordinates[0]]],
            },
        })),
    };
}

/**
 * Renderless React component that manages geofence polygon layers on a
 * Mapbox GL map instance.  Layers are added once and updated via
 * `setData` whenever the `geofences` prop changes.  The entire layer
 * pair is toggled with the `visible` prop.
 */
const GeofenceLayer: React.FC<GeofenceLayerProps> = ({ map, geofences, visible }) => {
    // Add sources & layers on first render
    useEffect(() => {
        if (!map) return;

        const geoJson = buildGeoJson(geofences);

        const addLayers = () => {
            if (!map.getSource(FILL_SOURCE)) {
                map.addSource(FILL_SOURCE, { type: 'geojson', data: geoJson });
            }
            if (!map.getSource(STROKE_SOURCE)) {
                map.addSource(STROKE_SOURCE, { type: 'geojson', data: geoJson });
            }
            if (!map.getLayer(FILL_LAYER)) {
                map.addLayer({
                    id: FILL_LAYER,
                    type: 'fill',
                    source: FILL_SOURCE,
                    paint: {
                        'fill-color': ['get', 'fillColor'],
                        'fill-opacity': 0.2,
                    },
                });
            }
            if (!map.getLayer(STROKE_LAYER)) {
                map.addLayer({
                    id: STROKE_LAYER,
                    type: 'line',
                    source: STROKE_SOURCE,
                    paint: {
                        'line-color': ['get', 'strokeColor'],
                        'line-width': 2,
                    },
                });
            }
        };

        if (map.isStyleLoaded()) {
            addLayers();
        } else {
            map.once('load', addLayers);
        }

        return () => {
            if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
            if (map.getLayer(STROKE_LAYER)) map.removeLayer(STROKE_LAYER);
            if (map.getSource(FILL_SOURCE)) map.removeSource(FILL_SOURCE);
            if (map.getSource(STROKE_SOURCE)) map.removeSource(STROKE_SOURCE);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    // Update source data when geofences change
    useEffect(() => {
        if (!map || !map.isStyleLoaded()) return;
        const src = map.getSource(FILL_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        const strokeSrc = map.getSource(STROKE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
        const geoJson = buildGeoJson(geofences);
        src?.setData(geoJson);
        strokeSrc?.setData(geoJson);
    }, [map, geofences]);

    // Toggle layer visibility
    useEffect(() => {
        if (!map || !map.isStyleLoaded()) return;
        const visibility = visible ? 'visible' : 'none';
        if (map.getLayer(FILL_LAYER)) map.setLayoutProperty(FILL_LAYER, 'visibility', visibility);
        if (map.getLayer(STROKE_LAYER)) map.setLayoutProperty(STROKE_LAYER, 'visibility', visibility);
    }, [map, visible]);

    return null;
};

export default GeofenceLayer;
