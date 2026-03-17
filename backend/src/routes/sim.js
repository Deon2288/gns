'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ctrl = require('../controllers/simController');

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

router.use(limiter);

router.get('/devices', ctrl.listDevicesWithSIM);
router.get('/devices/:deviceId', ctrl.getDeviceWithSIM);
router.post('/devices/:deviceId/link', ctrl.linkDeviceToSIM);
router.delete('/devices/:deviceId/unlink', ctrl.unlinkDeviceFromSIM);
router.get('/sync/status', ctrl.getSyncStatus);
router.post('/sync/now', ctrl.triggerSync);
router.get('/metrics/dashboard', ctrl.getDashboardMetrics);
// Parameterised routes last to avoid shadowing static ones
router.get('/:simControlId', ctrl.getSIMFromProvider);
router.get('/:simControlId/usage', ctrl.getSIMUsage);
router.get('/:simControlId/balance', ctrl.getSIMBalance);
router.post('/:simControlId/suspend', ctrl.suspendSIM);
router.post('/:simControlId/reactivate', ctrl.reactivateSIM);

module.exports = router;
