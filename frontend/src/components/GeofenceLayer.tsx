import React, { useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

export interface Geofence {
    id: string;
    name: string;
    /** GeoJSON polygon coordinates  [[[lng,lat], ...]] */
    coordinates: number[][][];
    fillColor?: string;
    strokeColor?: string;
    fillOpacity?: number;
}

interface GeofenceLayerProps {
    map: mapboxgl.Map | null;
    geofences: Geofence[];
    visible: boolean;
}

const SOURCE_ID = 'geofence-source';
const FILL_LAYER_ID = 'geofence-fill';
const LINE_LAYER_ID = 'geofence-line';
const LABEL_LAYER_ID = 'geofence-label';

/**
 * Renders geofence polygons (fill + stroke + label) onto a Mapbox GL map.
 * Manages its own source/layers and removes them on unmount.
 */
const GeofenceLayer: React.FC<GeofenceLayerProps> = ({ map, geofences, visible }) => {
    const initialised = useRef(false);

    const buildGeoJSON = useCallback((): GeoJSON.FeatureCollection => ({
        type: 'FeatureCollection',
        features: geofences.map((g) => ({
            type: 'Feature' as const,
            properties: {
                id: g.id,
                name: g.name,
                fillColor: g.fillColor ?? '#3b82f6',
                strokeColor: g.strokeColor ?? '#1d4ed8',
                fillOpacity: g.fillOpacity ?? 0.15,
            },
            geometry: {
                type: 'Polygon' as const,
                coordinates: g.coordinates,
            },
        })),
    }), [geofences]);

    useEffect(() => {
        if (!map) return;

        function addLayers() {
            if (!map) return;

            if (!map.getSource(SOURCE_ID)) {
                map.addSource(SOURCE_ID, { type: 'geojson', data: buildGeoJSON() });
            } else {
                (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(buildGeoJSON());
            }

            if (!map.getLayer(FILL_LAYER_ID)) {
                map.addLayer({
                    id: FILL_LAYER_ID,
                    type: 'fill',
                    source: SOURCE_ID,
                    paint: {
                        'fill-color': ['get', 'fillColor'],
                        'fill-opacity': ['get', 'fillOpacity'],
                    },
                });
            }

            if (!map.getLayer(LINE_LAYER_ID)) {
                map.addLayer({
                    id: LINE_LAYER_ID,
                    type: 'line',
                    source: SOURCE_ID,
                    paint: {
                        'line-color': ['get', 'strokeColor'],
                        'line-width': 2,
                    },
                });
            }

            if (!map.getLayer(LABEL_LAYER_ID)) {
                map.addLayer({
                    id: LABEL_LAYER_ID,
                    type: 'symbol',
                    source: SOURCE_ID,
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-size': 12,
                        'text-anchor': 'center',
                    },
                    paint: {
                        'text-color': '#1d4ed8',
                        'text-halo-color': '#fff',
                        'text-halo-width': 1.5,
                    },
                });
            }

            initialised.current = true;
        }

        if (map.isStyleLoaded()) {
            addLayers();
        } else {
            map.once('styledata', addLayers);
        }

        return () => {
            if (!map || (map as unknown as { _removed?: boolean })._removed) return;
            [LABEL_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID].forEach((id) => {
                if (map.getLayer(id)) map.removeLayer(id);
            });
            if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
            initialised.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, buildGeoJSON]);

    // Update data when geofences change
    useEffect(() => {
        if (!map || !initialised.current) return;
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (!src) return;
        src.setData(buildGeoJSON());
    }, [map, geofences, buildGeoJSON]);

    // Toggle visibility
    useEffect(() => {
        if (!map || !initialised.current) return;
        const vis = visible ? 'visible' : 'none';
        [FILL_LAYER_ID, LINE_LAYER_ID, LABEL_LAYER_ID].forEach((id) => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, 'visibility', vis);
            }
        });
    }, [map, visible]);

    return null;
};

export default GeofenceLayer;
