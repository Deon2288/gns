const express = require('express');
const router = express.Router();
const { scanNetwork, listDevices, getDevice, deleteDevice, getScanStatus } = require('../controllers/discoveryController');
const { authenticate } = require('../middleware/auth');
const { scanValidation } = require('../utils/validators');

/**
 * @swagger
 * /api/discovery/scan:
 *   post:
 *     summary: Start a network scan
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/scan', authenticate, scanValidation, scanNetwork);

/**
 * @swagger
 * /api/discovery/scan/{jobId}:
 *   get:
 *     summary: Get scan job status
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/scan/:jobId', authenticate, getScanStatus);

/**
 * @swagger
 * /api/discovery/devices:
 *   get:
 *     summary: List discovered devices
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/devices', authenticate, listDevices);

/**
 * @swagger
 * /api/discovery/devices/{id}:
 *   get:
 *     summary: Get device details
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/devices/:id', authenticate, getDevice);

/**
 * @swagger
 * /api/discovery/devices/{id}:
 *   delete:
 *     summary: Delete a device
 *     tags: [Discovery]
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/devices/:id', authenticate, deleteDevice);

module.exports = router;
