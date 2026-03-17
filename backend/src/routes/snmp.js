const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { pollMetrics, getHistory, configureSNMP } = require('../controllers/snmpController');
const { authenticate } = require('../middleware/auth');
const { snmpConfigValidation } = require('../utils/validators');

const snmpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/snmp/poll/{deviceId}:
 *   post:
 *     summary: Poll SNMP metrics for a device
 *     tags: [SNMP]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/poll/:deviceId', snmpLimiter, authenticate, pollMetrics);

/**
 * @swagger
 * /api/snmp/history/{deviceId}:
 *   get:
 *     summary: Get SNMP metric history for a device
 *     tags: [SNMP]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/history/:deviceId', snmpLimiter, authenticate, getHistory);

/**
 * @swagger
 * /api/snmp/configure:
 *   post:
 *     summary: Configure SNMP settings for a device
 *     tags: [SNMP]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/configure', snmpLimiter, authenticate, snmpConfigValidation, configureSNMP);

module.exports = router;
