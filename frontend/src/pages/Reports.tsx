import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { reports as reportsApi, devices as devicesApi } from '../services/api';
import { Device } from '../types';

type ReportType = 'trips' | 'driver-behavior' | 'fuel';

const COLORS = ['#e94560', '#0ea5e9', '#22c55e', '#eab308', '#a855f7', '#f97316'];

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('trips');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  React.useEffect(() => {
    if (!devicesLoaded) {
      devicesApi.getAll()
        .then((d: any) => setDevices(Array.isArray(d) ? d : d.devices || []))
        .catch(() => {})
        .finally(() => setDevicesLoaded(true));
    }
  }, [devicesLoaded]);

  const generate = async () => {
    setLoading(true);
    setError('');
    setData([]);
    setGenerated(false);
    try {
      const params = { from: filterFrom || undefined, to: filterTo || undefined, device_id: filterDevice || undefined };
      let result: any;
      if (reportType === 'trips') result = await reportsApi.getTripsReport(params);
      else if (reportType === 'driver-behavior') result = await reportsApi.getDriverBehaviorReport(params);
      else result = await reportsApi.getFuelReport(params);
      setData(Array.isArray(result) ? result : result.data || result.trips || result.events || result.records || []);
      setGenerated(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const s: Record<string, React.CSSProperties> = {
    page: { padding: 24, color: '#ccd6f6' },
    header: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: 700, color: '#ccd6f6', margin: 0 },
    controls: { background: '#0f3460', borderRadius: 10, padding: 20, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'flex-end' },
    field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
    label: { color: '#8892b0', fontSize: 12 },
    select: { padding: '8px 12px', background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    input: { padding: '8px 12px', background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 6, color: '#ccd6f6', fontSize: 13 },
    btn: { padding: '10px 24px', background: '#e94560', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, alignSelf: 'flex-end' },
    chartCard: { background: '#0f3460', borderRadius: 10, padding: 20, marginBottom: 20 },
    table: { width: '100%', borderCollapse: 'collapse' as const, background: '#0f3460', borderRadius: 10, overflow: 'hidden' },
    th: { padding: '12px 14px', background: '#1a1a2e', color: '#8892b0', fontSize: 12, textAlign: 'left' as const, textTransform: 'uppercase' as const },
    td: { padding: '11px 14px', borderBottom: '1px solid #1a1a2e', fontSize: 13 },
  };

  const renderChart = () => {
    if (!generated || data.length === 0) return null;

    if (reportType === 'trips') {
      const chartData = data.map((t: any) => ({
        name: t.date || t.start_time?.slice(0, 10) || t.trip_id,
        distance: t.distance_km || t.total_distance || 0,
      }));
      return (
        <div style={s.chartCard}>
          <div style={{ color: '#ccd6f6', fontWeight: 600, marginBottom: 12 }}>Distance per Day</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis dataKey="name" stroke="#8892b0" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8892b0" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f3460', border: 'none', borderRadius: 8 }} />
              <Bar dataKey="distance" fill="#e94560" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (reportType === 'driver-behavior') {
      const typeCounts = data.reduce<Record<string, number>>((acc, ev: any) => {
        const t = ev.event_type || 'unknown';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});
      const pieData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
      return (
        <div style={s.chartCard}>
          <div style={{ color: '#ccd6f6', fontWeight: 600, marginBottom: 12 }}>Events by Type</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f3460', border: 'none', borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (reportType === 'fuel') {
      const chartData = data.map((r: any) => ({
        date: r.date || r.recorded_at?.slice(0, 10) || r.id,
        consumption: r.fuel_consumption || r.consumption || r.liters || 0,
      }));
      return (
        <div style={s.chartCard}>
          <div style={{ color: '#ccd6f6', fontWeight: 600, marginBottom: 12 }}>Fuel Consumption Over Time</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
              <XAxis dataKey="date" stroke="#8892b0" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8892b0" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#0f3460', border: 'none', borderRadius: 8 }} />
              <Line type="monotone" dataKey="consumption" stroke="#e94560" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return null;
  };

  const renderTable = () => {
    if (!generated || data.length === 0) return null;
    const keys = Object.keys(data[0]);
    return (
      <table style={s.table}>
        <thead>
          <tr>{keys.map((k) => <th key={k} style={s.th}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row: any, i: number) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k} style={s.td}>
                  {row[k] != null ? String(row[k]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={s.title}>Reports</h2>
        <div style={{ color: '#8892b0', fontSize: 13, marginTop: 4 }}>Generate fleet analytics reports</div>
      </div>

      <div style={s.controls}>
        <div style={s.field}>
          <label style={s.label}>REPORT TYPE</label>
          <select style={s.select} value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
            <option value="trips">Trips</option>
            <option value="driver-behavior">Driver Behavior</option>
            <option value="fuel">Fuel</option>
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>DEVICE</label>
          <select style={s.select} value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)}>
            <option value="">All Devices</option>
            {devices.map((d) => <option key={d.device_id} value={String(d.device_id)}>{d.device_name}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>FROM</label>
          <input type="date" style={s.input} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>TO</label>
          <input type="date" style={s.input} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
        <button style={s.btn} onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(233,69,96,0.15)', border: '1px solid #e94560', borderRadius: 8, padding: 12, color: '#e94560', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {generated && data.length === 0 && !loading && (
        <div style={{ color: '#8892b0', fontSize: 14 }}>No data found for selected criteria.</div>
      )}

      {renderChart()}
      {renderTable()}
    </div>
  );
};

export default Reports;
