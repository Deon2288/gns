import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AlertsPanel.css';

interface Alert {
    alert_id: number;
    device_id: number;
    alert_type: string;
    severity: string;
    message: string;
    latitude: number;
    longitude: number;
    acknowledged: boolean;
    created_at: string;
}

export const AlertsPanel: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const res = await axios.get('${REACT_APP_API_URL}/api/alerts?limit=50');
                setAlerts(res.data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching alerts:', err);
                setLoading(false);
            }
        };

        fetchAlerts();
        const interval = setInterval(fetchAlerts, 10000); // Update every 10 seconds

        return () => clearInterval(interval);
    }, []);

    const handleAcknowledge = async (alertId: number) => {
        try {
            await axios.put(`/api/alerts/${alertId}/acknowledge`);
            setAlerts(alerts.map(a => a.alert_id === alertId ? { ...a, acknowledged: true } : a));
        } catch (err) {
            console.error('Error acknowledging alert:', err);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return '#dc2626';
            case 'high': return '#f59e0b';
            case 'medium': return '#eab308';
            case 'low': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'speed': return '⚡';
            case 'geofence': return '🗺️';
            case 'offline': return '📡';
            case 'battery': return '🔋';
            case 'acceleration': return '🚗';
            default: return '⚠️';
        }
    };

    if (loading) {
        return <div className="alerts-loading">Loading alerts...</div>;
    }

    return (
        <div className="alerts-panel">
            <h2>🚨 Device Alerts</h2>
            <div className="alerts-count">
                {alerts.filter(a => !a.acknowledged).length} Active
            </div>

            <div className="alerts-list">
                {alerts.length === 0 ? (
                    <div className="no-alerts">No alerts at this time</div>
                ) : (
                    alerts.map(alert => (
                        <div
                            key={alert.alert_id}
                            className="alert-item"
                            style={{
                                borderLeftColor: getSeverityColor(alert.severity),
                                opacity: alert.acknowledged ? 0.6 : 1,
                            }}
                        >
                            <div className="alert-header">
                                <span className="alert-icon">{getAlertIcon(alert.alert_type)}</span>
                                <span className="alert-type">{alert.alert_type.toUpperCase()}</span>
                                <span
                                    className="alert-severity"
                                    style={{ backgroundColor: getSeverityColor(alert.severity) }}
                                >
                                    {alert.severity}
                                </span>
                                {alert.acknowledged && <span className="alert-ack">✓ ACK</span>}
                            </div>
                            <p className="alert-message">{alert.message}</p>
                            <div className="alert-footer">
                                <span className="alert-time">
                                    {new Date(alert.created_at).toLocaleString()}
                                </span>
                                {!alert.acknowledged && (
                                    <button
                                        className="alert-btn"
                                        onClick={() => handleAcknowledge(alert.alert_id)}
                                    >
                                        Acknowledge
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
