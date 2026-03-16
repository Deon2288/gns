import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useWebSocket, GpsUpdate } from '../hooks/useWebSocket';
import DeviceMarker from '../components/DeviceMarker';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:5000';

interface MapScreenProps {
    route?: { params?: { device?: { id: string; name: string; latitude?: number; longitude?: number } } };
}

interface GpsPoint {
    latitude: number;
    longitude: number;
}

/**
 * MapScreen shows the live location of a device on a native map with route trail.
 */
const MapScreen: React.FC<MapScreenProps> = ({ route }) => {
    const initialDevice = route?.params?.device;

    const [devicePositions, setDevicePositions] = useState<Map<string, GpsUpdate>>(new Map());
    const [routeTrails, setRouteTrails] = useState<Map<string, GpsPoint[]>>(new Map());
    const [ready, setReady] = useState(false);

    const handleGpsUpdate = useCallback((data: GpsUpdate) => {
        setDevicePositions(prev => new Map(prev).set(data.device_id, data));
        setRouteTrails(prev => {
            const next = new Map(prev);
            const pts = [...(prev.get(data.device_id) || []), { latitude: data.latitude, longitude: data.longitude }];
            if (pts.length > 50) pts.splice(0, pts.length - 50);
            next.set(data.device_id, pts);
            return next;
        });
        if (!ready) setReady(true);
    }, [ready]);

    const { status: wsStatus } = useWebSocket({
        url: WS_URL,
        onGpsUpdate: handleGpsUpdate,
    });

    const focusDevice = initialDevice
        ? devicePositions.get(initialDevice.id)
        : undefined;

    const initialRegion = focusDevice
        ? { latitude: focusDevice.latitude, longitude: focusDevice.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        : initialDevice?.latitude && initialDevice?.longitude
            ? { latitude: initialDevice.latitude, longitude: initialDevice.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : { latitude: 0, longitude: 0, latitudeDelta: 90, longitudeDelta: 90 };

    const devicesToShow = initialDevice
        ? [devicePositions.get(initialDevice.id)].filter(Boolean) as GpsUpdate[]
        : Array.from(devicePositions.values());

    return (
        <View style={styles.container}>
            {/* WS status bar */}
            <View style={[styles.statusBar, { backgroundColor: wsStatus === 'connected' ? '#052e16' : '#1c0000' }]}>
                <View style={[styles.statusDot, { backgroundColor: wsStatus === 'connected' ? '#22c55e' : '#ef4444' }]} />
                <Text style={styles.statusText}>
                    {wsStatus === 'connected' ? `Live — ${devicesToShow.length} device(s)` : 'Reconnecting…'}
                </Text>
            </View>

            {!ready && wsStatus === 'connecting' && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Waiting for GPS data…</Text>
                </View>
            )}

            <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion}
                showsUserLocation={false}
                showsCompass
                showsScale
            >
                {devicesToShow.map(device => {
                    const minutesSince = (Date.now() - new Date(device.timestamp).getTime()) / 60000;
                    const status = minutesSince > 5 ? 'offline' : device.speed > 2 ? 'active' : 'idle';
                    const trail = routeTrails.get(device.device_id) || [];

                    return (
                        <React.Fragment key={device.device_id}>
                            {trail.length >= 2 && (
                                <Polyline
                                    coordinates={trail}
                                    strokeColor="#3b82f6"
                                    strokeWidth={3}
                                    lineDashPattern={[1]}
                                />
                            )}
                            <Marker
                                coordinate={{ latitude: device.latitude, longitude: device.longitude }}
                                title={`Device ${device.device_id}`}
                                description={`Speed: ${device.speed} km/h | Alt: ${device.altitude} m`}
                            >
                                <DeviceMarker status={status} label={device.device_id} />
                            </Marker>
                        </React.Fragment>
                    );
                })}
            </MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    map: { flex: 1 },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        gap: 8,
        zIndex: 10,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { color: '#d1d5db', fontSize: 12 },
    loadingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15,23,42,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
});

export default MapScreen;
