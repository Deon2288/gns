import React, { useEffect, useState } from 'react';
import { alerts as alertsApi, devices as devicesApi } from '../services/api';
import { AlertRule, AlertHistory, Device } from '../types';

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6',
  warning: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const ALERT_TYPES = ['speeding', 'geofence_enter', 'geofence_exit', 'low_battery', 'harsh_braking', 'harsh_acceleration', 'idle_too_long', 'offline'];

const emptyRule = { device_id: '', alert_type: 'speeding', threshold_value: '', threshold_unit: 'km/h', recipients: '' };

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => (
  <span style={{
    background: (SEVERITY_COLORS[severity] || '#8892b0') + '33',
    color: SEVERITY_COLORS[severity] || '#8892b0',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    textTransform: 'capitalize',
  }}>
    {severity}
  </span>
);

const Alerts: React.FC = () => {
  const [tab, setTab] = useState<'rules' | 'history'>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form, setForm] = useState(emptyRule);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [filterDevice, setFilterDevice] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAcknowledged, setFilterAcknowledged] = useState('');

  const loadRules = () => alertsApi.getRules().then((d: any) => setRules(Array.isArray(d) ? d : d.rules || [])).catch(() => {});
  const loadHistory = () => alertsApi.getHistory({ device_id: filterDevice || undefined, alert_type: filterType || undefined, acknowledged: filterAcknowledged || undefined })
    .then((d: any) => setHistory(Array.isArray(d) ? d : d.alerts || [])).catch(() => {});

  useEffect(() => {
    Promise.all([loadRules(), loadHistory(), devicesApi.getAll()])
      .then(([, , d]) => setDevices(Array.isArray(d) ? d : d.devices || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, filterDevice, filterType, filterAcknowledged]); // eslint-disable-line

  const openAdd = () => { setEditingRule(null); setForm(emptyRule); setFormError(''); setShowModal(true); };
  const openEdit = (r: AlertRule) => {
    setEditingRule(r);
    setForm({
      device_id: r.device_id ? String(r.device_id) : '',
      alert_type: r.alert_type,
      threshold_value: r.threshold_value != null ? String(r.threshold_value) : '',
      threshold_unit: r.threshold_unit || '',
      recipients: (r.recipients || []).join(', '),
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        device_id: form.device_id ? Number(form.device_id) : null,
        alert_type: form.alert_type,
        threshold_value: form.threshold_value ? Number(form.threshold_value) : null,
        threshold_unit: form.threshold_unit || null,
        recipients: form.recipients ? form.recipients.split(',').map((e) => e.trim()) : [],
      };
      if (editingRule) {
        await alertsApi.updateRule(editingRule.rule_id, payload);
      } else {
        await alertsApi.createRule(payload);
      }
      setShowModal(false);
      loadRules();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AlertRule) => {
    try {
      await alertsApi.updateRule(rule.rule_id, { is_active: !rule.is_active });
      loadRules();
    } catch {}
  };

  const handleDeleteRule = async (id: number) => {
    if (!window.confirm('Delete this alert rule?')) return;
    try { await alertsApi.deleteRule(id); loadRules(); } catch {}
  };

  const handleAcknowledge = async (id: number) => {
    try { await alertsApi.acknowledgeAlert(id); loadHistory(); } catch {}
  };

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    tabs: { display: 'flex', gap: 0, marginBottom: 20, background: '#0f3460', borderRadius: 8, overflow: 'hidden', width: 'fit-content' },
    tabBtn: { padding: '10px 24px', border: 'none', cursor: 'pointer', fontSize: 14, background: 'transparent', color: '#8892b0' },
    tabBtnActive: { background: '#e94560', color: '#fff' },
    btn: { padding: '8px 16px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 },
    filters: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const },
    select: { padding: '8px 12px', background: '#0f3460', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    table: { width: '100%', borderCollapse: 'collapse' as const, background: '#0f3460', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '12px 14px', background: '#1a1a2e', color: '#8892b0', fontSize: 12, textAlign: 'left' as const, textTransform: 'uppercase' as const },
    td: { padding: '12px 14px', borderBottom: '1px solid #1a1a2e', fontSize: 13 },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#0f3460', borderRadius: 12, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    modalTitle: { color: '#ccd6f6', fontSize: 18, fontWeight: 600, marginBottom: 20 },
    field: { marginBottom: 16 },
    label: { display: 'block', color: '#8892b0', fontSize: 12, marginBottom: 6 },
    input: { width: '100%', padding: '9px 12px', background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13, boxSizing: 'border-box' as const, outline: 'none' },
    modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 },
    cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #8892b0', borderRadius: 6, color: '#8892b0', cursor: 'pointer', fontSize: 13 },
    toggle: { width: 36, height: 20, borderRadius: 10, cursor: 'pointer', border: 'none', fontSize: 12 },
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Alerts</h2>
        {tab === 'rules' && <button style={s.btn} onClick={openAdd}>+ Add Rule</button>}
      </div>

      <div style={s.tabs}>
        {(['rules', 'history'] as const).map((t) => (
          <button key={t} style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }} onClick={() => setTab(t)}>
            {t === 'rules' ? 'Alert Rules' : 'Alert History'}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#8892b0' }}>Loading...</div> : (
        <>
          {tab === 'rules' && (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Device', 'Type', 'Threshold', 'Recipients', 'Active', 'Actions'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.rule_id}>
                    <td style={s.td}>{r.device_name || 'All Devices'}</td>
                    <td style={s.td}>{r.alert_type}</td>
                    <td style={s.td}>
                      {r.threshold_value != null ? `${r.threshold_value} ${r.threshold_unit || ''}` : '—'}
                    </td>
                    <td style={{ ...s.td, color: '#8892b0', fontSize: 12 }}>
                      {(r.recipients || []).join(', ') || '—'}
                    </td>
                    <td style={s.td}>
                      <button
                        style={{
                          ...s.toggle,
                          background: r.is_active ? '#22c55e' : '#4b5563',
                          color: '#fff',
                        }}
                        onClick={() => handleToggle(r)}
                      >
                        {r.is_active ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td style={s.td}>
                      <button onClick={() => openEdit(r)} style={{ ...s.btn, background: '#0ea5e9', padding: '4px 10px', fontSize: 12, marginRight: 6 }}>Edit</button>
                      <button onClick={() => handleDeleteRule(r.rule_id)} style={{ ...s.btn, background: '#ef4444', padding: '4px 10px', fontSize: 12 }}>Delete</button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr><td colSpan={6} style={{ ...s.td, color: '#8892b0', textAlign: 'center' }}>No alert rules configured</td></tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'history' && (
            <>
              <div style={s.filters}>
                <select style={s.select} value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
                  <option value="">All Devices</option>
                  {devices.map((d) => <option key={d.device_id} value={String(d.device_id)}>{d.device_name}</option>)}
                </select>
                <select style={s.select} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  {ALERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select style={s.select} value={filterAcknowledged} onChange={(e) => setFilterAcknowledged(e.target.value)}>
                  <option value="">All</option>
                  <option value="false">Unacknowledged</option>
                  <option value="true">Acknowledged</option>
                </select>
              </div>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Device', 'Type', 'Message', 'Severity', 'Time', 'Status'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((a) => (
                    <tr key={a.alert_id}>
                      <td style={s.td}>{a.device_name || '—'}</td>
                      <td style={s.td}>{a.alert_type}</td>
                      <td style={s.td}>{a.message}</td>
                      <td style={s.td}><SeverityBadge severity={a.severity} /></td>
                      <td style={{ ...s.td, color: '#8892b0', fontSize: 12 }}>{new Date(a.triggered_at).toLocaleString()}</td>
                      <td style={s.td}>
                        {a.acknowledged ? (
                          <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Acknowledged</span>
                        ) : (
                          <button
                            onClick={() => handleAcknowledge(a.alert_id)}
                            style={{ ...s.btn, background: '#eab308', padding: '4px 10px', fontSize: 12 }}
                          >
                            Acknowledge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={6} style={{ ...s.td, color: '#8892b0', textAlign: 'center' }}>No alerts found</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>{editingRule ? 'Edit Rule' : 'New Alert Rule'}</h3>
            <div style={s.field}>
              <label style={s.label}>DEVICE (leave empty for all)</label>
              <select style={{ ...s.input, cursor: 'pointer' }} value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })}>
                <option value="">All Devices</option>
                {devices.map((d) => <option key={d.device_id} value={String(d.device_id)}>{d.device_name}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>ALERT TYPE</label>
              <select style={{ ...s.input, cursor: 'pointer' }} value={form.alert_type} onChange={(e) => setForm({ ...form, alert_type: e.target.value })}>
                {ALERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>THRESHOLD VALUE</label>
                <input style={s.input} type="number" value={form.threshold_value} onChange={(e) => setForm({ ...form, threshold_value: e.target.value })} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>UNIT</label>
                <input style={s.input} value={form.threshold_unit} onChange={(e) => setForm({ ...form, threshold_unit: e.target.value })} placeholder="km/h, min, %" />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>RECIPIENTS (comma-separated emails)</label>
              <input style={s.input} value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="email@example.com" />
            </div>
            {formError && <div style={{ color: '#e94560', fontSize: 13, marginBottom: 12 }}>{formError}</div>}
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button style={s.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
