const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

const getHealth = async (req, res) => {
  let dbStatus = 'ok';
  let dbMessage = 'Database connected';

  try {
    await sequelize.authenticate();
  } catch (err) {
    dbStatus = 'error';
    dbMessage = err.message;
  }

  const health = {
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: { status: dbStatus, message: dbMessage },
      api: { status: 'ok', message: 'API running' },
    },
    memory: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
    },
  };

  res.status(dbStatus === 'ok' ? 200 : 503).json(health);
};

const getStatus = async (req, res) => {
  res.json({
    status: 'ok',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { getHealth, getStatus };
