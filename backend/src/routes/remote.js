const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory storage for remote sessions
let remoteSessions = [
  {
    id: 1,
    device_id: 1,
    user_id: 1,
    protocol: 'ssh',
    port_mapping: '2222:22',
    started_at: new Date('2024-03-10T09:00:00').toISOString(),
    ended_at: new Date('2024-03-10T09:45:00').toISOString(),
    ip_address: '192.168.1.100',
    status: 'closed',
  },
  {
    id: 2,
    device_id: 2,
    user_id: 1,
    protocol: 'http',
    port_mapping: '8080:80',
    started_at: new Date().toISOString(),
    ended_at: null,
    ip_address: '192.168.1.101',
    status: 'active',
  },
];

let accessLogs = [
  {
    id: 1,
    session_id: 1,
    action: 'session_started',
    timestamp: new Date('2024-03-10T09:00:00').toISOString(),
    status: 'success',
    details: 'SSH session initiated',
  },
  {
    id: 2,
    session_id: 1,
    action: 'session_ended',
    timestamp: new Date('2024-03-10T09:45:00').toISOString(),
    status: 'success',
    details: 'SSH session closed normally',
  },
  {
    id: 3,
    session_id: 2,
    action: 'session_started',
    timestamp: new Date().toISOString(),
    status: 'success',
    details: 'HTTP tunnel opened',
  },
];

let nextSessionId = 3;
let nextLogId = 4;

// POST /api/remote/sessions - Create a tunnel session
router.post('/sessions', async (req, res) => {
  try {
    const { device_id, protocol, port_mapping } = req.body;
    if (!device_id || !protocol) {
      return res.status(400).json({ error: 'device_id and protocol are required' });
    }

    const validProtocols = ['ssh', 'rdp', 'vnc', 'http'];
    if (!validProtocols.includes(protocol)) {
      return res.status(400).json({ error: 'Invalid protocol. Must be one of: ssh, rdp, vnc, http' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const session = {
      id: nextSessionId++,
      device_id: parseInt(device_id),
      user_id: req.user ? req.user.userId : 1,
      protocol,
      port_mapping: port_mapping || getDefaultPortMapping(protocol),
      started_at: new Date().toISOString(),
      ended_at: null,
      ip_address: req.ip || '127.0.0.1',
      status: 'active',
      token,
    };

    remoteSessions.push(session);

    // Log session start
    accessLogs.push({
      id: nextLogId++,
      session_id: session.id,
      action: 'session_started',
      timestamp: new Date().toISOString(),
      status: 'success',
      details: `${protocol.toUpperCase()} session initiated for device ${device_id}`,
    });

    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/remote/sessions - List active sessions
router.get('/sessions', async (req, res) => {
  try {
    const { status } = req.query;
    let sessions = remoteSessions;
    if (status) {
      sessions = sessions.filter((s) => s.status === status);
    }
    // Remove sensitive token from list response
    const sanitized = sessions.map(({ token, ...s }) => s);
    res.json(sanitized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /api/remote/sessions/:id - Get session details
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = remoteSessions.find((s) => s.id === parseInt(id));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const { token, ...sanitized } = session;
    res.json(sanitized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// DELETE /api/remote/sessions/:id - Close session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = remoteSessions.find((s) => s.id === parseInt(id));
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'closed';
    session.ended_at = new Date().toISOString();

    accessLogs.push({
      id: nextLogId++,
      session_id: session.id,
      action: 'session_ended',
      timestamp: new Date().toISOString(),
      status: 'success',
      details: `${session.protocol.toUpperCase()} session closed`,
    });

    res.json({ message: 'Session closed', session_id: parseInt(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

// GET /api/remote/logs - Access audit logs
router.get('/logs', async (req, res) => {
  try {
    const { session_id, limit = 100 } = req.query;
    let logs = accessLogs;
    if (session_id) {
      logs = logs.filter((l) => l.session_id === parseInt(session_id));
    }
    res.json(logs.slice(-parseInt(limit)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// POST /api/remote/validate - Validate device accessibility
router.post('/validate', async (req, res) => {
  try {
    const { device_id, protocol } = req.body;
    if (!device_id || !protocol) {
      return res.status(400).json({ error: 'device_id and protocol are required' });
    }

    // Simulate connectivity check
    const reachable = Math.random() > 0.2; // 80% success rate in simulation
    const latency = reachable ? Math.floor(Math.random() * 50) + 5 : null;

    res.json({
      device_id: parseInt(device_id),
      protocol,
      reachable,
      latency_ms: latency,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to validate device' });
  }
});

function getDefaultPortMapping(protocol) {
  const defaults = { ssh: '2222:22', rdp: '3389:3389', vnc: '5900:5900', http: '8080:80' };
  return defaults[protocol] || '8080:80';
}

module.exports = router;
