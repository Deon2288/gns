'use strict';

const express = require('express');
const router = express.Router();
const verifyWebhookSignature = require('../middleware/webhookVerification');
const { handleSimControlWebhook } = require('../controllers/webhookController');

router.post('/simcontrol', verifyWebhookSignature, handleSimControlWebhook);

module.exports = router;
