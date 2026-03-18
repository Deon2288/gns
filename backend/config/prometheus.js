const client = require('prom-client');

// Create a Registry to register the metrics
const registry = new client.Registry();

// Collect default metrics
client.collectDefaultMetrics({ register: registry });

// Create a Histogram for request latency
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Create a Counter for request counts
const httpRequestCount = new client.Counter({
  name: 'http_request_count',
  help: 'Count of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Create a Gauge for tracking error rates
const httpErrorRate = new client.Gauge({
  name: 'http_error_rate',
  help: 'Rate of HTTP errors',
  labelNames: ['method', 'route']
});

// Register the metrics to the registry
registry.registerMetric(httpRequestDurationMicroseconds);
registry.registerMetric(httpRequestCount);
registry.registerMetric(httpErrorRate);

// Expose the metrics endpoint
const express = require('express');
const app = express();
app.get('/metrics', (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(registry.metrics());
});

// Middleware to track request metrics
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    httpRequestCount.inc({ method: req.method, route: req.path, status: res.statusCode }); // Increment request count
    end({ method: req.method, route: req.path, status: res.statusCode }); // Observe duration
    if (res.statusCode >= 400) {
      httpErrorRate.inc({ method: req.method, route: req.path }); // Increment error rate
    }
  });
  next();
});

module.exports = app;