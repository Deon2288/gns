'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const ctrl = require('../controllers/settingsController');

const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

router.use(limiter);

router.get('/simcontrol', ctrl.getSettings);
router.post('/simcontrol', ctrl.updateSettings);
router.post('/simcontrol/test', ctrl.testConnection);
router.get('/simcontrol/sync-logs', ctrl.getSyncLogs);

module.exports = router;
