import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = (window as any).REACT_APP_MAPBOX_TOKEN || '';

interface DeviceLocation {
    device_id: number;
    device_name: string;
    latitude: number;
    longitude: number;
    status: string;
    timestamp?: string;
}

interface MapContainerProps {
    devices: DeviceLocation[];
    center?: [number, number];
    zoom?: number;
    style?: React.CSSProperties;
}

const DEFAULT_CENTER: [number, number] = [28.0339, -26.2041]; // Johannesburg, ZA
const DEFAULT_ZOOM = 10;

const MapContainer: React.FC<MapContainerProps> = ({
    devices,
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM,
    style,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const sourcesRef = useRef<Set<string>>(new Set());
    const layersRef = useRef<Set<string>>(new Set());

    /* ── Helpers to safely add/remove sources and layers ── */

    const safeRemoveLayer = useCallback((map: mapboxgl.Map, id: string) => {
        if (layersRef.current.has(id)) {
            try {
                if (map.getLayer(id)) {
                    map.removeLayer(id);
                }
            } catch (_) { /* ignore */ }
            layersRef.current.delete(id);
        }
    }, []);

    const safeRemoveSource = useCallback((map: mapboxgl.Map, id: string) => {
        if (sourcesRef.current.has(id)) {
            try {
                if (map.getSource(id)) {
                    map.removeSource(id);
                }
            } catch (_) { /* ignore */ }
            sourcesRef.current.delete(id);
        }
    }, []);

    const safeAddSource = useCallback(
        (map: mapboxgl.Map, id: string, data: mapboxgl.AnySourceData) => {
            // Remove existing source/layer before re-adding to prevent duplicate ID errors
            safeRemoveLayer(map, `${id}-layer`);
            safeRemoveSource(map, id);

            try {
                map.addSource(id, data);
                sourcesRef.current.add(id);
            } catch (err) {
                console.warn(`MapContainer: could not add source "${id}":`, err);
            }
        },
        [safeRemoveLayer, safeRemoveSource]
    );

    const safeAddLayer = useCallback(
        (map: mapboxgl.Map, layer: mapboxgl.AnyLayer) => {
            const id = (layer as { id: string }).id;
            safeRemoveLayer(map, id);
            try {
                map.addLayer(layer);
                layersRef.current.add(id);
            } catch (err) {
                console.warn(`MapContainer: could not add layer "${id}":`, err);
            }
        },
        [safeRemoveLayer]
    );

    /* ── Clear all markers ── */
    const clearMarkers = useCallback(() => {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
    }, []);

    /* ── Draw device markers and route line ── */
    const renderDevices = useCallback(
        (map: mapboxgl.Map, deviceList: DeviceLocation[]) => {
            clearMarkers();

            deviceList.forEach((device) => {
                const el = document.createElement('div');
                el.className = 'map-marker';
                el.style.cssText = `
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
                    background: ${device.status === 'online' || device.status === 'active' ? '#48bb78' : '#fc8181'};
                    cursor: pointer;
                `;

                const popup = new mapboxgl.Popup({ offset: 18, closeButton: false })
                    .setHTML(
                        `<div style="font-size:13px;line-height:1.5">
                            <strong>${device.device_name}</strong><br/>
                            Status: <em>${device.status}</em><br/>
                            ${device.timestamp ? `Last seen: ${new Date(device.timestamp).toLocaleString()}<br/>` : ''}
                            ${device.latitude.toFixed(5)}, ${device.longitude.toFixed(5)}
                        </div>`
                    );

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([device.longitude, device.latitude])
                    .setPopup(popup)
                    .addTo(map);

                markersRef.current.push(marker);
            });

            // Draw route line through all device positions
            if (deviceList.length > 1) {
                const sourceId = 'device-route';
                const coordinates = deviceList.map((d) => [d.longitude, d.latitude] as [number, number]);

                safeAddSource(map, sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates },
                    },
                });

                safeAddLayer(map, {
                    id: `${sourceId}-layer`,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': '#4299e1', 'line-width': 2, 'line-opacity': 0.6 },
                });
            }
        },
        [clearMarkers, safeAddSource, safeAddLayer]
    );

    /* ── Initialise map once ── */
    useEffect(() => {
        if (!containerRef.current) return;

        const map = new mapboxgl.Map({
            container: containerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center,
            zoom,
        });

        mapRef.current = map;

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

        map.on('load', () => {
            renderDevices(map, devices);
        });

        return () => {
            clearMarkers();
            layersRef.current.forEach((id) => {
                try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) { /* ignore */ }
            });
            sourcesRef.current.forEach((id) => {
                try { if (map.getSource(id)) map.removeSource(id); } catch (_) { /* ignore */ }
            });
            layersRef.current.clear();
            sourcesRef.current.clear();
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Re-render devices when data changes ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (map.loaded()) {
            renderDevices(map, devices);
        } else {
            map.once('load', () => renderDevices(map, devices));
        }
    }, [devices, renderDevices]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%', minHeight: '400px', ...style }}
        />
    );
};

export default MapContainer;
