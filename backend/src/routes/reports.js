const express = require('express');
const router = express.Router();

// In-memory report storage
let reports = [
  {
    id: 1,
    name: 'Monthly Device Uptime',
    description: 'Tracks device uptime percentage over the past month',
    type: 'uptime',
    schedule: '0 7 1 * *',
    recipients_email: ['admin@example.com'],
    format: 'pdf',
    created_by: 1,
    created_at: new Date('2024-01-15').toISOString(),
    last_generated_at: new Date('2024-03-01').toISOString(),
  },
  {
    id: 2,
    name: 'Weekly Network Traffic',
    description: 'Network traffic summary per device',
    type: 'traffic',
    schedule: '0 6 * * 1',
    recipients_email: ['admin@example.com', 'ops@example.com'],
    format: 'csv',
    created_by: 1,
    created_at: new Date('2024-02-01').toISOString(),
    last_generated_at: new Date('2024-03-11').toISOString(),
  },
];

let reportTemplates = [
  {
    id: 1,
    name: 'Device Performance Dashboard',
    widgets: [
      { type: 'line_chart', metric: 'uptime', title: 'Uptime Trend' },
      { type: 'bar_chart', metric: 'latency', title: 'Average Latency' },
      { type: 'pie_chart', metric: 'status', title: 'Device Status Distribution' },
    ],
    filters: { time_range: '30d', device_ids: [] },
    layout: 'grid',
  },
];

let analyticsData = [];

// Seed sample analytics data
const now = Date.now();
for (let i = 0; i < 72; i++) {
  analyticsData.push({
    id: i + 1,
    device_id: (i % 3) + 1,
    metric_name: i % 2 === 0 ? 'uptime' : 'latency',
    value: i % 2 === 0 ? 95 + Math.random() * 5 : 10 + Math.random() * 40,
    timestamp: new Date(now - i * 3600000).toISOString(),
    aggregation_level: 'hourly',
  });
}

let nextReportId = 3;
let nextTemplateId = 2;

// GET /api/reports - List reports
router.get('/', async (req, res) => {
  try {
    if (req.pool) {
      const result = await req.pool.query(
        'SELECT * FROM reports ORDER BY created_at DESC'
      );
      return res.json(result.rows);
    }
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.json(reports);
  }
});

