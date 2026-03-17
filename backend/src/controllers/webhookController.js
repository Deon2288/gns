'use strict';

const { processWebhookEvent } = require('../services/simAlertService');
const pool = require('../db');

async function handleSimControlWebhook(req, res) {
  const event = req.body;

  if (!event || !event.type) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    await processWebhookEvent(event, pool);
    res.json({ received: true });
  } catch (err) {
    console.error('[webhookController] handleSimControlWebhook:', err.message);
    res.status(500).json({ error: 'Failed to process webhook event' });
  }
}

module.exports = { handleSimControlWebhook };
