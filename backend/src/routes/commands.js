const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const VALID_COMMANDS = ['lock', 'unlock', 'immobilize', 'activate', 'reboot', 'request_location', 'sos_cancel'];

// GET /api/commands - list command queue
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { device_id, status } = req.query;
    let sql = `SELECT c.*, d.device_name FROM device_command_queue c LEFT JOIN devices d ON d.device_id = c.device_id WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (device_id) { sql += ` AND c.device_id = $${idx++}`; params.push(device_id); }
    if (status) { sql += ` AND c.status = $${idx++}`; params.push(status); }
    sql += ' ORDER BY c.created_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch commands' });
  }
});

// POST /api/commands - send a command to a device
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { device_id, command, payload } = req.body;
    if (!device_id || !command) return res.status(400).json({ message: 'device_id and command are required' });
    if (!VALID_COMMANDS.includes(command)) {
      return res.status(400).json({ message: `Invalid command. Valid: ${VALID_COMMANDS.join(', ')}` });
    }
    const device = await query('SELECT device_id, status FROM devices WHERE device_id = $1', [device_id]);
    if (device.rows.length === 0) return res.status(404).json({ message: 'Device not found' });
    const result = await query(
      `INSERT INTO device_command_queue (device_id, command, payload, issued_by, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [device_id, command, payload ? JSON.stringify(payload) : null, req.user.userId]
    );
    const cmd = result.rows[0];
    const io = req.app.get('io');
    if (io) io.to(`device_${device_id}`).emit('command', cmd);
    res.status(201).json(cmd);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send command' });
  }
});

// PATCH /api/commands/:id/status - device acknowledges command
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, response } = req.body;
    const validStatuses = ['pending', 'sent', 'acknowledged', 'completed', 'failed'];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const result = await query(
      'UPDATE device_command_queue SET status = $1, response = $2, updated_at = NOW() WHERE command_id = $3 RETURNING *',
      [status, response || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Command not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update command status' });
  }
});

// DELETE /api/commands/:id - cancel a pending command
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      "UPDATE device_command_queue SET status = 'failed', updated_at = NOW() WHERE command_id = $1 AND status = 'pending' RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Pending command not found' });
    res.json({ message: 'Command cancelled', command: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to cancel command' });
  }
});

module.exports = router;
