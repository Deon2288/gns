import React, { useEffect, useState } from 'react';

interface NotificationConfig {
    email_on_scan_complete: boolean;
    email_on_new_devices: boolean;
    new_device_threshold: number;
    email_on_registration: boolean;
    email_on_failure: boolean;
    recipients: string[];
    reply_to: string;
}

interface NotificationLog {
    notification_id: string;
    event_type: string;
    recipients: string[];
    subject: string;
    status: string;
    sent_at: string;
}

const NotificationSettings: React.FC = () => {
    const [config, setConfig] = useState<NotificationConfig>({
        email_on_scan_complete: true,
        email_on_new_devices: true,
        new_device_threshold: 1,
        email_on_registration: true,
        email_on_failure: true,
        recipients: [],
        reply_to: 'noreply@gns.example.com',
    });
    const [history, setHistory] = useState<NotificationLog[]>([]);
    const [newRecipient, setNewRecipient] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');

    useEffect(() => {
        fetch('/api/discovery/notifications/config')
            .then(r => r.json())
            .then(setConfig)
            .catch(() => {});

        fetch('/api/discovery/notifications/history')
            .then(r => r.json())
            .then(setHistory)
            .catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await fetch('/api/discovery/notifications/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            setSavedMsg('✅ Configuration saved');
            setTimeout(() => setSavedMsg(''), 3000);
        } catch {
            setSavedMsg('❌ Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const addRecipient = () => {
        const email = newRecipient.trim();
        if (email && !config.recipients.includes(email)) {
            setConfig(c => ({ ...c, recipients: [...c.recipients, email] }));
        }
        setNewRecipient('');
    };

    const removeRecipient = (email: string) => {
        setConfig(c => ({ ...c, recipients: c.recipients.filter(r => r !== email) }));
    };

    const toggle = (key: keyof NotificationConfig) => {
        setConfig(c => ({ ...c, [key]: !(c[key] as boolean) }));
    };

    const field = (label: string, key: keyof NotificationConfig) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
            <span style={{ fontSize: 14 }}>{label}</span>
            <button
                onClick={() => toggle(key)}
                style={{
                    padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: config[key] ? '#22c55e' : '#475569',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    minWidth: 56,
                }}
            >
                {config[key] ? 'ON' : 'OFF'}
            </button>
        </div>
    );

    return (
        <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>📧 Email Notification Settings</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Config panel */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Notification Triggers</h3>

                    {field('Scan Completed', 'email_on_scan_complete')}
                    {field('New Devices Discovered', 'email_on_new_devices')}
                    {field('Device Registration Success', 'email_on_registration')}
                    {field('Scan Failure Alert', 'email_on_failure')}

                    <div style={{ padding: '10px 0', borderBottom: '1px solid #0f172a' }}>
                        <label style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>
                            New Device Alert Threshold
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={config.new_device_threshold}
                            onChange={e => setConfig(c => ({ ...c, new_device_threshold: parseInt(e.target.value) || 1 }))}
                            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', width: 80 }}
                        />
                        <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 8 }}>devices before alert</span>
                    </div>

                    <div style={{ padding: '10px 0' }}>
                        <label style={{ fontSize: 14, display: 'block', marginBottom: 6 }}>Reply-To Address</label>
                        <input
                            type="email"
                            value={config.reply_to}
                            onChange={e => setConfig(c => ({ ...c, reply_to: e.target.value }))}
                            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* Recipients panel */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Recipients</h3>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <input
                            type="email"
                            placeholder="Add email address…"
                            value={newRecipient}
                            onChange={e => setNewRecipient(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addRecipient()}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0' }}
                        />
                        <button
                            onClick={addRecipient}
                            style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
                        >
                            Add
                        </button>
                    </div>

                    {config.recipients.length === 0 && (
                        <p style={{ fontSize: 13, opacity: 0.5 }}>No recipients configured yet.</p>
                    )}

                    {config.recipients.map(r => (
                        <div key={r} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #0f172a' }}>
                            <span style={{ fontSize: 13 }}>✉️ {r}</span>
                            <button
                                onClick={() => removeRecipient(r)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Save button */}
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                >
                    {saving ? 'Saving…' : '💾 Save Configuration'}
                </button>
                {savedMsg && <span style={{ fontSize: 13 }}>{savedMsg}</span>}
            </div>

            {/* History */}
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, marginTop: 24 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>📜 Notification History</h3>
                {history.length === 0 ? (
                    <p style={{ fontSize: 13, opacity: 0.5 }}>No notifications sent yet.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                                <th style={{ padding: '6px 8px' }}>Event</th>
                                <th style={{ padding: '6px 8px' }}>Subject</th>
                                <th style={{ padding: '6px 8px' }}>Recipients</th>
                                <th style={{ padding: '6px 8px' }}>Status</th>
                                <th style={{ padding: '6px 8px' }}>Sent At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.slice(-10).reverse().map(n => (
                                <tr key={n.notification_id} style={{ borderBottom: '1px solid #0f172a' }}>
                                    <td style={{ padding: '6px 8px' }}>{n.event_type}</td>
                                    <td style={{ padding: '6px 8px' }}>{n.subject}</td>
                                    <td style={{ padding: '6px 8px' }}>{(n.recipients || []).join(', ')}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                        <span style={{ color: n.status === 'sent' ? '#22c55e' : '#ef4444' }}>{n.status}</span>
                                    </td>
                                    <td style={{ padding: '6px 8px', opacity: 0.7 }}>{new Date(n.sent_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default NotificationSettings;
