const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const { PORT, NODE_ENV } = require('./config/constants');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const discoveryRoutes = require('./routes/discovery');
const snmpRoutes = require('./routes/snmp');
const healthRoutes = require('./routes/health');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'GNS API', version: '1.0.0', description: 'Global Network Surveillance API' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/snmp', snmpRoutes);
app.use('/api/health', healthRoutes);

// Legacy health check
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// Centralized error handler
app.use(errorHandler);

if (NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        logger.info(`🚀 Server running on port ${PORT}`);
        logger.info(`📚 API docs available at http://localhost:${PORT}/api/docs`);
      });
    })
    .catch((err) => {
      logger.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = app;
