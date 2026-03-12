import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type DeviceStatus = 'active' | 'idle' | 'offline';

interface DeviceMarkerProps {
    status?: DeviceStatus;
    label?: string;
}

const STATUS_COLORS: Record<DeviceStatus, string> = {
    active: '#22c55e',
    idle: '#eab308',
    offline: '#ef4444',
};

/**
 * DeviceMarker is a small map pin/callout used on the React Native map screen.
 */
const DeviceMarker: React.FC<DeviceMarkerProps> = ({ status = 'offline', label }) => {
    const color = STATUS_COLORS[status] || '#6b7280';
    return (
        <View style={styles.container}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            {label ? <Text style={styles.label}>{label}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff',
    },
    label: {
        fontSize: 10,
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 4,
        borderRadius: 4,
        marginTop: 2,
    },
});

export default DeviceMarker;
