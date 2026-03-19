import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import DeviceForm from './DeviceForm';
import './MapContainer.css';

let mapboxgl: any;
try {
    mapboxgl = require('mapbox-gl');
    require('mapbox-gl/dist/mapbox-gl.css');
} catch (e) {
    console.warn('Mapbox GL not available, using fallback');
}

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
if (mapboxgl && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
}

interface Device {
    device_id: number;
    imei: string;
    device_name: string;
    [key: string]: any;
}

interface GPSData {
    device_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface DeviceLocation {
    device_id: number;
    imei: string;
    device_name: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    route: [number, number][];
}

const API_BASE = '${REACT_APP_API_URL}';

export const MapView: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const markersRef = useRef<Map<number, any>>(new Map());
    const routeLinesRef = useRef<Map<number, string>>(new Map());
    const sourceIdsRef = useRef<Set<string>>(new Set());

    const [devices, setDevices] = useState<DeviceLocation[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [mapStyle, setMapStyle] = useState('streets-v12');

    const fetchData = useCallback(async () => {
        try {
            console.log('🔄 Starting data fetch...');

            const devicesRes = await axios.get(`${API_BASE}/api/devices`, {
                headers: { 'Accept': 'application/json' }
            });
            console.log('✅ Devices response:', devicesRes.data);

            if (!devicesRes.data || devicesRes.data.length === 0) {
                setDevices([]);
                return;
            }

            const gpsRes = await axios.get(`${API_BASE}/api/gps/latest?limit=100`, {
                headers: { 'Accept': 'application/json' }
            });
            console.log('✅ GPS response:', gpsRes.data);

            const devicesMap = new Map((devicesRes.data as Device[]).map((d: Device) => [d.device_id, d]));
            const groupedGPS = new Map<number, GPSData[]>();

            (gpsRes.data as GPSData[]).forEach((gps: GPSData) => {
                if (!groupedGPS.has(gps.device_id)) {
                    groupedGPS.set(gps.device_id, []);
                }
                groupedGPS.get(gps.device_id)!.push(gps);
            });

            const deviceLocations: DeviceLocation[] = Array.from(devicesMap.entries())
                .map(([deviceId, device]) => {
                    const gpsList = groupedGPS.get(deviceId) || [];
                    const latest = gpsList[0] || {
                        latitude: 0,
                        longitude: 0,
                        timestamp: new Date().toISOString()
                    };
                    const route = gpsList
                        .slice(0, 50)
                        .reverse()
                        .map(g => [g.latitude, g.longitude] as [number, number]);

                    return {
                        device_id: device.device_id,
                        imei: device.imei,
                        device_name: device.device_name,
                        latitude: latest.latitude,
                        longitude: latest.longitude,
                        timestamp: latest.timestamp,
                        route,
                    };
                });

            console.log('🚗 Final device locations:', deviceLocations);
            setDevices(deviceLocations);
            setError(null);

            if (map.current && deviceLocations.length > 0) {
                updateMapMarkers(deviceLocations);
            }

        } catch (err: any) {
            console.error('❌ Error:', err);
            const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
            setError(errorMsg);
        }
    }, []);

    const updateMapMarkers = (locations: DeviceLocation[]) => {
        if (!map.current || !mapboxgl) return;

        // Remove old markers
        markersRef.current.forEach((marker: any) => marker.remove());
        markersRef.current.clear();

        // Remove old route lines and sources
        routeLinesRef.current.forEach((lineId: string) => {
            try {
                if (map.current?.getLayer(lineId)) {
                    map.current.removeLayer(lineId);
                }
                const sourceId = `route-source-${lineId.split('-')[1]}`;
                if (map.current?.getSource(sourceId)) {
                    map.current.removeSource(sourceId);
                }
            } catch (e) {
                console.warn('Error removing old route:', e);
            }
        });
        routeLinesRef.current.clear();
        sourceIdsRef.current.clear();

        const bounds = new mapboxgl.LngLatBounds();

        locations.forEach((device: DeviceLocation) => {
            if (device.latitude === 0 && device.longitude === 0) return;

            // Create marker element
            const el = document.createElement('div');
            el.style.width = '32px';
            el.style.height = '32px';
            el.style.backgroundImage = 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><circle cx=%2216%22 cy=%2216%22 r=%2214%22 fill=%22%2322c55e%22 stroke=%22white%22 stroke-width=%222%22/></svg>")';
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            el.style.cursor = 'pointer';

            // Create popup
            const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
                <div style="max-width: 250px; padding: 8px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px;">🚗 ${device.device_name}</h4>
                    <p style="margin: 4px 0; font-size: 12px;"><strong>IMEI:</strong> ${device.imei}</p>
                    <p style="margin: 4px 0; font-size: 12px;"><strong>Location:</strong> ${device.latitude.toFixed(4)}, ${device.longitude.toFixed(4)}</p>
                    <p style="margin: 4px 0; font-size: 12px;"><strong>Updated:</strong> ${new Date(device.timestamp).toLocaleString()}</p>
                </div>
            `);

            // Add marker
            const marker = new mapboxgl.Marker(el)
                .setLngLat([device.longitude, device.latitude])
                .setPopup(popup)
                .addTo(map.current);

            markersRef.current.set(device.device_id, marker);
            bounds.extend([device.longitude, device.latitude]);

            // Add route line
            if (device.route.length > 1) {
                const lineId = `route-${device.device_id}`;
                const sourceId = `route-source-${device.device_id}`;

                // Only add if not already exists
                if (!sourceIdsRef.current.has(sourceId)) {
                    try {
                        map.current.addSource(sourceId, {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: device.route.map(([lat, lng]) => [lng, lat])
                                },
                                properties: {}
                            }
                        });

                        map.current.addLayer({
                            id: lineId,
                            type: 'line',
                            source: sourceId,
                            paint: {
                                'line-color': '#3b82f6',
                                'line-width': 2,
                                'line-opacity': 0.5,
                                'line-dasharray': [4, 4]
                            }
                        });

                        sourceIdsRef.current.add(sourceId);
                        routeLinesRef.current.set(device.device_id, lineId);
                    } catch (e) {
                        console.warn('Error adding route for device', device.device_id, e);
                    }
                }
            }
        });

        // Fit bounds
        if (!bounds.isEmpty()) {
            map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }
    };

    const handleAddDevice = async (device: { device_name: string; imei: string; status: string }) => {
        try {
            console.log('➕ Adding device:', device);
            await axios.post(`${API_BASE}/api/devices`, {
                device_name: device.device_name,
                imei: device.imei,
                status: device.status,
                user_id: 1,
            });
            alert('✅ Device added successfully!');
            setShowForm(false);
            fetchData();
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to add device';
            alert('❌ ' + errorMsg);
        }
    };

    const handleDeleteDevice = async (deviceId: number) => {
        if (!window.confirm('Are you sure you want to delete this device?')) {
            return;
        }
        try {
            await axios.delete(`${API_BASE}/api/devices/${deviceId}`);
            alert('✅ Device deleted successfully!');
            fetchData();
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to delete device';
            alert('❌ ' + errorMsg);
        }
    };

    // Initialize map
    useEffect(() => {
        if (!mapboxgl) {
            setError('Mapbox GL not available. Install mapbox-gl package.');
            return;
        }

        if (!MAPBOX_TOKEN) {
            setError('Mapbox token not configured. Set REACT_APP_MAPBOX_TOKEN env var.');
            return;
        }

        if (map.current) return;

        if (mapContainer.current) {
            try {
                map.current = new mapboxgl.Map({
                    container: mapContainer.current,
                    style: `mapbox://styles/mapbox/${mapStyle}`,
                    center: [20, 0],
                    zoom: 2
                });

                map.current.addControl(new mapboxgl.NavigationControl());
                map.current.on('load', () => {
                    fetchData();
                });
            } catch (err) {
                console.error('Map init error:', err);
                setError('Failed to initialize map');
            }
        }

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [fetchData]);

    // Update map style
    useEffect(() => {
        if (map.current) {
            map.current.setStyle(`mapbox://styles/mapbox/${mapStyle}`);
        }
    }, [mapStyle]);

    // Fetch data periodically
    useEffect(() => {
        if (!map.current) return;
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (error && error.includes('token')) {
        return (
            <div className="map-wrapper">
                <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
                    <h3>❌ {error}</h3>
                </div>
            </div>
        );
    }

    return (
        <div className="map-wrapper">
            <div className="map-header">
                <h2>📍 Live Vehicle Tracking</h2>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={mapStyle}
                        onChange={(e) => setMapStyle(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            fontSize: '14px'
                        }}
                    >
                        <option value="streets-v12">Streets</option>
                        <option value="outdoors-v12">Outdoors</option>
                        <option value="light-v11">Light</option>
                        <option value="dark-v11">Dark</option>
                        <option value="satellite-v9">Satellite</option>
                        <option value="satellite-streets-v12">Satellite Streets</option>
                    </select>
                    <div className="device-count">{devices.length} Devices</div>
                    <button
                        onClick={() => fetchData()}
                        style={{
                            background: 'rgba(255,255,255,0.7)',
                            color: '#667eea',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        🔄 Refresh
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        style={{
                            background: 'rgba(255,255,255,0.9)',
                            color: '#667eea',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        {showForm ? '✖️ Close' : '➕ Add Device'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div style={{ padding: '20px', background: '#fff3cd', borderBottom: '2px solid #ffc107' }}>
                    <DeviceForm onAddDevice={handleAddDevice} />
                </div>
            )}

            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                <div ref={mapContainer} style={{ flex: 1, minHeight: '600px', background: '#f0f0f0' }} />

                <div style={{
                    width: '350px',
                    background: '#f5f7fa',
                    overflow: 'auto',
                    padding: '20px',
                    borderLeft: '1px solid #e0e0e0',
                    maxHeight: '800px'
                }}>
                    <h3>Devices ({devices.length})</h3>
                    {devices.length === 0 ? (
                        <p>No devices with GPS data</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {devices.map(device => (
                                <div key={device.device_id} style={{
                                    background: 'white',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    transition: 'box-shadow 0.2s'
                                }} onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                                }} onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                                }} onClick={() => {
                                    if (map.current) {
                                        map.current.flyTo({
                                            center: [device.longitude, device.latitude],
                                            zoom: 13,
                                            duration: 1000
                                        });
                                        const marker = markersRef.current.get(device.device_id);
                                        if (marker) {
                                            marker.togglePopup();
                                        }
                                    }
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '6px' }}>
                                        <strong>🚗 {device.device_name}</strong>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteDevice(device.device_id);
                                            }}
                                            style={{
                                                background: '#ff6b6b',
                                                color: 'white',
                                                border: 'none',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontSize: '11px'
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                    <p style={{ margin: '2px 0' }}><strong>IMEI:</strong> {device.imei}</p>
                                    <p style={{ margin: '2px 0' }}><strong>Lat:</strong> {device.latitude.toFixed(4)}</p>
                                    <p style={{ margin: '2px 0' }}><strong>Lng:</strong> {device.longitude.toFixed(4)}</p>
                                    <p style={{ margin: '2px 0', color: '#666' }}>{new Date(device.timestamp).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="map-legend">
                <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#22c55e' }}></div>
                    <span>Device Marker</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
                    <span>Route Trail</span>
                </div>
            </div>
        </div>
    );
};
