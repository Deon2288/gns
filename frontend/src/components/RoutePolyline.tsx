import React from 'react';
import { Polyline, Tooltip } from 'react-leaflet';

interface GpsPoint {
    latitude: number;
    longitude: number;
    speed?: number;
    timestamp?: string;
}

interface RoutePolylineProps {
    points: GpsPoint[];
    color?: string;
    weight?: number;
    opacity?: number;
    maxPoints?: number;
}

/**
 * RoutePolyline renders the GPS history trail for a device on a Leaflet map.
 * Displays the last `maxPoints` positions (default 50).
 */
const RoutePolyline: React.FC<RoutePolylineProps> = ({
    points,
    color = '#3b82f6',
    weight = 3,
    opacity = 0.7,
    maxPoints = 50,
}) => {
    const trail = points.slice(-maxPoints);
    if (trail.length < 2) return null;

    const positions: [number, number][] = trail.map(p => [p.latitude, p.longitude]);

    return (
        <Polyline
            positions={positions}
            pathOptions={{ color, weight, opacity }}
        >
            <Tooltip sticky>
                {trail.length} GPS points | Route trail
            </Tooltip>
        </Polyline>
    );
};

export default RoutePolyline;