// POST /api/reports - Create report template
router.post('/', async (req, res) => {
  try {
    const { name, description, type, schedule, recipients_email, format } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    const validTypes = ['uptime', 'traffic', 'performance', 'compliance', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    const validFormats = ['pdf', 'csv', 'excel'];
    const reportFormat = format || 'pdf';
    if (!validFormats.includes(reportFormat)) {
      return res.status(400).json({ error: 'format must be pdf, csv, or excel' });
    }

    const report = {
      id: nextReportId++,
      name,
      description: description || '',
      type,
      schedule: schedule || null,
      recipients_email: recipients_email || [],
      format: reportFormat,
      created_by: req.user ? req.user.userId : 1,
      created_at: new Date().toISOString(),
      last_generated_at: null,
    };

    if (req.pool) {
      const result = await req.pool.query(
        `INSERT INTO reports (name, description, type, schedule, recipients_email, format, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
        [
          name,
          description || '',
          type,
          schedule || null,
          JSON.stringify(recipients_email || []),
          reportFormat,
          report.created_by,
        ]
      );
      return res.status(201).json(result.rows[0]);
    }

    reports.push(report);
    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET /api/reports/:id - Get report details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = reports.find((r) => r.id === parseInt(id));
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// DELETE /api/reports/:id - Delete report
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idx = reports.findIndex((r) => r.id === parseInt(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'Report not found' });
    }
    reports.splice(idx, 1);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// POST /api/reports/:id/generate - Generate report
router.post('/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const report = reports.find((r) => r.id === parseInt(id));
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.last_generated_at = new Date().toISOString();

    // Simulate report generation
    const generatedReport = {
      report_id: parseInt(id),
      name: report.name,
      format: report.format,
      generated_at: report.last_generated_at,
      download_url: `/api/reports/${id}/download`,
      size_bytes: Math.floor(Math.random() * 500000) + 50000,
      record_count: Math.floor(Math.random() * 1000) + 100,
    };

    res.json(generatedReport);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// GET /api/reports/:id/download - Download report
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const report = reports.find((r) => r.id === parseInt(id));
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Simulate a CSV download
    const csvContent = `Report: ${report.name}\nGenerated: ${new Date().toISOString()}\nType: ${report.type}\n\nDevice ID,Metric,Value,Timestamp\n1,uptime,98.5%,${new Date().toISOString()}\n2,uptime,97.2%,${new Date().toISOString()}\n3,uptime,99.1%,${new Date().toISOString()}`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// GET /api/analytics/dashboard - Dashboard analytics data
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const cutoff = new Date(Date.now() - parseInt(hours) * 3600000).toISOString();

    const filtered = analyticsData.filter((d) => d.timestamp >= cutoff);

    // Calculate KPIs
    const uptimeData = filtered.filter((d) => d.metric_name === 'uptime');
    const latencyData = filtered.filter((d) => d.metric_name === 'latency');

    const avgUptime =
      uptimeData.length > 0
        ? uptimeData.reduce((sum, d) => sum + d.value, 0) / uptimeData.length
        : 0;

    const avgLatency =
      latencyData.length > 0
        ? latencyData.reduce((sum, d) => sum + d.value, 0) / latencyData.length
        : 0;

    res.json({
      kpis: {
        avg_uptime: parseFloat(avgUptime.toFixed(2)),
        avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
        total_devices: 3,
        online_devices: 3,
        uptime_trend: avgUptime > 95 ? 'up' : 'down',
      },
      uptime_chart: uptimeData.slice(0, 24).map((d) => ({
        timestamp: d.timestamp,
        value: parseFloat(d.value.toFixed(2)),
        device_id: d.device_id,
      })),
      latency_chart: latencyData.slice(0, 24).map((d) => ({
        timestamp: d.timestamp,
        value: parseFloat(d.value.toFixed(2)),
        device_id: d.device_id,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/analytics/devices/:id - Device analytics
router.get('/analytics/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hours = 24 } = req.query;
    const cutoff = new Date(Date.now() - parseInt(hours) * 3600000).toISOString();

    const deviceData = analyticsData.filter(
      (d) => d.device_id === parseInt(id) && d.timestamp >= cutoff
    );

    const uptimeValues = deviceData.filter((d) => d.metric_name === 'uptime').map((d) => d.value);
    const latencyValues = deviceData
      .filter((d) => d.metric_name === 'latency')
      .map((d) => d.value);

    res.json({
      device_id: parseInt(id),
      metrics: deviceData,
      summary: {
        avg_uptime:
          uptimeValues.length > 0
            ? parseFloat(
                (uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length).toFixed(2)
              )
            : null,
        avg_latency:
          latencyValues.length > 0
            ? parseFloat(
                (latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length).toFixed(2)
              )
            : null,
        min_uptime: uptimeValues.length > 0 ? parseFloat(Math.min(...uptimeValues).toFixed(2)) : null,
        max_latency: latencyValues.length > 0 ? parseFloat(Math.max(...latencyValues).toFixed(2)) : null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch device analytics' });
  }
});

// GET /api/analytics/network - Network-wide analytics
router.get('/analytics/network', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const cutoff = new Date(Date.now() - parseInt(hours) * 3600000).toISOString();
    const filtered = analyticsData.filter((d) => d.timestamp >= cutoff);

    const byDevice = {};
    filtered.forEach((d) => {
      if (!byDevice[d.device_id]) byDevice[d.device_id] = { uptime: [], latency: [] };
      if (d.metric_name === 'uptime') byDevice[d.device_id].uptime.push(d.value);
      if (d.metric_name === 'latency') byDevice[d.device_id].latency.push(d.value);
    });

    const deviceSummaries = Object.entries(byDevice).map(([deviceId, data]) => ({
      device_id: parseInt(deviceId),
      avg_uptime:
        data.uptime.length > 0
          ? parseFloat((data.uptime.reduce((a, b) => a + b, 0) / data.uptime.length).toFixed(2))
          : null,
      avg_latency:
        data.latency.length > 0
          ? parseFloat(
              (data.latency.reduce((a, b) => a + b, 0) / data.latency.length).toFixed(2)
            )
          : null,
    }));

    res.json({ devices: deviceSummaries, time_range_hours: parseInt(hours) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch network analytics' });
  }
});

// POST /api/analytics/export - Export analytics data
router.post('/analytics/export', async (req, res) => {
  try {
    const { device_ids, metric_names, start_date, end_date, format = 'csv' } = req.body;

    let data = analyticsData;
    if (device_ids && Array.isArray(device_ids)) {
      data = data.filter((d) => device_ids.includes(d.device_id));
    }
    if (metric_names && Array.isArray(metric_names)) {
      data = data.filter((d) => metric_names.includes(d.metric_name));
    }
    if (start_date) {
      data = data.filter((d) => d.timestamp >= start_date);
    }
    if (end_date) {
      data = data.filter((d) => d.timestamp <= end_date);
    }

    if (format === 'csv') {
      const header = 'device_id,metric_name,value,timestamp,aggregation_level';
      const rows = data
        .map((d) => `${d.device_id},${d.metric_name},${d.value},${d.timestamp},${d.aggregation_level}`)
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics_export.csv"');
      return res.send(`${header}\n${rows}`);
    }

    res.json({ data, count: data.length, exported_at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

module.exports = router;
