const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { scanNetwork, listDevices, getDevice, deleteDevice, getScanStatus } = require('../controllers/discoveryController');
const { authenticate } = require('../middleware/auth');
const { scanValidation } = require('../utils/validators');

const discoveryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/discovery/scan:
 *   post:
 *     summary: Start a network scan
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/scan', discoveryLimiter, authenticate, scanValidation, scanNetwork);

/**
 * @swagger
 * /api/discovery/scan/{jobId}:
 *   get:
 *     summary: Get scan job status
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/scan/:jobId', discoveryLimiter, authenticate, getScanStatus);

/**
 * @swagger
 * /api/discovery/devices:
 *   get:
 *     summary: List discovered devices
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/devices', discoveryLimiter, authenticate, listDevices);

/**
 * @swagger
 * /api/discovery/devices/{id}:
 *   get:
 *     summary: Get device details
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/devices/:id', discoveryLimiter, authenticate, getDevice);

/**
 * @swagger
 * /api/discovery/devices/{id}:
 *   delete:
 *     summary: Delete a device
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/devices/:id', discoveryLimiter, authenticate, deleteDevice);

module.exports = router;
