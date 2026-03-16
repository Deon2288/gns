import React, { useState } from 'react';
import { AlertMessage } from '../hooks/useWebSocket';

interface AlertsPanelProps {
    alerts: AlertMessage[];
    onAcknowledge?: (alertIndex: number) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
    critical: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
};

const TYPE_ICONS: Record<string, string> = {
    speed: '🚨',
    offline: '📴',
    battery: '🔋',
    geofence_enter: '📍',
    geofence_exit: '🚪',
    harsh_acceleration: '⚡',
    harsh_braking: '🛑',
};

/**
 * AlertsPanel displays a list of GPS device alerts with acknowledgment support.
 */
const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, onAcknowledge }) => {
    const [filter, setFilter] = useState<string>('all');

    const filtered = filter === 'all'
        ? alerts
        : alerts.filter(a => a.severity === filter || a.type === filter);

    return (
        <div style={{
            backgroundColor: '#111827',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '16px',
            color: '#f9fafb',
            fontFamily: 'sans-serif',
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                    🔔 Alerts
                    {alerts.length > 0 && (
                        <span style={{
                            marginLeft: '8px',
                            backgroundColor: '#ef4444',
                            borderRadius: '10px',
                            padding: '2px 7px',
                            fontSize: '12px',
                        }}>
                            {alerts.length}
                        </span>
                    )}
                </h3>
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        color: '#d1d5db',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '12px',
                    }}
                >
                    <option value="all">All</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                    <option value="speed">Speed</option>
                    <option value="offline">Offline</option>
                    <option value="geofence_enter">Geofence</option>
                </select>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '24px', fontSize: '14px' }}>
                        ✅ No alerts
                    </div>
                ) : (
                    filtered.map((alert, index) => (
                        <div
                            key={index}
                            style={{
                                backgroundColor: '#1f2937',
                                border: `1px solid ${SEVERITY_COLORS[alert.severity] || '#374151'}`,
                                borderLeft: `4px solid ${SEVERITY_COLORS[alert.severity] || '#374151'}`,
                                borderRadius: '6px',
                                padding: '10px 12px',
                                marginBottom: '8px',
                                fontSize: '13px',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <span style={{ marginRight: '6px' }}>
                                        {TYPE_ICONS[alert.type] || '⚠️'}
                                    </span>
                                    <strong style={{ color: SEVERITY_COLORS[alert.severity] || '#f9fafb' }}>
                                        {alert.type.replace(/_/g, ' ').toUpperCase()}
                                    </strong>
                                    <span style={{ marginLeft: '8px', color: '#9ca3af', fontSize: '11px' }}>
                                        Device {alert.device_id}
                                    </span>
                                </div>
                                {onAcknowledge && (
                                    <button
                                        onClick={() => onAcknowledge(index)}
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
                                        ✓ Ack
                                    </button>
                                )}
                            </div>
                            <div style={{ marginTop: '4px', color: '#d1d5db' }}>{alert.message}</div>
                            <div style={{ marginTop: '4px', color: '#6b7280', fontSize: '11px' }}>
                                {new Date(alert.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AlertsPanel;
