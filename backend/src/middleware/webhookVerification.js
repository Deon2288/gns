'use strict';

const crypto = require('crypto');
const simcontrolConfig = require('../config/simcontrol');

function verifyWebhookSignature(req, res, next) {
  const secret = simcontrolConfig.webhookSecret;

  if (!secret) {
    // Dev mode: skip verification
    return next();
  }

  const signature = req.headers['x-simcontrol-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing X-SimControl-Signature header' });
  }

  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const trusted = `sha256=${expected}`;

  const valid = (() => {
    try {
      return (
        trusted.length === signature.length &&
        crypto.timingSafeEqual(
          Buffer.from(trusted, 'utf8'),
          Buffer.from(signature, 'utf8')
        )
      );
    } catch {
      return false;
    }
  })();

  if (!valid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}

module.exports = verifyWebhookSignature;
