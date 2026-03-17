const express = require('express');
const router = express.Router();
const { getHealth, getStatus } = require('../controllers/healthController');

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
router.get('/', getHealth);
router.get('/status', getStatus);

module.exports = router;
