const express = require('express');
const router = express.Router();
const { pollMetrics, getHistory, configureSNMP } = require('../controllers/snmpController');
const { authenticate } = require('../middleware/auth');
const { snmpConfigValidation } = require('../utils/validators');

/**
 * @swagger
 * /api/snmp/poll/{deviceId}:
 *   post:
 *     summary: Poll SNMP metrics for a device
 *     tags: [SNMP]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/poll/:deviceId', authenticate, pollMetrics);

/**
 * @swagger
 * /api/snmp/history/{deviceId}:
 *   get:
 *     summary: Get SNMP metric history for a device
 *     tags: [SNMP]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/history/:deviceId', authenticate, getHistory);

/**
 * @swagger
 * /api/snmp/configure:
 *   post:
 *     summary: Configure SNMP settings for a device
 *     tags: [SNMP]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/configure', authenticate, snmpConfigValidation, configureSNMP);

module.exports = router;
