import React, { useEffect, useState } from 'react';

interface Protocol {
    protocol_id: string;
    name: string;
    description: string;
    port: number;
    manufacturer: string;
    supported_models: string[];
    features: string[];
}

const ProtocolSupport: React.FC = () => {
    const [protocols, setProtocols] = useState<Protocol[]>([]);
    const [selected, setSelected] = useState<Protocol | null>(null);
    const [detectIp, setDetectIp] = useState('');
    const [detectPort, setDetectPort] = useState('');
    const [detectResult, setDetectResult] = useState<Protocol & { detected_protocol: string; confidence: string; method: string } | null>(null);

    useEffect(() => {
        fetch('/api/protocols')
            .then(r => r.json())
            .then(data => setProtocols(data.protocols || []))
            .catch(() => {});
    }, []);

    const detectProtocol = async () => {
        try {
            const res = await fetch('/api/protocols/detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: detectIp, port: detectPort ? parseInt(detectPort) : undefined }),
            });
            const data = await res.json();
            setDetectResult(data);
        } catch {
            setDetectResult(null);
        }
    };

    const featureBadge = (feature: string) => (
        <span key={feature} style={{
            padding: '2px 8px', borderRadius: 10, fontSize: 11,
            background: '#1e293b', color: '#94a3b8',
            border: '1px solid #334155',
        }}>
            {feature.toUpperCase()}
        </span>
    );

    return (
        <div style={{ background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', padding: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>📡 Supported Device Protocols</h2>
            <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 20 }}>
                Teltonika is the primary protocol. Additional protocols can be extended below.
            </p>

            {/* Protocol grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14, marginBottom: 28 }}>
                {protocols.map(proto => (
                    <div
                        key={proto.protocol_id}
                        onClick={() => setSelected(selected?.protocol_id === proto.protocol_id ? null : proto)}
                        style={{
                            background: selected?.protocol_id === proto.protocol_id ? '#1d4ed8' : '#1e293b',
                            borderRadius: 8, padding: 16, cursor: 'pointer',
                            border: proto.protocol_id === 'teltonika' ? '2px solid #3b82f6' : '2px solid transparent',
                            transition: 'background 0.15s',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{proto.name}</span>
                            {proto.protocol_id === 'teltonika' && (
                                <span style={{ fontSize: 10, background: '#2563eb', color: '#fff', padding: '2px 6px', borderRadius: 8 }}>PRIMARY</span>
                            )}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>{proto.description}</div>
                        <div style={{ fontSize: 12, marginBottom: 4 }}>
                            🔌 Port: <b>{proto.port}</b> &nbsp;|&nbsp; 🏭 {proto.manufacturer}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {proto.features.map(featureBadge)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail pane */}
            {selected && (
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 12px' }}>{selected.name} — Detail</h3>
                    <div style={{ fontSize: 13, marginBottom: 8 }}><b>Codec:</b> {(selected as any).codec || '—'}</div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                        <b>Supported Models:</b>{' '}
                        {selected.supported_models.join(', ')}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selected.features.map(featureBadge)}
                    </div>
                </div>
            )}

            {/* Protocol detector */}
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>🔍 Protocol Auto-Detector</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ fontSize: 13, display: 'block', marginBottom: 4, opacity: 0.7 }}>Device IP</label>
                        <input
                            value={detectIp}
                            onChange={e => setDetectIp(e.target.value)}
                            placeholder="192.168.1.100"
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 13, display: 'block', marginBottom: 4, opacity: 0.7 }}>Port (optional)</label>
                        <input
                            value={detectPort}
                            onChange={e => setDetectPort(e.target.value)}
                            placeholder="5027"
                            style={{ ...inputStyle, width: 80 }}
                        />
                    </div>
                    <button
                        onClick={detectProtocol}
                        style={{ padding: '7px 16px', borderRadius: 5, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                        Detect
                    </button>
                </div>

                {detectResult && (
                    <div style={{ marginTop: 16, background: '#0f172a', borderRadius: 6, padding: 14, fontSize: 13 }}>
                        <div><b>Detected Protocol:</b> {detectResult.name} ({detectResult.detected_protocol})</div>
                        <div><b>Confidence:</b> <span style={{ color: detectResult.confidence === 'high' ? '#22c55e' : detectResult.confidence === 'medium' ? '#eab308' : '#94a3b8' }}>{detectResult.confidence}</span></div>
                        <div><b>Method:</b> {detectResult.method}</div>
                        <div><b>Port:</b> {detectResult.port}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 4, border: '1px solid #334155',
    background: '#0f172a', color: '#e2e8f0', fontSize: 13,
};

export default ProtocolSupport;
