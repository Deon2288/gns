import React, { useState } from 'react';
import { formatDuration } from '../utils/analytics';

export interface Trip {
    id: number;
    device_id: string;
    start_time: string;
    end_time: string;
    distance: number;
    duration_minutes: number;
    average_speed: number;
    max_speed: number;
    waypoints?: { latitude: number; longitude: number; speed?: number; altitude?: number; timestamp?: string }[];
}

interface TripHistoryProps {
    trips: Trip[];
    onSelectTrip?: (trip: Trip) => void;
    onExportCsv?: (tripId: number) => void;
    deviceFilter?: string;
}

/**
 * TripHistory displays a list of device trips with filtering and export options.
 */
const TripHistory: React.FC<TripHistoryProps> = ({ trips, onSelectTrip, onExportCsv, deviceFilter }) => {
    const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filtered = trips.filter(t => {
        if (deviceFilter && t.device_id !== deviceFilter) return false;
        if (dateFrom && new Date(t.start_time) < new Date(dateFrom)) return false;
        if (dateTo && new Date(t.end_time) > new Date(dateTo)) return false;
        return true;
    });

    const handleTripClick = (trip: Trip) => {
        setSelectedTripId(trip.id);
        onSelectTrip?.(trip);
    };

    return (
        <div style={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px',
            color: '#f9fafb',
            fontFamily: 'sans-serif',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
                🗺️ Trip History
            </h3>

            {/* Date filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        style={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            color: '#d1d5db',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                        }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <label style={{ fontSize: '11px', color: '#9ca3af' }}>To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        style={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            color: '#d1d5db',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                        }}
                    />
                </div>
                {(dateFrom || dateTo) && (
                    <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        style={{
                            backgroundColor: 'transparent',
                            border: '1px solid #374151',
                            color: '#9ca3af',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            alignSelf: 'flex-end',
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px', fontSize: '14px' }}>
                        No trips found
                    </div>
                ) : (
                    filtered.map(trip => (
                        <div
                            key={trip.id}
                            onClick={() => handleTripClick(trip)}
                            style={{
                                backgroundColor: selectedTripId === trip.id ? '#1e3a5f' : '#1f2937',
                                border: `1px solid ${selectedTripId === trip.id ? '#3b82f6' : '#374151'}`,
                                borderRadius: '6px',
                                padding: '10px 12px',
                                marginBottom: '8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                transition: 'background-color 0.15s',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <strong style={{ color: '#60a5fa' }}>Trip #{trip.id}</strong>
                                    <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '11px' }}>
                                        Device {trip.device_id}
                                    </span>
                                </div>
                                {onExportCsv && (
                                    <button
                                        onClick={e => { e.stopPropagation(); onExportCsv(trip.id); }}
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: '1px solid #374151',
                                            color: '#9ca3af',
                                            borderRadius: '4px',
                                            padding: '2px 6px',
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ↓ CSV
                                    </button>
                                )}
                            </div>
                            <div style={{ marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap', color: '#d1d5db' }}>
                                <span>📍 {trip.distance} km</span>
                                <span>⏱ {formatDuration(trip.duration_minutes)}</span>
                                <span>⚡ avg {trip.average_speed} km/h</span>
                                <span>🏎 max {trip.max_speed} km/h</span>
                            </div>
                            <div style={{ marginTop: '4px', color: '#6b7280', fontSize: '11px' }}>
                                {new Date(trip.start_time).toLocaleString()} → {new Date(trip.end_time).toLocaleString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TripHistory;
