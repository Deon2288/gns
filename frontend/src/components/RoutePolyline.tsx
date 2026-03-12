import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const HISTORY_LIMIT = 50;

interface GpsPoint {
    gps_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface RoutePolylineProps {
    deviceId: number;
    color?: string;
}

const RoutePolyline: React.FC<RoutePolylineProps> = ({ deviceId, color = '#3b82f6' }) => {
    const [points, setPoints] = useState<[number, number][]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/api/gps/history/${deviceId}?limit=${HISTORY_LIMIT}`
                );
                if (!res.ok) return;
                const data: GpsPoint[] = await res.json();
                // API returns newest first; reverse to draw oldest → newest
                const coords: [number, number][] = data
                    .slice()
                    .reverse()
                    .map((p) => [p.latitude, p.longitude]);
                setPoints(coords);
            } catch {
                // silently ignore network errors
            }
        };

        fetchHistory();
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, [deviceId]);

    if (points.length < 2) return null;

    return (
        <Polyline
            positions={points}
            pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: '6 4' }}
        />
    );
};

export default RoutePolyline;
