import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AlertsComponent.css';

interface Alert {
    alert_id: number;
    device_id: number;
    alert_type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    acknowledged: boolean;
    created_at: string;
    device_name?: string;
}

export const AlertsComponent: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 10000); // Refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchAlerts = async () => {
        try {
            const res = await axios.get('http://197.242.150.120:5000/api/alerts?limit=100');
            
            // Enrich alerts with device names
            const devicesRes = await axios.get('http://197.242.150.120:5000/api/devices');
            const deviceMap = new Map(devicesRes.data.map((d: any) => [d.device_id, d.device_name]));

            const enrichedAlerts = res.data.map((alert: Alert) => ({
                ...alert,
                device_name: deviceMap.get(alert.device_id) || 'Unknown Device',
            }));

            setAlerts(enrichedAlerts);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching alerts:', err);
            setLoading(false);
        }
    };

    const acknowledgeAlert = async (alertId: number) => {
        try {
            await axios.put(`/api/alerts/${alertId}/acknowledge`);
            fetchAlerts();
        } catch (err) {
            console.error('Error acknowledging alert:', err);
        }
    };

    const getFilteredAlerts = () => {
        switch (filter) {
            case 'unacknowledged':
                return alerts.filter(a => !a.acknowledged);
            case 'critical':
                return alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
            default:
                return alerts;
        }
    };

    const filteredAlerts = getFilteredAlerts();

    return (
        <div className="alerts-container">
            <div className="alerts-header">
                <h2>🚨 Alerts & Notifications</h2>
                <div className="filter-buttons">
                    <button
                        className={filter === 'all' ? 'active' : ''}
                        onClick={() => setFilter('all')}
                    >
                        All ({alerts.length})
                    </button>
                    <button
                        className={filter === 'unacknowledged' ? 'active' : ''}
                        onClick={() => setFilter('unacknowledged')}
                    >
                        Unacknowledged ({alerts.filter(a => !a.acknowledged).length})
                    </button>
                    <button
                        className={filter === 'critical' ? 'active' : ''}
                        onClick={() => setFilter('critical')}
                    >
                        Critical ({alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length})
                    </button>
                </div>
            </div>

            {loading ? (
                <div>Loading alerts...</div>
            ) : filteredAlerts.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    ✅ No alerts
                </div>
            ) : (
                <div className="alerts-list">
                    {filteredAlerts.map(alert => (
                        <div key={alert.alert_id} className={`alert-card severity-${alert.severity}`}>
                            <div className="alert-content">
                                <div className="alert-header-info">
                                    <span className={`severity-badge ${alert.severity}`}>
                                        {alert.severity.toUpperCase()}
                                    </span>
                                    <h4>{alert.device_name}</h4>
                                    {!alert.acknowledged && <span className="new-badge">NEW</span>}
                                </div>
                                <p className="alert-type">{alert.alert_type}</p>
                                <p className="alert-message">{alert.message}</p>
                                <p className="alert-time">
                                    {new Date(alert.created_at).toLocaleString()}
                                </p>
                            </div>
                            {!alert.acknowledged && (
                                <button
                                    className="acknowledge-btn"
                                    onClick={() => acknowledgeAlert(alert.alert_id)}
                                >
                                    ✓ Acknowledge
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
