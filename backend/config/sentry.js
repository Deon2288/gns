// sentry.js

const Sentry = require('@sentry/node');
const environment = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN', // replace with your actual DSN
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  tracesSampleRate: 1.0, // adjust this value in production
  environment: environment,
});

module.exports = Sentry;