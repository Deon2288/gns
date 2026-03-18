'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const otaConfig = require('../config/ota');

// In-memory store for firmware versions
const firmwareVersions = new Map();

/**
 * Calculate SHA256 checksum of a file.
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} Hex-encoded SHA256 checksum.
 */
function calculateChecksum(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Ensure the firmware storage directory exists.
 */
function ensureStorageDir() {
  const dir = path.resolve(otaConfig.FIRMWARE_STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Upload and register a new firmware version.
 * @param {object} fileInfo - Multer file object.
 * @param {object} metadata - { version, changelog, deviceType, compatibleDevices, minVersion, maxVersion }
 * @param {string} createdBy - User ID.
 * @returns {object} Firmware version record.
 */
function uploadFirmware(fileInfo, metadata, createdBy) {
  const { version, changelog, deviceType, compatibleDevices, minVersion, maxVersion } = metadata;

  if (!version) {
    throw new Error('Firmware version is required');
  }

  if (firmwareVersions.has(version)) {
    throw new Error(`Firmware version ${version} already exists`);
  }

  if (fileInfo.size > otaConfig.MAX_FIRMWARE_SIZE) {
    throw new Error(`Firmware file exceeds maximum size of ${otaConfig.MAX_FIRMWARE_SIZE} bytes`);
  }

  const checksum = calculateChecksum(fileInfo.path);
  const id = crypto.randomUUID();

  const firmware = {
    id,
    version,
    filename: fileInfo.originalname,
    filePath: fileInfo.path,
    file_size: fileInfo.size,
    checksum,
    changelog: changelog || '',
    device_type: deviceType || null,
    compatible_devices: compatibleDevices
      ? (Array.isArray(compatibleDevices) ? compatibleDevices : compatibleDevices.split(',').map(s => s.trim()))
      : [],
    min_version: minVersion || null,
    max_version: maxVersion || null,
    created_at: new Date().toISOString(),
    created_by: createdBy || null,
    upload_status: 'verified',
  };

  firmwareVersions.set(id, firmware);
  return firmware;
}

/**
 * List all firmware versions.
 * @returns {object[]} Array of firmware version records.
 */
function listFirmware() {
  return Array.from(firmwareVersions.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

/**
 * Get a firmware version by ID.
 * @param {string} id - Firmware ID.
 * @returns {object|null} Firmware record or null.
 */
function getFirmwareById(id) {
  return firmwareVersions.get(id) || null;
}

/**
 * Delete a firmware version by ID.
 * @param {string} id - Firmware ID.
 * @returns {boolean} True if deleted, false if not found.
 */
function deleteFirmware(id) {
  const firmware = firmwareVersions.get(id);
  if (!firmware) {
    return false;
  }

  // Remove the file if it exists
  if (firmware.filePath && fs.existsSync(firmware.filePath)) {
    try {
      fs.unlinkSync(firmware.filePath);
    } catch (_) {
      // Log but don't fail if file removal fails
    }
  }

  firmwareVersions.delete(id);
  return true;
}

/**
 * Verify firmware checksum integrity.
 * @param {string} id - Firmware ID.
 * @returns {boolean} True if checksum matches.
 */
function verifyFirmwareChecksum(id) {
  const firmware = firmwareVersions.get(id);
  if (!firmware || !firmware.filePath || !fs.existsSync(firmware.filePath)) {
    return false;
  }
  const currentChecksum = calculateChecksum(firmware.filePath);
  return currentChecksum === firmware.checksum;
}

module.exports = {
  uploadFirmware,
  listFirmware,
  getFirmwareById,
  deleteFirmware,
  verifyFirmwareChecksum,
  calculateChecksum,
  ensureStorageDir,
};
