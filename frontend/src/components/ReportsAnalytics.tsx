import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import './ReportsAnalytics.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://197.242.150.120:5000';

const COLORS = ['#667eea', '#764ba2', '#48bb78', '#ed8936', '#e53e3e', '#38b2ac'];

interface Report {
  id: number;
  name: string;
  description: string;
  type: string;
  schedule: string | null;
  recipients_email: string[];
  format: string;
  created_by: number;
  created_at: string;
  last_generated_at: string | null;
}

interface DashboardData {
  kpis: {
    avg_uptime: number;
    avg_latency_ms: number;
    total_devices: number;
    online_devices: number;
    uptime_trend: string;
  };
  uptime_chart: { timestamp: string; value: number; device_id: number }[];
  latency_chart: { timestamp: string; value: number; device_id: number }[];
}

export const ReportsAnalytics: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'reports' | 'create'>('analytics');
  const [timeRange, setTimeRange] = useState('24');
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    type: 'uptime',
    schedule: '',
    recipients_email: '',
    format: 'pdf',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchReports();
    fetchDashboard();
  }, [timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/reports`);
      setReports(res.data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/reports/analytics/dashboard?hours=${timeRange}`);
      setDashboardData(res.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const emails = createForm.recipients_email
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await axios.post(`${API_BASE}/api/reports`, {
        ...createForm,
        recipients_email: emails,
      });
      setMessage({ type: 'success', text: 'Report template created!' });
      setCreateForm({
        name: '',
        description: '',
        type: 'uptime',
        schedule: '',
        recipients_email: '',
        format: 'pdf',
      });
      fetchReports();
      setActiveTab('reports');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create report' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async (reportId: number) => {
    try {
      const res = await axios.post(`${API_BASE}/api/reports/${reportId}/generate`);
      setMessage({
        type: 'success',
        text: `Report generated: ${res.data.record_count} records, ${(res.data.size_bytes / 1024).toFixed(1)} KB`,
      });
      fetchReports();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to generate report' });
    }
  };

  const handleDownloadReport = async (report: Report) => {
    try {
      const res = await axios.get(`${API_BASE}/api/reports/${report.id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '_')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to download report' });
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await axios.delete(`${API_BASE}/api/reports/${id}`);
      setMessage({ type: 'success', text: 'Report deleted.' });
      fetchReports();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete report' });
    }
  };

  const handleExportAnalytics = async () => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/reports/analytics/export`,
        { format: 'csv' },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analytics_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to export analytics' });
    }
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const uptimeChartData = dashboardData?.uptime_chart
    .filter((d) => d.device_id === 1)
    .slice(0, 12)
    .reverse()
    .map((d) => ({ time: formatTime(d.timestamp), uptime: d.value })) || [];

  const latencyChartData = dashboardData?.latency_chart
    .slice(0, 12)
    .reverse()
    .map((d) => ({ time: formatTime(d.timestamp), latency: d.value, device: `Dev ${d.device_id}` })) || [];

  const deviceStatusData = [
    { name: 'Online', value: dashboardData?.kpis.online_devices || 0 },
    { name: 'Offline', value: (dashboardData?.kpis.total_devices || 0) - (dashboardData?.kpis.online_devices || 0) },
  ];

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>📊 Reports & Analytics</h2>
        <p>Monitor device performance, generate reports, and analyze trends</p>
      </div>

      {message && (
        <div className={`alert-msg ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="reports-tabs">
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          📈 Analytics Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          📋 Reports ({reports.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create Report
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="analytics-view">
          <div className="analytics-controls">
            <div className="time-range-selector">
              <span>Time Range:</span>
              {[
                { label: '6h', value: '6' },
                { label: '24h', value: '24' },
                { label: '48h', value: '48' },
                { label: '7d', value: '168' },
              ].map((r) => (
                <button
                  key={r.value}
                  className={`time-btn ${timeRange === r.value ? 'active' : ''}`}
                  onClick={() => setTimeRange(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button className="btn-export" onClick={handleExportAnalytics}>
              ⬇️ Export CSV
            </button>
          </div>

          {dashboardData && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon">⬆️</div>
                  <div className="kpi-info">
                    <div className="kpi-value">
                      {dashboardData.kpis.avg_uptime.toFixed(1)}%
                    </div>
                    <div className="kpi-label">Avg Uptime</div>
                    <div className={`kpi-trend ${dashboardData.kpis.uptime_trend}`}>
                      {dashboardData.kpis.uptime_trend === 'up' ? '▲ Good' : '▼ Check devices'}
                    </div>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">⚡</div>
                  <div className="kpi-info">
                    <div className="kpi-value">{dashboardData.kpis.avg_latency_ms.toFixed(0)}ms</div>
                    <div className="kpi-label">Avg Latency</div>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">📡</div>
                  <div className="kpi-info">
                    <div className="kpi-value">
                      {dashboardData.kpis.online_devices}/{dashboardData.kpis.total_devices}
                    </div>
                    <div className="kpi-label">Online Devices</div>
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-icon">📊</div>
                  <div className="kpi-info">
                    <div className="kpi-value">{reports.length}</div>
                    <div className="kpi-label">Active Reports</div>
                  </div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-card">
                  <h3>Device Uptime Trend</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={uptimeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis domain={[90, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Uptime']} />
                      <Line
                        type="monotone"
                        dataKey="uptime"
                        stroke="#667eea"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Latency by Device</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={latencyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} unit="ms" />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}ms`, 'Latency']} />
                      <Bar dataKey="latency" fill="#764ba2" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card chart-small">
                  <h3>Device Status</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={deviceStatusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {deviceStatusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="reports-list">
          {reports.length === 0 ? (
            <div className="empty-state">No reports yet. Create a report template to get started.</div>
          ) : (
            <div className="report-cards">
              {reports.map((report) => (
                <div key={report.id} className="report-card">
                  <div className="report-card-header">
                    <div>
                      <div className="report-name">{report.name}</div>
                      <div className="report-desc">{report.description}</div>
                    </div>
                    <div className="report-badges">
                      <span className={`badge badge-type-${report.type}`}>{report.type}</span>
                      <span className="badge badge-format">{report.format.toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="report-meta">
                    {report.schedule && (
                      <div className="report-meta-item">
                        <span>🕐</span>
                        <code>{report.schedule}</code>
                      </div>
                    )}
                    {report.recipients_email.length > 0 && (
                      <div className="report-meta-item">
                        <span>📧</span>
                        <span>{report.recipients_email.join(', ')}</span>
                      </div>
                    )}
                    {report.last_generated_at && (
                      <div className="report-meta-item">
                        <span>✅</span>
                        <span>Last: {new Date(report.last_generated_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="report-actions">
                    <button
                      className="btn-generate"
                      onClick={() => handleGenerateReport(report.id)}
                    >
                      ⚙️ Generate
                    </button>
                    {report.last_generated_at && (
                      <button
                        className="btn-download"
                        onClick={() => handleDownloadReport(report)}
                      >
                        ⬇️ Download
                      </button>
                    )}
                    <button
                      className="btn-delete-report"
                      onClick={() => handleDeleteReport(report.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="create-report-container">
          <form className="create-report-form" onSubmit={handleCreateReport}>
            <h3>Create Report Template</h3>

            <div className="form-group">
              <label>Report Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Monthly Uptime Report"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="form-group">
              <label>Report Type *</label>
              <div className="report-type-grid">
                {['uptime', 'traffic', 'performance', 'compliance', 'custom'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`type-btn ${createForm.type === t ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, type: t })}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Export Format</label>
              <div className="format-grid">
                {['pdf', 'csv', 'excel'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`format-btn ${createForm.format === f ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, format: f })}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Schedule (Cron, optional)</label>
              <input
                type="text"
                value={createForm.schedule}
                onChange={(e) => setCreateForm({ ...createForm, schedule: e.target.value })}
                placeholder="e.g. 0 7 1 * * (1st of month at 7am)"
              />
            </div>

            <div className="form-group">
              <label>Recipients (comma-separated emails)</label>
              <input
                type="text"
                value={createForm.recipients_email}
                onChange={(e) => setCreateForm({ ...createForm, recipients_email: e.target.value })}
                placeholder="admin@example.com, ops@example.com"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : '📊 Create Report'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
