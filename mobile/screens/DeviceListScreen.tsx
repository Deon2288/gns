import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { fetchDevices, Device } from '../utils/api';
import { useWebSocket } from '../hooks/useWebSocket';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:5000';

const STATUS_COLORS: Record<string, string> = {
    active: '#22c55e',
    idle: '#eab308',
    offline: '#ef4444',
};

interface DeviceListScreenProps {
    navigation: any;
}

const DeviceListScreen: React.FC<DeviceListScreenProps> = ({ navigation }) => {
    const [devices, setDevices] = useState<Map<string, Device>>(new Map());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDevices = useCallback(async () => {
        try {
            const data = await fetchDevices();
            const map = new Map<string, Device>();
            data.forEach(d => map.set(d.id, d));
            setDevices(map);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load devices');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Update device info from WebSocket GPS updates
    const { status: wsStatus } = useWebSocket({
        url: WS_URL,
        onGpsUpdate: (data) => {
            setDevices(prev => {
                const next = new Map(prev);
                const existing = prev.get(data.device_id);
                const minutesSince = (Date.now() - new Date(data.timestamp).getTime()) / 60000;
                next.set(data.device_id, {
                    id: data.device_id,
                    name: existing?.name || `Device ${data.device_id}`,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    speed: data.speed,
                    status: minutesSince > 5 ? 'offline' : data.speed > 2 ? 'active' : 'idle',
                    lastUpdate: data.timestamp,
                });
                return next;
            });
        },
    });

    useEffect(() => {
        loadDevices();
    }, [loadDevices]);

    const deviceList = Array.from(devices.values());

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading devices…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* WS Status bar */}
            <View style={[styles.wsBar, { backgroundColor: wsStatus === 'connected' ? '#052e16' : '#1c0000' }]}>
                <View style={[styles.wsDot, { backgroundColor: wsStatus === 'connected' ? '#22c55e' : '#ef4444' }]} />
                <Text style={styles.wsText}>
                    {wsStatus === 'connected' ? 'Live updates active' : 'Reconnecting…'}
                </Text>
            </View>

            {error ? (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            <FlatList
                data={deviceList}
                keyExtractor={item => item.id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadDevices(); }}
                        tintColor="#3b82f6"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.centered}>
                        <Text style={styles.emptyText}>No devices found</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.deviceCard}
                        onPress={() => navigation.navigate('Map', { device: item })}
                    >
                        <View style={styles.deviceHeader}>
                            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status || 'offline'] }]} />
                            <Text style={styles.deviceName}>{item.name}</Text>
                        </View>
                        <View style={styles.deviceDetails}>
                            <Text style={styles.detailText}>ID: {item.id}</Text>
                            {item.speed !== undefined && (
                                <Text style={styles.detailText}>{item.speed} km/h</Text>
                            )}
                            {item.lastUpdate && (
                                <Text style={styles.detailTextMuted}>
                                    {new Date(item.lastUpdate).toLocaleTimeString()}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    loadingText: { color: '#9ca3af', marginTop: 12, fontSize: 14 },
    emptyText: { color: '#6b7280', fontSize: 14 },
    wsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        gap: 8,
    },
    wsDot: { width: 8, height: 8, borderRadius: 4 },
    wsText: { color: '#d1d5db', fontSize: 12 },
    errorBanner: { backgroundColor: '#450a0a', padding: 10, marginHorizontal: 12, borderRadius: 6, marginTop: 8 },
    errorText: { color: '#fca5a5', fontSize: 12 },
    deviceCard: {
        backgroundColor: '#1f2937',
        marginHorizontal: 12,
        marginTop: 10,
        borderRadius: 8,
        padding: 14,
        borderWidth: 1,
        borderColor: '#374151',
    },
    deviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    deviceName: { color: '#f9fafb', fontSize: 15, fontWeight: 'bold' },
    deviceDetails: { flexDirection: 'row', gap: 12 },
    detailText: { color: '#d1d5db', fontSize: 12 },
    detailTextMuted: { color: '#6b7280', fontSize: 12 },
});

export default DeviceListScreen;
