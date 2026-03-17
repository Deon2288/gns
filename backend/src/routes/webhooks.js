const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config/simcontrol');

// -----------------------------------------------------------------------
// Verify SimControl webhook signature
// -----------------------------------------------------------------------
function verifyWebhookSignature(req) {
    if (!config.webhookSecret) return true; // skip verification if not configured

    const signature = req.headers['x-simcontrol-signature'] || req.headers['x-webhook-signature'];
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', config.webhookSecret);
    hmac.update(JSON.stringify(req.body));
    const expected = 'sha256=' + hmac.digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

// -----------------------------------------------------------------------
// POST /api/webhooks/simcontrol  – receive SIM events from SimControl
// -----------------------------------------------------------------------
router.post('/simcontrol', async (req, res) => {
    if (!verifyWebhookSignature(req)) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const { event, sim_id, data } = req.body;

    if (!event || !sim_id) {
        return res.status(400).json({ error: 'Missing event or sim_id' });
    }

    try {
        // Find the local sim_device record for this SimControl SIM
        const simDeviceResult = await req.pool.query(
            'SELECT * FROM sim_devices WHERE sim_control_id = $1',
            [sim_id]
        );
        const simDevice = simDeviceResult.rows[0];

        switch (event) {
            case 'sim.status_changed':
            case 'sim.activated':
            case 'sim.suspended':
            case 'sim.deactivated': {
                if (simDevice) {
                    await req.pool.query(`
                        INSERT INTO sim_metrics
                            (sim_device_id, status, operator, signal_strength, data_used_mb, data_limit_mb, balance, last_updated, timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                    `, [
                        simDevice.id,
                        data.status ?? null,
                        data.operator ?? null,
                        data.signal_strength ?? null,
                        data.data_used_mb ?? null,
                        data.data_limit_mb ?? null,
                        data.balance ?? null,
                    ]);
                    // Update last_synced
                    await req.pool.query(
                        'UPDATE sim_devices SET last_synced = NOW() WHERE id = $1',
                        [simDevice.id]
                    );
                }

                // Create an alert for status changes
                if (simDevice && data.status) {
                    const severity = data.status === 'suspended' ? 'high' : 'low';
                    await req.pool.query(`
                        INSERT INTO alerts (device_id, alert_type, message, severity, acknowledged, created_at)
                        VALUES ($1, $2, $3, $4, false, NOW())
                    `, [
                        simDevice.device_id,
                        'SIM Status Change',
                        `SIM ${sim_id} status changed to: ${data.status}`,
                        severity,
                    ]);
                }
                break;
            }

            case 'sim.data_limit_warning': {
                if (simDevice) {
                    await req.pool.query(`
                        INSERT INTO alerts (device_id, alert_type, message, severity, acknowledged, created_at)
                        VALUES ($1, $2, $3, $4, false, NOW())
                    `, [
                        simDevice.device_id,
                        'SIM Data Limit Warning',
                        `SIM ${sim_id} is approaching its data limit. Used: ${data.data_used_mb ?? '?'} MB of ${data.data_limit_mb ?? '?'} MB`,
                        'high',
                    ]);
                }
                break;
            }

            case 'sim.balance_low': {
                if (simDevice) {
                    await req.pool.query(`
                        INSERT INTO alerts (device_id, alert_type, message, severity, acknowledged, created_at)
                        VALUES ($1, $2, $3, $4, false, NOW())
                    `, [
                        simDevice.device_id,
                        'SIM Low Balance',
                        `SIM ${sim_id} has a low balance: R${data.balance ?? '?'}`,
                        'medium',
                    ]);
                }
                break;
            }

            case 'sim.operator_changed': {
                if (simDevice) {
                    await req.pool.query(`
                        INSERT INTO sim_metrics
                            (sim_device_id, operator, last_updated, timestamp)
                        VALUES ($1, $2, NOW(), NOW())
                    `, [simDevice.id, data.operator ?? null]);

                    await req.pool.query(`
                        INSERT INTO alerts (device_id, alert_type, message, severity, acknowledged, created_at)
                        VALUES ($1, $2, $3, $4, false, NOW())
                    `, [
                        simDevice.device_id,
                        'SIM Operator Change',
                        `SIM ${sim_id} operator changed to: ${data.operator ?? 'Unknown'}`,
                        'low',
                    ]);
                }
                break;
            }

            default:
                console.log(`Unhandled SimControl webhook event: ${event}`);
        }

        res.json({ received: true, event, sim_id });
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.status(500).json({ error: 'Failed to process webhook' });
    }
});

module.exports = router;
