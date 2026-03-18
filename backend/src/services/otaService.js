'use strict';

const crypto = require('crypto');
const otaConfig = require('../config/ota');

// In-memory store: Map of updateId -> update record
const updates = new Map();

// In-memory store: Map of updateId -> log entries[]
const updateLogs = new Map();

// Timeout handles: Map of updateId -> timeoutHandle
const timeoutHandles = new Map();

// WebSocket broadcast function - set externally via setWsBroadcast()
let wsBroadcast = null;

/**
 * Set the WebSocket broadcast function.
 * @param {Function} broadcastFn - Function that broadcasts a message to all connected clients.
 */
function setWsBroadcast(broadcastFn) {
  wsBroadcast = broadcastFn;
}

/**
 * Broadcast an update event to WebSocket clients.
 * @param {string} event - Event type.
 * @param {object} data - Event data.
 */
function broadcast(event, data) {
  if (typeof wsBroadcast === 'function') {
    wsBroadcast({ event, data });
  }
}

/**
 * Append a log entry to an update.
 * @param {string} updateId - Update ID.
 * @param {string} level - Log level: 'info', 'warning', 'error'.
 * @param {string} message - Log message.
 * @param {object} [deviceResponse] - Optional device response payload.
 */
function appendLog(updateId, level, message, deviceResponse) {
  const entry = {
    id: crypto.randomUUID(),
    update_id: updateId,
    timestamp: new Date().toISOString(),
    level,
    message,
    device_response: deviceResponse || null,
  };

  if (!updateLogs.has(updateId)) {
    updateLogs.set(updateId, []);
  }
  updateLogs.get(updateId).push(entry);
  return entry;
}

/**
 * Schedule an OTA update for one or more devices.
 * @param {string[]} deviceIds - Array of device IDs.
 * @param {string} firmwareId - Target firmware ID.
 * @param {string|null} scheduledAt - ISO timestamp for scheduled start, or null for immediate.
 * @returns {object[]} Created update records.
 */
