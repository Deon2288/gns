const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { getHealth, getStatus } = require('../controllers/healthController');

const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200: { description: Healthy }
 *       503: { description: Degraded }
 */
router.get('/', healthLimiter, getHealth);
router.get('/status', healthLimiter, getStatus);

module.exports = router;
