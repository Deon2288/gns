import React, { useEffect, useState } from 'react';

interface NamingRule {
    rule_id: string;
    rule_name: string;
    pattern: string;
    variables: Record<string, string>;
    conditions: Record<string, string>;
    enabled: boolean;
    priority: number;
    snmp_enabled: boolean;
    apply_to_new_scans: boolean;
    created_at: string;
}

const PATTERN_VARS = [
    '{manufacturer}', '{model}', '{protocol}', '{serial}',
    '{imei}', '{ip}', '{subnet}', '{host}',
    '{location}', '{counter}', '{timestamp}', '{snmp_name}',
];

const DeviceNamingRules: React.FC = () => {
    const [rules, setRules] = useState<NamingRule[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [testPattern, setTestPattern] = useState('');
    const [testDevice, setTestDevice] = useState('{"manufacturer":"Teltonika","model":"FMB125","ip":"192.168.1.100","protocol":"teltonika"}');
    const [testResult, setTestResult] = useState('');
    const [form, setForm] = useState<Partial<NamingRule>>({
        rule_name: '',
        pattern: '{manufacturer}-{model}-{counter}',
        enabled: true,
        priority: 1,
        snmp_enabled: false,
        apply_to_new_scans: true,
    });
    const [msg, setMsg] = useState('');

    const loadRules = () => {
        fetch('/api/discovery/naming/rules')
            .then(r => r.json())
            .then(setRules)
            .catch(() => {});
    };

    useEffect(() => { loadRules(); }, []);

    const createRule = async () => {
        if (!form.rule_name || !form.pattern) {
            setMsg('❌ Rule name and pattern are required');
            return;
        }
        try {
            await fetch('/api/discovery/naming/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            setMsg('✅ Rule created');
            setShowForm(false);
            setForm({ rule_name: '', pattern: '{manufacturer}-{model}-{counter}', enabled: true, priority: 1, snmp_enabled: false, apply_to_new_scans: true });
            loadRules();
        } catch {
            setMsg('❌ Failed to create rule');
        }
        setTimeout(() => setMsg(''), 3000);
    };

    const deleteRule = async (id: string) => {
        await fetch(`/api/discovery/naming/rules/${id}`, { method: 'DELETE' });
        loadRules();
    };

    const toggleRule = async (rule: NamingRule) => {
        await fetch(`/api/discovery/naming/rules/${rule.rule_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
        });
        loadRules();
    };

    const testNaming = async () => {
        try {
            const device = JSON.parse(testDevice);
            const res = await fetch('/api/discovery/naming/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pattern: testPattern, device }),
            });
            const data = await res.json();
            setTestResult(data.result || data.message || 'No result');
        } catch (err) {
            setTestResult('❌ Parse error: check device JSON');
        }
    };

    const insertVar = (v: string) => {
        setForm(f => ({ ...f, pattern: (f.pattern || '') + v }));
    };

    return (
        <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>🎨 Device Naming Rules</h2>
                <button
                    onClick={() => setShowForm(s => !s)}
                    style={btnStyle('#3b82f6')}
                >
                    {showForm ? '✕ Cancel' : '＋ New Rule'}
                </button>
            </div>

            {msg && <div style={{ marginBottom: 12, fontSize: 13 }}>{msg}</div>}

            {/* New rule form */}
            {showForm && (
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, marginBottom: 20 }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>Create Naming Rule</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                            <label style={labelStyle}>Rule Name</label>
                            <input
                                value={form.rule_name}
                                onChange={e => setForm(f => ({ ...f, rule_name: e.target.value }))}
                                placeholder="e.g. Teltonika Naming"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Priority</label>
                            <input
                                type="number" min={1}
                                value={form.priority}
                                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))}
                                style={{ ...inputStyle, width: 80 }}
                            />
                        </div>
                    </div>

                    <label style={labelStyle}>Pattern</label>
                    <input
                        value={form.pattern}
                        onChange={e => setForm(f => ({ ...f, pattern: e.target.value }))}
                        placeholder="{manufacturer}-{model}-{counter}"
                        style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
                    />

                    {/* Variable quick-insert */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {PATTERN_VARS.map(v => (
                            <button
                                key={v}
                                onClick={() => insertVar(v)}
                                style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
                            Enabled
                        </label>
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.snmp_enabled} onChange={e => setForm(f => ({ ...f, snmp_enabled: e.target.checked }))} />
                            Use SNMP Name
                        </label>
                        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.apply_to_new_scans} onChange={e => setForm(f => ({ ...f, apply_to_new_scans: e.target.checked }))} />
                            Apply to New Scans
                        </label>
                    </div>

                    <button onClick={createRule} style={btnStyle('#22c55e')}>✅ Create Rule</button>
                </div>
            )}

            {/* Rules list */}
            {rules.length === 0 ? (
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 30, textAlign: 'center', opacity: 0.5, fontSize: 14 }}>
                    No naming rules configured. Click "+ New Rule" to create one.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                    {rules.map(rule => (
                        <div key={rule.rule_id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                    #{rule.priority} {rule.rule_name}
                                    {!rule.enabled && <span style={{ marginLeft: 8, fontSize: 11, background: '#475569', borderRadius: 4, padding: '2px 6px' }}>Disabled</span>}
                                    {rule.snmp_enabled && <span style={{ marginLeft: 8, fontSize: 11, background: '#7c3aed', borderRadius: 4, padding: '2px 6px', color: '#fff' }}>SNMP</span>}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'monospace', background: '#0f172a', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                                    {rule.pattern}
                                </div>
                                {rule.apply_to_new_scans && (
                                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Applies to new scans</div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => toggleRule(rule)} style={btnStyle(rule.enabled ? '#eab308' : '#22c55e')}>
                                    {rule.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button onClick={() => deleteRule(rule.rule_id)} style={btnStyle('#ef4444')}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pattern tester */}
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 15 }}>🧪 Pattern Tester</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                        <label style={labelStyle}>Pattern</label>
                        <input
                            value={testPattern}
                            onChange={e => setTestPattern(e.target.value)}
                            placeholder="{manufacturer}-{model}-{ip}"
                            style={{ ...inputStyle, width: '100%' }}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Device JSON</label>
                        <input
                            value={testDevice}
                            onChange={e => setTestDevice(e.target.value)}
                            style={{ ...inputStyle, width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={testNaming} style={btnStyle('#3b82f6')}>▶ Test Pattern</button>
                    {testResult && (
                        <span style={{ fontFamily: 'monospace', background: '#0f172a', padding: '6px 12px', borderRadius: 4, fontSize: 13 }}>
                            → {testResult}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const labelStyle: React.CSSProperties = { fontSize: 13, display: 'block', marginBottom: 4, opacity: 0.7 };
const inputStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 4, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 13 };

function btnStyle(bg: string): React.CSSProperties {
    return { padding: '6px 14px', borderRadius: 5, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
}

export default DeviceNamingRules;
