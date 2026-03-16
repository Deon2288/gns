const express = require('express');
const router = express.Router();
const pool = require('../db');

// ─── GET /api/vpn-bridge/config ─────────────────────────────────────────────
// Returns current VPN bridge configuration
router.get('/config', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM vpn_bridge_connections ORDER BY created_at DESC LIMIT 1'
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No VPN configuration found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/vpn-bridge/config ────────────────────────────────────────────
// Creates a new VPN bridge configuration
router.post('/config', async (req, res) => {
    const {
        connection_name,
        vpn_type = 'openvpn',
        core_server = {},
        authentication = {},
        network = {},
        routes = [],
    } = req.body;

    if (!connection_name || !core_server.host) {
        return res.status(400).json({ error: 'connection_name and core_server.host are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO vpn_bridge_connections
                (connection_name, vpn_type, core_host, core_port, protocol,
                 auth_method, ca_cert_path, client_cert_path, client_key_path, tls_key_path,
                 vpn_subnet, gns_vpn_ip, core_vpn_ip, device_subnet, routes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [
                connection_name,
                vpn_type,
                core_server.host,
                core_server.port || 1194,
                core_server.protocol || 'udp',
                authentication.method || 'certificate',
                authentication.ca_cert || null,
                authentication.client_cert || null,
                authentication.client_key || null,
                authentication.tls_key || null,
                network.vpn_subnet || null,
                network.gns_vpn_ip || null,
                network.core_vpn_ip || null,
                network.device_subnet || null,
                JSON.stringify(routes),
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/vpn-bridge/config ─────────────────────────────────────────────
// Updates the active VPN bridge configuration
router.put('/config', async (req, res) => {
    const {
        vpn_id,
        connection_name,
        vpn_type,
        core_server = {},
        authentication = {},
        network = {},
        routes,
    } = req.body;

    if (!vpn_id) {
        return res.status(400).json({ error: 'vpn_id is required' });
    }

    try {
        const result = await pool.query(
            `UPDATE vpn_bridge_connections SET
                connection_name = COALESCE($1, connection_name),
                vpn_type        = COALESCE($2, vpn_type),
                core_host       = COALESCE($3, core_host),
                core_port       = COALESCE($4, core_port),
                protocol        = COALESCE($5, protocol),
                auth_method     = COALESCE($6, auth_method),
                vpn_subnet      = COALESCE($7, vpn_subnet),
                gns_vpn_ip      = COALESCE($8, gns_vpn_ip),
                core_vpn_ip     = COALESCE($9, core_vpn_ip),
                device_subnet   = COALESCE($10, device_subnet),
                routes          = COALESCE($11, routes),
                updated_at      = CURRENT_TIMESTAMP
             WHERE vpn_id = $12
             RETURNING *`,
            [
                connection_name || null,
                vpn_type || null,
                core_server.host || null,
                core_server.port || null,
                core_server.protocol || null,
                authentication.method || null,
                network.vpn_subnet || null,
                network.gns_vpn_ip || null,
                network.core_vpn_ip || null,
                network.device_subnet || null,
                routes ? JSON.stringify(routes) : null,
                vpn_id,
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'VPN configuration not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/vpn-bridge/status ─────────────────────────────────────────────
// Returns live VPN connection status
router.get('/status', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT status, vpn_ip, core_vpn_ip, uptime_seconds,
                    bandwidth_up_mb, bandwidth_down_mb, current_rate_mbps,
                    latency_ms, packet_loss_percent, connection_quality,
                    last_reconnect, last_connected
             FROM vpn_bridge_connections
             WHERE is_active = TRUE
             ORDER BY updated_at DESC LIMIT 1`
        );

        if (result.rows.length === 0) {
            return res.json({
                connected: false,
                status: 'not_configured',
                message: 'No active VPN configuration found',
            });
        }

        const vpn = result.rows[0];
        const uptimeFormatted = formatUptime(vpn.uptime_seconds || 0);

        res.json({
            connected: vpn.status === 'connected',
            status: vpn.status,
            connection_uptime: uptimeFormatted,
            vpn_ip: vpn.vpn_ip,
            core_ip: vpn.core_vpn_ip,
            bandwidth: {
                uploaded: parseFloat(vpn.bandwidth_up_mb) || 0,
                downloaded: parseFloat(vpn.bandwidth_down_mb) || 0,
                current_rate: `${vpn.current_rate_mbps || 0} Mbps`,
            },
            latency: vpn.latency_ms,
            packet_loss: parseFloat(vpn.packet_loss_percent) || 0,
            connection_quality: vpn.connection_quality || 'unknown',
            last_reconnect: vpn.last_reconnect,
            last_connected: vpn.last_connected,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/vpn-bridge/connect ───────────────────────────────────────────
// Simulates connecting the VPN tunnel
router.post('/connect', async (req, res) => {
    try {
        const vpnRow = await pool.query(
            'SELECT * FROM vpn_bridge_connections ORDER BY created_at DESC LIMIT 1'
        );
        if (vpnRow.rows.length === 0) {
            return res.status(404).json({ error: 'No VPN configuration found. Create one first.' });
        }

        const vpn = vpnRow.rows[0];
        const now = new Date();

        await pool.query(
            `UPDATE vpn_bridge_connections
             SET status = 'connected', is_active = TRUE,
                 vpn_ip = COALESCE(gns_vpn_ip, '192.168.100.1'),
                 last_connected = $1, updated_at = $1
             WHERE vpn_id = $2`,
            [now, vpn.vpn_id]
        );

        await pool.query(
            `INSERT INTO vpn_bridge_logs (vpn_id, event_type, vpn_ip, core_ip, status)
             VALUES ($1, 'connected', $2, $3, 'success')`,
            [vpn.vpn_id, vpn.gns_vpn_ip || '192.168.100.1', vpn.core_vpn_ip || vpn.core_host]
        );

        res.json({ message: 'VPN connection initiated', status: 'connected', timestamp: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/vpn-bridge/disconnect ────────────────────────────────────────
// Simulates disconnecting the VPN tunnel
router.post('/disconnect', async (req, res) => {
    try {
        const vpnRow = await pool.query(
            "SELECT * FROM vpn_bridge_connections WHERE is_active = TRUE LIMIT 1"
        );
        if (vpnRow.rows.length === 0) {
            return res.status(404).json({ error: 'No active VPN connection found' });
        }

        const vpn = vpnRow.rows[0];
        const now = new Date();

        await pool.query(
            `UPDATE vpn_bridge_connections
             SET status = 'disconnected', is_active = FALSE, updated_at = $1
             WHERE vpn_id = $2`,
            [now, vpn.vpn_id]
        );

        await pool.query(
            `INSERT INTO vpn_bridge_logs (vpn_id, event_type, vpn_ip, core_ip, status)
             VALUES ($1, 'disconnected', $2, $3, 'success')`,
            [vpn.vpn_id, vpn.vpn_ip, vpn.core_vpn_ip || vpn.core_host]
        );

        res.json({ message: 'VPN disconnected', status: 'disconnected', timestamp: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/vpn-bridge/reconnect ─────────────────────────────────────────
// Forces a VPN reconnection
router.post('/reconnect', async (req, res) => {
    try {
        const vpnRow = await pool.query(
            'SELECT * FROM vpn_bridge_connections ORDER BY updated_at DESC LIMIT 1'
        );
        if (vpnRow.rows.length === 0) {
            return res.status(404).json({ error: 'No VPN configuration found' });
        }

        const vpn = vpnRow.rows[0];
        const now = new Date();

        await pool.query(
            `UPDATE vpn_bridge_connections
             SET status = 'connected', is_active = TRUE,
                 vpn_ip = COALESCE(gns_vpn_ip, '192.168.100.1'),
                 last_reconnect = $1, last_connected = $1, updated_at = $1
             WHERE vpn_id = $2`,
            [now, vpn.vpn_id]
        );

        await pool.query(
            `INSERT INTO vpn_bridge_logs (vpn_id, event_type, vpn_ip, core_ip, status)
             VALUES ($1, 'reconnect', $2, $3, 'success')`,
            [vpn.vpn_id, vpn.gns_vpn_ip || '192.168.100.1', vpn.core_vpn_ip || vpn.core_host]
        );

        res.json({ message: 'VPN reconnection successful', status: 'connected', timestamp: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/vpn-bridge/logs ────────────────────────────────────────────────
// Returns recent VPN event logs
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const result = await pool.query(
            `SELECT l.*, v.connection_name
             FROM vpn_bridge_logs l
             LEFT JOIN vpn_bridge_connections v ON l.vpn_id = v.vpn_id
             ORDER BY l.timestamp DESC LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Helper ──────────────────────────────────────────────────────────────────
function formatUptime(seconds) {
    const s = parseInt(seconds) || 0;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
}

module.exports = router;
