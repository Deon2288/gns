const express = require('express');
const router = express.Router();

// In-memory VPN data
let vpnNetworks = [
  {
    id: 1,
    name: 'Main Office VPN',
    description: 'Connects all branch offices to headquarters',
    protocol: 'wireguard',
    status: 'active',
    created_at: new Date('2024-01-10').toISOString(),
  },
  {
    id: 2,
    name: 'Remote Workers',
    description: 'VPN for remote employee access',
    protocol: 'ipsec',
    status: 'active',
    created_at: new Date('2024-02-05').toISOString(),
  },
];

let vpnNodes = [
  {
    id: 1,
    vpn_network_id: 1,
    device_id: 1,
    ip_address: '10.0.0.1',
    is_gateway: true,
    status: 'connected',
  },
  {
    id: 2,
    vpn_network_id: 1,
    device_id: 2,
    ip_address: '10.0.0.2',
    is_gateway: false,
    status: 'connected',
  },
  {
    id: 3,
    vpn_network_id: 2,
    device_id: 3,
    ip_address: '10.1.0.1',
    is_gateway: true,
    status: 'connected',
  },
];

let vpnTunnels = [
  {
    id: 1,
    from_node_id: 1,
    to_node_id: 2,
    status: 'up',
    bandwidth_usage: 1.24,
    latency: 12,
    created_at: new Date('2024-01-10').toISOString(),
  },
];

let nextNetworkId = 3;
let nextNodeId = 4;
let nextTunnelId = 2;

// GET /api/vpn/networks - List VPN networks
router.get('/networks', async (req, res) => {
  try {
    if (req.pool) {
      const result = await req.pool.query(
        'SELECT * FROM vpn_networks ORDER BY created_at DESC'
      );
      return res.json(result.rows);
    }
    res.json(vpnNetworks);
  } catch (err) {
    console.error(err);
    res.json(vpnNetworks);
  }
});

// POST /api/vpn/networks - Create VPN network
router.post('/networks', async (req, res) => {
  try {
    const { name, description, protocol } = req.body;
    if (!name || !protocol) {
      return res.status(400).json({ error: 'name and protocol are required' });
    }

    const validProtocols = ['ipsec', 'wireguard'];
    if (!validProtocols.includes(protocol)) {
      return res.status(400).json({ error: 'Protocol must be ipsec or wireguard' });
    }

    const network = {
      id: nextNetworkId++,
      name,
      description: description || '',
      protocol,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    if (req.pool) {
      const result = await req.pool.query(
        `INSERT INTO vpn_networks (name, description, protocol, status, created_at)
         VALUES ($1, $2, $3, 'active', NOW()) RETURNING *`,
        [name, description || '', protocol]
      );
      return res.status(201).json(result.rows[0]);
    }

    vpnNetworks.push(network);
    res.status(201).json(network);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create VPN network' });
  }
});

// GET /api/vpn/networks/:id - Get network details
router.get('/networks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const network = vpnNetworks.find((n) => n.id === parseInt(id));
    if (!network) {
      return res.status(404).json({ error: 'VPN network not found' });
    }
    res.json(network);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch VPN network' });
  }
});

// DELETE /api/vpn/networks/:id - Delete network
router.delete('/networks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idx = vpnNetworks.findIndex((n) => n.id === parseInt(id));
    if (idx === -1) {
      return res.status(404).json({ error: 'VPN network not found' });
    }
    vpnNetworks.splice(idx, 1);
    res.json({ message: 'VPN network deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete VPN network' });
  }
});

// GET /api/vpn/networks/:id/status - Network status
router.get('/networks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const network = vpnNetworks.find((n) => n.id === parseInt(id));
    if (!network) {
      return res.status(404).json({ error: 'VPN network not found' });
    }

    const nodes = vpnNodes.filter((n) => n.vpn_network_id === parseInt(id));
    const tunnels = vpnTunnels.filter((t) => {
      const nodeIds = nodes.map((n) => n.id);
      return nodeIds.includes(t.from_node_id) || nodeIds.includes(t.to_node_id);
    });

    const connectedNodes = nodes.filter((n) => n.status === 'connected').length;

    res.json({
      network,
      nodes,
      tunnels,
      summary: {
        total_nodes: nodes.length,
        connected_nodes: connectedNodes,
        total_tunnels: tunnels.length,
        active_tunnels: tunnels.filter((t) => t.status === 'up').length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch network status' });
  }
});

// POST /api/vpn/networks/:id/nodes - Add device to VPN
router.post('/networks/:id/nodes', async (req, res) => {
  try {
    const { id } = req.params;
    const { device_id, ip_address, is_gateway } = req.body;

    if (!device_id || !ip_address) {
      return res.status(400).json({ error: 'device_id and ip_address are required' });
    }

    const network = vpnNetworks.find((n) => n.id === parseInt(id));
    if (!network) {
      return res.status(404).json({ error: 'VPN network not found' });
    }

    const node = {
      id: nextNodeId++,
      vpn_network_id: parseInt(id),
      device_id: parseInt(device_id),
      ip_address,
      is_gateway: is_gateway || false,
      status: 'connected',
    };

    vpnNodes.push(node);
    res.status(201).json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add node' });
  }
});

// DELETE /api/vpn/networks/:id/nodes/:node_id - Remove device from VPN
router.delete('/networks/:id/nodes/:node_id', async (req, res) => {
  try {
    const { id, node_id } = req.params;
    const idx = vpnNodes.findIndex(
      (n) => n.id === parseInt(node_id) && n.vpn_network_id === parseInt(id)
    );
    if (idx === -1) {
      return res.status(404).json({ error: 'Node not found' });
    }
    vpnNodes.splice(idx, 1);
    res.json({ message: 'Node removed from VPN' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove node' });
  }
});

// GET /api/vpn/tunnels/:id/metrics - Tunnel metrics
router.get('/tunnels/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const tunnel = vpnTunnels.find((t) => t.id === parseInt(id));
    if (!tunnel) {
      return res.status(404).json({ error: 'Tunnel not found' });
    }

    // Simulate real-time metrics
    const metrics = {
      ...tunnel,
      bandwidth_usage: parseFloat((Math.random() * 10).toFixed(2)),
      latency: Math.floor(Math.random() * 30) + 5,
      packets_sent: Math.floor(Math.random() * 100000),
      packets_received: Math.floor(Math.random() * 100000),
      uptime_seconds: Math.floor(Math.random() * 86400),
      last_handshake: new Date(Date.now() - Math.random() * 60000).toISOString(),
    };

    res.json(metrics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tunnel metrics' });
  }
});

// GET /api/vpn/nodes - List all nodes
router.get('/nodes', async (req, res) => {
  try {
    res.json(vpnNodes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch nodes' });
  }
});

module.exports = router;
