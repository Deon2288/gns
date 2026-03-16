const express = require('express');
const router = express.Router();

// In-memory storage (replace with DB in production)
let notificationConfig = {
    email_on_scan_complete: true,
    email_on_new_devices: true,
    new_device_threshold: 1,
    email_on_registration: true,
    email_on_failure: true,
    recipients: [],
    reply_to: 'noreply@gns.example.com',
};

let notificationHistory = [];
let historyIdCounter = 1;

// ─── Config Endpoints ────────────────────────────────────────────────────────

// Get current notification configuration
router.get('/config', (req, res) => {
    res.json(notificationConfig);
});

// Update notification configuration
router.post('/config', (req, res) => {
    const {
        email_on_scan_complete,
        email_on_new_devices,
        new_device_threshold,
        email_on_registration,
        email_on_failure,
        recipients,
        reply_to,
    } = req.body;

    if (email_on_scan_complete !== undefined) notificationConfig.email_on_scan_complete = email_on_scan_complete;
    if (email_on_new_devices !== undefined) notificationConfig.email_on_new_devices = email_on_new_devices;
    if (new_device_threshold !== undefined) notificationConfig.new_device_threshold = new_device_threshold;
    if (email_on_registration !== undefined) notificationConfig.email_on_registration = email_on_registration;
    if (email_on_failure !== undefined) notificationConfig.email_on_failure = email_on_failure;
    if (recipients !== undefined) notificationConfig.recipients = recipients;
    if (reply_to !== undefined) notificationConfig.reply_to = reply_to;

    res.json({ message: 'Configuration updated', config: notificationConfig });
});

// ─── Send Notification Endpoint ──────────────────────────────────────────────

// Manually trigger a notification
router.post('/send', (req, res) => {
    const { event_type, subject, body, recipients } = req.body;

    if (!event_type || !subject) {
        return res.status(400).json({ message: 'event_type and subject are required' });
    }

    const notifRecipients = recipients || notificationConfig.recipients;

    if (!notifRecipients.length) {
        return res.status(400).json({ message: 'No recipients configured' });
    }

    const notification = logNotification(event_type, notifRecipients, subject, 'sent');
    // In production, integrate with Nodemailer or SendGrid here

    res.json({ message: 'Notification queued', notification });
});

// ─── History Endpoint ────────────────────────────────────────────────────────

// Get notification history
router.get('/history', (req, res) => {
    const { event_type, status, limit = 50 } = req.query;
    let history = notificationHistory;

    if (event_type) history = history.filter(n => n.event_type === event_type);
    if (status) history = history.filter(n => n.status === status);

    res.json(history.slice(-parseInt(limit)));
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logNotification(eventType, recipients, subject, status) {
    const notification = {
        notification_id: `notif-${historyIdCounter++}`,
        event_type: eventType,
        recipients,
        subject,
        status,
        sent_at: new Date().toISOString(),
        opened_at: null,
    };
    notificationHistory.push(notification);
    return notification;
}

// Allow other modules to trigger notifications programmatically
function triggerNotification(eventType, subject, extraRecipients) {
    const config = notificationConfig;
    const recipients = extraRecipients || config.recipients;

    const shouldSend =
        (eventType === 'scan_complete' && config.email_on_scan_complete) ||
        (eventType === 'new_devices' && config.email_on_new_devices) ||
        (eventType === 'registration' && config.email_on_registration) ||
        (eventType === 'scan_failure' && config.email_on_failure) ||
        eventType === 'device_status_change';

    if (shouldSend && recipients.length) {
        return logNotification(eventType, recipients, subject, 'sent');
    }
    return null;
}

module.exports = router;
module.exports.triggerNotification = triggerNotification;
