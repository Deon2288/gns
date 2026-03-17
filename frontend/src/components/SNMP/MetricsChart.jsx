import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MetricsChart = ({ metrics }) => {
  const chartData = useMemo(() => {
    // Group by oidName and build time-series per OID
    const grouped = {};
    metrics.forEach((m) => {
      const key = m.oidName || m.oid;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ time: new Date(m.polledAt).toLocaleTimeString(), value: parseFloat(m.value) || 0 });
    });

    // Build a unified time-series
    const allTimes = [...new Set(metrics.map((m) => new Date(m.polledAt).toLocaleTimeString()))];
    return allTimes.map((time) => {
      const entry = { time };
      Object.keys(grouped).forEach((key) => {
        const point = grouped[key].find((p) => p.time === time);
        entry[key] = point ? point.value : null;
      });
      return entry;
    });
  }, [metrics]);

  const oidNames = [...new Set(metrics.map((m) => m.oidName || m.oid))].slice(0, 5);
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe'];

  if (chartData.length === 0) return null;

  return (
    <div className="chart-card">
      <h3>📈 Metrics Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {oidNames.map((name, idx) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colors[idx % colors.length]}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MetricsChart;
