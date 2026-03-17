const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');

// In-memory storage for firmware (fallback when no DB)
let firmwareList = [
  {
    id: 1,
    name: 'TRB140 Firmware',
    version: '7.8.1',
    device_type: 'TRB140',
    file_path: '/firmware/TRB140_7.8.1.bin',
    checksum: 'sha256:abc123def456',
    release_notes: 'Security patches and performance improvements',
    created_at: new Date('2024-01-15').toISOString(),
  },
  {
    id: 2,
    name: 'RUT955 Firmware',
    version: '7.7.3',
    device_type: 'RUT955',
    file_path: '/firmware/RUT955_7.7.3.bin',
    checksum: 'sha256:def789ghi012',
    release_notes: 'Bug fixes and new VPN features',
    created_at: new Date('2024-02-20').toISOString(),
  },
];

let firmwareUpdates = [
  {
    id: 1,
    device_id: 1,
    firmware_id: 1,
    status: 'success',
    progress: 100,
    started_at: new Date('2024-03-01T10:00:00').toISOString(),
    completed_at: new Date('2024-03-01T10:05:00').toISOString(),
    error_message: null,
  },
  {
    id: 2,
    device_id: 2,
    firmware_id: 2,
    status: 'failed',
    progress: 45,
    started_at: new Date('2024-03-05T14:00:00').toISOString(),
    completed_at: new Date('2024-03-05T14:02:30').toISOString(),
    error_message: 'Connection timeout during transfer',
  },
];

let nextFirmwareId = 3;
let nextUpdateId = 3;

// GET /api/firmware - List all firmware
router.get('/', async (req, res) => {
  try {
    if (req.pool) {
      const result = await req.pool.query(
        'SELECT * FROM firmware ORDER BY created_at DESC'
      );
      return res.json(result.rows);
    }
    res.json(firmwareList);
  } catch (err) {
    console.error(err);
    res.json(firmwareList);
  }
});

// POST /api/firmware/upload - Upload firmware (simulated)
router.post('/upload', async (req, res) => {
  try {
    const { name, version, device_type, release_notes } = req.body;
    if (!name || !version || !device_type) {
      return res.status(400).json({ error: 'name, version and device_type are required' });
    }

    const checksum = 'sha256:' + crypto.randomBytes(16).toString('hex');
    const file_path = `/firmware/${device_type}_${version}.bin`;

    const newFirmware = {
      id: nextFirmwareId++,
      name,
      version,
      device_type,
      file_path,
      checksum,
      release_notes: release_notes || '',
      created_at: new Date().toISOString(),
    };

    if (req.pool) {
      const result = await req.pool.query(
        `INSERT INTO firmware (name, version, device_type, file_path, checksum, release_notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [name, version, device_type, file_path, checksum, release_notes || '']
      );
      return res.status(201).json(result.rows[0]);
    }

    firmwareList.push(newFirmware);
    res.status(201).json(newFirmware);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload firmware' });
  }
});

// POST /api/firmware/deploy - Deploy firmware to devices
router.post('/deploy', async (req, res) => {
  try {
    const { firmware_id, device_ids } = req.body;
    if (!firmware_id || !Array.isArray(device_ids) || device_ids.length === 0) {
      return res.status(400).json({ error: 'firmware_id and device_ids array are required' });
    }

    const firmware = firmwareList.find((f) => f.id === parseInt(firmware_id));
    if (!firmware) {
      return res.status(404).json({ error: 'Firmware not found' });
    }

    const created = device_ids.map((device_id) => {
      const update = {
        id: nextUpdateId++,
        device_id: parseInt(device_id),
        firmware_id: parseInt(firmware_id),
        status: 'pending',
        progress: 0,
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
      };
      firmwareUpdates.push(update);

      // Simulate progress update after short delay
      setTimeout(() => {
        const u = firmwareUpdates.find((x) => x.id === update.id);
        if (u) {
          u.status = 'in_progress';
          u.progress = 50;
        }
      }, 2000);

      setTimeout(() => {
        const u = firmwareUpdates.find((x) => x.id === update.id);
        if (u) {
          u.status = 'success';
          u.progress = 100;
          u.completed_at = new Date().toISOString();
        }
      }, 5000);

      return update;
    });

    res.status(202).json({ message: 'Deployment initiated', updates: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to deploy firmware' });
  }
});

// GET /api/firmware/updates - View update history
router.get('/updates', async (req, res) => {
  try {
    if (req.pool) {
      const result = await req.pool.query(
        `SELECT fu.*, f.name as firmware_name, f.version, d.device_name
         FROM firmware_updates fu
         JOIN firmware f ON fu.firmware_id = f.id
         LEFT JOIN devices d ON fu.device_id = d.device_id
         ORDER BY fu.started_at DESC`
      );
      return res.json(result.rows);
    }
    res.json(firmwareUpdates);
  } catch (err) {
    console.error(err);
    res.json(firmwareUpdates);
  }
});

// GET /api/firmware/updates/:id - Get single update
router.get('/updates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const update = firmwareUpdates.find((u) => u.id === parseInt(id));
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }
    res.json(update);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch update' });
  }
});

// PUT /api/firmware/updates/:id/rollback - Rollback firmware
router.put('/updates/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const update = firmwareUpdates.find((u) => u.id === parseInt(id));
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    const rollback = {
      id: nextUpdateId++,
      device_id: update.device_id,
      firmware_id: update.firmware_id,
      status: 'pending',
      progress: 0,
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
      is_rollback: true,
    };

    firmwareUpdates.push(rollback);
    res.json({ message: 'Rollback initiated', rollback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rollback firmware' });
  }
});

// DELETE /api/firmware/:id - Delete firmware
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idx = firmwareList.findIndex((f) => f.id === parseInt(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'Firmware not found' });
    }
    firmwareList.splice(idx, 1);
    res.json({ message: 'Firmware deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete firmware' });
  }
});

module.exports = router;
