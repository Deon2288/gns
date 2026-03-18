'use strict';

/**
 * deviceOTAHandler.js
 *
 * Handles device communication for OTA updates via MQTT (if available)
 * and REST polling. Simulates the device protocol when MQTT is not configured.
 */

const otaService = require('./otaService');
const otaConfig = require('../config/ota');

// MQTT client - lazily initialised if mqtt package is available and configured
let mqttClient = null;

/**
 * Try to initialise the MQTT client from environment variables.
 * Silently skips if MQTT_BROKER_URL is not set or mqtt is not installed.
 */
function initMqtt() {
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) return;

  try {
    // eslint-disable-next-line global-require
    const mqtt = require('mqtt');
    const options = {
      clientId: `gns-ota-handler-${Date.now()}`,
    };
    if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
    if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

    mqttClient = mqtt.connect(brokerUrl, options);

    mqttClient.on('connect', () => {
      console.log('[OTA] MQTT connected to', brokerUrl);
      // Subscribe to all device OTA status topics
      mqttClient.subscribe('/device/+/ota/status', err => {
        if (err) console.error('[OTA] MQTT subscribe error:', err);
      });
    });

    mqttClient.on('message', (topic, payload) => {
      // Topic format: /device/{deviceId}/ota/status
      const match = topic.match(/^\/device\/([^/]+)\/ota\/status$/);
      if (!match) return;
      const deviceId = match[1];
      handleDeviceStatusMessage(deviceId, payload);
    });

    mqttClient.on('error', err => {
      console.error('[OTA] MQTT error:', err.message);
    });
  } catch (_) {
    // mqtt package not installed – fall back to polling only
  }
}

/**
 * Handle an incoming OTA status message from a device.
 * @param {string} deviceId
 * @param {Buffer} payload - JSON payload from device.
 */
function handleDeviceStatusMessage(deviceId, payload) {
  try {
    const msg = JSON.parse(payload.toString());
    const { updateId, progress, step, status, error } = msg;
    if (!updateId) return;

    if (error) {
      otaService.reportProgress(updateId, msg.progress || 0, step || 'Error', 'failed');
      otaService.appendLog(updateId, 'error', error, msg);
    } else {
      otaService.reportProgress(updateId, progress || 0, step || '', status);
    }
  } catch (err) {
    console.error('[OTA] Failed to parse device status message:', err.message);
  }
}

/**
 * Send OTA command to a device via MQTT or log it for REST polling.
 * @param {string} deviceId
 * @param {object} command - { updateId, firmwareUrl, checksum, version }
 */
function sendOtaCommand(deviceId, command) {
  const topic = `/device/${deviceId}/ota/command`;
  const payload = JSON.stringify(command);

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, payload, { qos: 1 }, err => {
      if (err) console.error(`[OTA] Failed to publish to ${topic}:`, err.message);
      else console.log(`[OTA] Sent OTA command to ${deviceId}`);
    });
  } else {
    // MQTT not available – log for REST-based polling
    console.log(`[OTA] (no MQTT) Would send to ${topic}:`, payload);
  }
}

/**
 * Start polling a device for health/status during an update.
 * Returns a handle that can be cleared with clearInterval.
 * @param {string} deviceId
 * @param {string} updateId
 * @param {Function} fetchStatus - Async function that returns { progress, step, status, error }.
 * @returns {NodeJS.Timeout}
 */
function startPolling(deviceId, updateId, fetchStatus) {
  const handle = setInterval(async () => {
    try {
      const status = await fetchStatus(deviceId);
      if (!status) return;

      const { progress, step, status: updateStatus, error } = status;

      if (error) {
        otaService.reportProgress(updateId, progress || 0, step || 'Error', 'failed');
        otaService.appendLog(updateId, 'error', error);
        clearInterval(handle);
      } else if (['completed', 'failed', 'cancelled', 'rolled_back'].includes(updateStatus)) {
        otaService.reportProgress(updateId, progress || 100, step || updateStatus, updateStatus);
        clearInterval(handle);
      } else {
        otaService.reportProgress(updateId, progress || 0, step || '');
      }
    } catch (err) {
      console.error(`[OTA] Polling error for device ${deviceId}:`, err.message);
    }
  }, otaConfig.POLLING_INTERVAL_MS);

  return handle;
}

// Initialise MQTT on module load
initMqtt();

module.exports = {
  sendOtaCommand,
  startPolling,
  handleDeviceStatusMessage,
};