function scheduleUpdates(deviceIds, firmwareId, scheduledAt) {
  if (!deviceIds || !deviceIds.length) {
    throw new Error('At least one device ID is required');
  }
  if (!firmwareId) {
    throw new Error('Firmware ID is required');
  }

  return deviceIds.map(deviceId => {
    const id = crypto.randomUUID();
    const update = {
      id,
      device_id: deviceId,
      firmware_id: firmwareId,
      scheduled_at: scheduledAt || null,
      started_at: null,
      completed_at: null,
      status: scheduledAt ? 'scheduled' : 'pending',
      progress_percentage: 0,
      current_step: null,
      error_message: null,
      previous_firmware_id: null,
      rollback_available: true,
      attempts: 0,
      max_attempts: otaConfig.MAX_RETRY_ATTEMPTS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    updates.set(id, update);
    appendLog(id, 'info', `Update scheduled for device ${deviceId}`);
    broadcast('update_scheduled', update);
    return update;
  });
}

/**
 * Update the status and progress of an update record.
 * @param {string} updateId
 * @param {object} fields - Fields to update.
 */
function patchUpdate(updateId, fields) {
  const update = updates.get(updateId);
  if (!update) return null;

  Object.assign(update, fields, { updated_at: new Date().toISOString() });
  updates.set(updateId, update);
  broadcast('update_progress', update);
  return update;
}

/**
 * Start an OTA update immediately for a device.
 * Simulates the update workflow with progress steps.
 * @param {string} deviceId
 * @param {string} firmwareId
 * @returns {object} Created update record.
 */
function startUpdate(deviceId, firmwareId) {
  if (!deviceId) throw new Error('Device ID is required');
  if (!firmwareId) throw new Error('Firmware ID is required');

  const id = crypto.randomUUID();
  const update = {
    id,
    device_id: deviceId,
    firmware_id: firmwareId,
    scheduled_at: null,
    started_at: new Date().toISOString(),
    completed_at: null,
    status: 'downloading',
    progress_percentage: 0,
    current_step: 'Initiating download',
    error_message: null,
    previous_firmware_id: null,
    rollback_available: true,
    attempts: 1,
    max_attempts: otaConfig.MAX_RETRY_ATTEMPTS,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  updates.set(id, update);
  appendLog(id, 'info', `Starting OTA update for device ${deviceId}, firmware ${firmwareId}`);
  broadcast('update_started', update);

  // Set timeout
  const timeoutHandle = setTimeout(() => {
    const current = updates.get(id);
    if (current && !['completed', 'failed', 'cancelled', 'rolled_back'].includes(current.status)) {
      patchUpdate(id, { status: 'failed', error_message: 'Update timed out' });
      appendLog(id, 'error', 'Update timed out');
    }
  }, otaConfig.UPDATE_TIMEOUT_MS);
  timeoutHandles.set(id, timeoutHandle);

  return update;
}

/**
 * Simulate update progress steps (called by deviceOTAHandler or tests).
 * @param {string} updateId
 * @param {number} progress - 0 to 100.
 * @param {string} step - Current step description.
 * @param {string} [status] - Optional status override.
 */
function reportProgress(updateId, progress, step, status) {
  const update = updates.get(updateId);
  if (!update) return null;

  const newStatus = status || (progress >= 100 ? 'completed' : update.status);
  const fields = {
    progress_percentage: Math.min(100, Math.max(0, progress)),
    current_step: step,
    status: newStatus,
  };

  if (newStatus === 'completed') {
    fields.completed_at = new Date().toISOString();
    clearUpdateTimeout(updateId);
  } else if (['failed', 'cancelled', 'rolled_back'].includes(newStatus)) {
    clearUpdateTimeout(updateId);
  }

  appendLog(updateId, 'info', `Progress ${progress}%: ${step}`);
  return patchUpdate(updateId, fields);
}

/**
 * Cancel a pending or in-progress update.
 * @param {string} deviceId
 * @returns {object|null} Cancelled update or null.
 */
function cancelUpdate(deviceId) {
  const update = getDeviceUpdate(deviceId);
  if (!update) return null;

  const cancelable = ['pending', 'scheduled', 'downloading', 'installing'];
  if (!cancelable.includes(update.status)) {
    throw new Error(`Cannot cancel update in status: ${update.status}`);
  }

  clearUpdateTimeout(update.id);
  appendLog(update.id, 'info', `Update cancelled for device ${deviceId}`);
  return patchUpdate(update.id, { status: 'cancelled', completed_at: new Date().toISOString() });
}

/**
 * Rollback a device to its previous firmware version.
 * @param {string} deviceId
 * @returns {object} New rollback update record.
 */
function rollbackDevice(deviceId) {
  const update = getDeviceUpdate(deviceId);
  if (!update) {
    throw new Error(`No update found for device ${deviceId}`);
  }

  if (!update.rollback_available || !update.previous_firmware_id) {
    throw new Error('Rollback not available: no previous firmware version recorded');
  }

  // Mark existing update as rolled back
  patchUpdate(update.id, { status: 'rolled_back', rollback_available: false });

  // Create a new rollback update
  return startUpdate(deviceId, update.previous_firmware_id);
}

/**
 * Get the most recent update for a device.
 * @param {string} deviceId
 * @returns {object|null} Update record or null.
 */
function getDeviceUpdate(deviceId) {
  const deviceUpdates = Array.from(updates.values())
    .filter(u => u.device_id === deviceId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return deviceUpdates[0] || null;
}

/**
 * Get all updates (history).
 * @returns {object[]} All update records sorted by created_at desc.
 */
function getUpdateHistory() {
  return Array.from(updates.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

/**
 * Get logs for a specific update.
 * @param {string} updateId
 * @returns {object[]} Log entries.
 */
function getUpdateLogs(updateId) {
  return updateLogs.get(updateId) || [];
}

/**
 * Clear timeout handle for an update.
 * @param {string} updateId
 */
function clearUpdateTimeout(updateId) {
  const handle = timeoutHandles.get(updateId);
  if (handle) {
    clearTimeout(handle);
    timeoutHandles.delete(updateId);
  }
}

/**
 * Retry a failed update with exponential backoff.
 * @param {string} updateId
 * @returns {object|null} Updated record or null if max retries reached.
 */
function retryUpdate(updateId) {
  const update = updates.get(updateId);
  if (!update || update.status !== 'failed') {
    return null;
  }

  if (update.attempts >= update.max_attempts) {
    appendLog(updateId, 'error', `Max retry attempts (${update.max_attempts}) reached`);
    return null;
  }

  const backoffMs = otaConfig.RETRY_BACKOFF_MS * Math.pow(2, update.attempts - 1);
  appendLog(updateId, 'info', `Retrying update in ${backoffMs}ms (attempt ${update.attempts + 1}/${update.max_attempts})`);

  return new Promise(resolve => {
    setTimeout(() => {
      patchUpdate(updateId, {
        status: 'downloading',
        attempts: update.attempts + 1,
        error_message: null,
        progress_percentage: 0,
        current_step: 'Retrying download',
        started_at: new Date().toISOString(),
      });
      resolve(updates.get(updateId));
    }, backoffMs);
  });
}

module.exports = {
  setWsBroadcast,
  scheduleUpdates,
  startUpdate,
  reportProgress,
  cancelUpdate,
  rollbackDevice,
  getDeviceUpdate,
  getUpdateHistory,
  getUpdateLogs,
  retryUpdate,
  appendLog,
};
