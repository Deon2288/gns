'use strict';

const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const firmwareService = require('../services/firmwareService');
const otaService = require('../services/otaService');
const otaConfig = require('../config/ota');

// Ensure firmware storage directory exists
firmwareService.ensureStorageDir();

// Configure multer for firmware file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(otaConfig.FIRMWARE_STORAGE_PATH));
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: otaConfig.MAX_FIRMWARE_SIZE },
  fileFilter: (_req, file, cb) => {
    // Accept binary files and common firmware extensions
    const allowed = ['.bin', '.hex', '.img', '.fw', '.ota', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
    }
  },
});

// ---------------------------------------------------------------------------
// Firmware management endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/ota/firmware/upload
 * Upload a firmware binary.
 * Body: multipart/form-data with fields: file, version, changelog, deviceType,
 *       compatibleDevices (comma-separated), minVersion, maxVersion
 */
router.post('/firmware/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No firmware file provided' });
    }

    const firmware = firmwareService.uploadFirmware(
      req.file,
      req.body,
      req.user ? req.user.id : null
    );

    res.status(201).json({ message: 'Firmware uploaded successfully', firmware });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/ota/firmware
 * List all firmware versions.
 */
router.get('/firmware', (_req, res) => {
  res.json(firmwareService.listFirmware());
});

/**
 * GET /api/ota/firmware/:id
 * Get firmware details by ID.
 */
router.get('/firmware/:id', (req, res) => {
  const firmware = firmwareService.getFirmwareById(req.params.id);
  if (!firmware) {
    return res.status(404).json({ error: 'Firmware not found' });
  }
  res.json(firmware);
});

/**
 * DELETE /api/ota/firmware/:id
 * Delete a firmware version.
 */
router.delete('/firmware/:id', (req, res) => {
  const deleted = firmwareService.deleteFirmware(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Firmware not found' });
  }
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// OTA update endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/ota/updates/history
 * View all update history.
 * NOTE: This must be declared before /:deviceId to avoid route shadowing.
 */
router.get('/updates/history', (_req, res) => {
  res.json(otaService.getUpdateHistory());
});

/**
 * POST /api/ota/updates/schedule
 * Schedule firmware update(s) for one or more devices.
 * Body: { deviceIds: string[], firmwareId: string, scheduledAt?: string }
 */
router.post('/updates/schedule', (req, res) => {
  try {
    const { deviceIds, firmwareId, scheduledAt } = req.body;
    if (!deviceIds || !firmwareId) {
      return res.status(400).json({ error: 'deviceIds and firmwareId are required' });
    }

    const firmware = firmwareService.getFirmwareById(firmwareId);
    if (!firmware) {
      return res.status(404).json({ error: 'Firmware not found' });
    }

    const scheduled = otaService.scheduleUpdates(
      Array.isArray(deviceIds) ? deviceIds : [deviceIds],
      firmwareId,
      scheduledAt || null
    );

    res.status(201).json({ message: 'Updates scheduled', updates: scheduled });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/ota/updates/:deviceId/start
 * Start an immediate OTA update for a device.
 * Body: { firmwareId: string }
 */
router.post('/updates/:deviceId/start', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { firmwareId } = req.body;

    if (!firmwareId) {
      return res.status(400).json({ error: 'firmwareId is required' });
    }

    const firmware = firmwareService.getFirmwareById(firmwareId);
    if (!firmware) {
      return res.status(404).json({ error: 'Firmware not found' });
    }

    const update = otaService.startUpdate(deviceId, firmwareId);
    res.status(201).json({ message: 'Update started', update });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/ota/updates/:deviceId
 * Get the current update status for a device.
 */
router.get('/updates/:deviceId', (req, res) => {
  const update = otaService.getDeviceUpdate(req.params.deviceId);
  if (!update) {
    return res.status(404).json({ error: 'No update found for this device' });
  }
  const logs = otaService.getUpdateLogs(update.id);
  res.json({ update, logs });
});

/**
 * POST /api/ota/updates/:deviceId/cancel
 * Cancel a pending or in-progress update for a device.
 */
router.post('/updates/:deviceId/cancel', (req, res) => {
  try {
    const cancelled = otaService.cancelUpdate(req.params.deviceId);
    if (!cancelled) {
      return res.status(404).json({ error: 'No cancellable update found for this device' });
    }
    res.json({ message: 'Update cancelled', update: cancelled });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/ota/updates/:deviceId/rollback
 * Rollback a device to its previous firmware version.
 */
router.post('/updates/:deviceId/rollback', (req, res) => {
  try {
    const rollback = otaService.rollbackDevice(req.params.deviceId);
    res.status(201).json({ message: 'Rollback initiated', update: rollback });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
