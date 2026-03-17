import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './VPNManagement.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://197.242.150.120:5000';

interface VPNNetwork {
  id: number;
  name: string;
  description: string;
  protocol: string;
  status: string;
  created_at: string;
}

interface VPNNode {
  id: number;
  vpn_network_id: number;
  device_id: number;
  ip_address: string;
  is_gateway: boolean;
  status: string;
}

interface VPNTunnel {
  id: number;
  from_node_id: number;
  to_node_id: number;
  status: string;
  bandwidth_usage: number;
  latency: number;
  created_at: string;
}

interface NetworkStatus {
  network: VPNNetwork;
  nodes: VPNNode[];
  tunnels: VPNTunnel[];
  summary: {
    total_nodes: number;
    connected_nodes: number;
    total_tunnels: number;
    active_tunnels: number;
  };
}

export const VPNManagement: React.FC = () => {
  const [networks, setNetworks] = useState<VPNNetwork[]>([]);
  const [nodes, setNodes] = useState<VPNNode[]>([]);
  const [activeTab, setActiveTab] = useState<'networks' | 'create' | 'topology'>('networks');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    protocol: 'wireguard',
  });
  const [addNodeForm, setAddNodeForm] = useState({
    device_id: '',
    ip_address: '',
    is_gateway: false,
  });
  const [addNodeNetworkId, setAddNodeNetworkId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchNetworks();
    fetchNodes();
  }, []);

  const fetchNetworks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/vpn/networks`);
      setNetworks(res.data);
    } catch (err) {
      console.error('Error fetching VPN networks:', err);
    }
  };

  const fetchNodes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/vpn/nodes`);
      setNodes(res.data);
    } catch (err) {
      console.error('Error fetching nodes:', err);
    }
  };

  const fetchNetworkStatus = async (networkId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/api/vpn/networks/${networkId}/status`);
      setSelectedNetwork(res.data);
    } catch (err) {
      console.error('Error fetching network status:', err);
    }
  };

  const handleCreateNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/api/vpn/networks`, createForm);
      setMessage({ type: 'success', text: 'VPN network created successfully!' });
      setCreateForm({ name: '', description: '', protocol: 'wireguard' });
      fetchNetworks();
      setActiveTab('networks');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create network' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNetwork = async (id: number) => {
    if (!window.confirm('Delete this VPN network?')) return;
    try {
      await axios.delete(`${API_BASE}/api/vpn/networks/${id}`);
      setMessage({ type: 'success', text: 'VPN network deleted.' });
      fetchNetworks();
      if (selectedNetwork?.network.id === id) setSelectedNetwork(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete network' });
    }
  };

  const handleAddNode = async (networkId: number) => {
    if (!addNodeForm.device_id || !addNodeForm.ip_address) {
      setMessage({ type: 'error', text: 'Device ID and IP address are required' });
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/vpn/networks/${networkId}/nodes`, addNodeForm);
      setMessage({ type: 'success', text: 'Node added to VPN!' });
      setAddNodeForm({ device_id: '', ip_address: '', is_gateway: false });
      setAddNodeNetworkId(null);
      fetchNodes();
      fetchNetworkStatus(networkId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add node' });
    }
  };

  const handleRemoveNode = async (networkId: number, nodeId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/vpn/networks/${networkId}/nodes/${nodeId}`);
      setMessage({ type: 'success', text: 'Node removed from VPN.' });
      fetchNodes();
      fetchNetworkStatus(networkId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to remove node' });
    }
  };

  const getProtocolBadge = (protocol: string) => {
    return protocol === 'wireguard' ? 'badge-wireguard' : 'badge-ipsec';
  };

  return (
    <div className="vpn-container">
      <div className="vpn-header">
        <h2>🔒 VPN Management</h2>
        <p>Create and manage point-to-multipoint VPN networks with IPSec and WireGuard</p>
      </div>

      {message && (
        <div className={`alert-msg ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="vpn-tabs">
        <button
          className={`tab-btn ${activeTab === 'networks' ? 'active' : ''}`}
          onClick={() => setActiveTab('networks')}
        >
          🌐 VPN Networks
        </button>
        <button
          className={`tab-btn ${activeTab === 'topology' ? 'active' : ''}`}
          onClick={() => setActiveTab('topology')}
        >
          🗺️ Network Topology
        </button>
        <button
          className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          ➕ Create Network
        </button>
      </div>

      {activeTab === 'networks' && (
        <div className="networks-list">
          {networks.length === 0 ? (
            <div className="empty-state">No VPN networks. Create one to get started.</div>
          ) : (
            <div className="network-cards">
              {networks.map((network) => {
                const networkNodes = nodes.filter((n) => n.vpn_network_id === network.id);
                return (
                  <div key={network.id} className="network-card">
                    <div className="network-card-header">
                      <div>
                        <div className="network-name">{network.name}</div>
                        <div className="network-desc">{network.description}</div>
                      </div>
                      <div className="network-badges">
                        <span className={`badge ${getProtocolBadge(network.protocol)}`}>
                          {network.protocol.toUpperCase()}
                        </span>
                        <span className={`badge ${network.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                          {network.status}
                        </span>
                      </div>
                    </div>

                    <div className="network-stats">
                      <div className="net-stat">
                        <span className="net-stat-value">{networkNodes.length}</span>
                        <span className="net-stat-label">Nodes</span>
                      </div>
                      <div className="net-stat">
                        <span className="net-stat-value">
                          {networkNodes.filter((n) => n.status === 'connected').length}
                        </span>
                        <span className="net-stat-label">Connected</span>
                      </div>
                      <div className="net-stat">
                        <span className="net-stat-value">
                          {networkNodes.filter((n) => n.is_gateway).length}
                        </span>
                        <span className="net-stat-label">Gateways</span>
                      </div>
                    </div>

                    {networkNodes.length > 0 && (
                      <div className="node-list">
                        <div className="node-list-title">Nodes:</div>
                        {networkNodes.map((node) => (
                          <div key={node.id} className="node-item">
                            <span className="node-ip">{node.ip_address}</span>
                            {node.is_gateway && <span className="badge badge-gateway">GW</span>}
                            <span className={`badge ${node.status === 'connected' ? 'badge-success' : 'badge-secondary'}`}>
                              {node.status}
                            </span>
                            <button
                              className="btn-remove-node"
                              onClick={() => handleRemoveNode(network.id, node.id)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {addNodeNetworkId === network.id && (
                      <div className="add-node-form">
                        <input
                          type="number"
                          placeholder="Device ID"
                          value={addNodeForm.device_id}
                          onChange={(e) => setAddNodeForm({ ...addNodeForm, device_id: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="IP Address (e.g. 10.0.0.5)"
                          value={addNodeForm.ip_address}
                          onChange={(e) => setAddNodeForm({ ...addNodeForm, ip_address: e.target.value })}
                        />
                        <label className="gateway-check">
                          <input
                            type="checkbox"
                            checked={addNodeForm.is_gateway}
                            onChange={(e) => setAddNodeForm({ ...addNodeForm, is_gateway: e.target.checked })}
                          />
                          Gateway
                        </label>
                        <button className="btn-primary-sm" onClick={() => handleAddNode(network.id)}>
                          Add
                        </button>
                        <button className="btn-cancel-sm" onClick={() => setAddNodeNetworkId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="network-actions">
                      <button
                        className="btn-add-node"
                        onClick={() => {
                          setAddNodeNetworkId(network.id);
                          fetchNetworkStatus(network.id);
                        }}
                      >
                        ➕ Add Node
                      </button>
                      <button
                        className="btn-view-status"
                        onClick={() => {
                          fetchNetworkStatus(network.id);
                          setActiveTab('topology');
                        }}
                      >
                        📊 Status
                      </button>
                      <button
                        className="btn-delete-network"
                        onClick={() => handleDeleteNetwork(network.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'topology' && (
        <div className="topology-view">
          {!selectedNetwork ? (
            <div className="empty-state">
              Select a network from the Networks tab to view its topology.
            </div>
          ) : (
            <div>
              <div className="topology-header">
                <h3>{selectedNetwork.network.name}</h3>
                <div className="topology-summary">
                  <span>Total nodes: {selectedNetwork.summary.total_nodes}</span>
                  <span>Connected: {selectedNetwork.summary.connected_nodes}</span>
                  <span>Tunnels: {selectedNetwork.summary.active_tunnels}/{selectedNetwork.summary.total_tunnels}</span>
                </div>
              </div>
              <div className="topology-canvas">
                <div className="topology-nodes">
                  {selectedNetwork.nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`topology-node ${node.is_gateway ? 'gateway' : ''} ${node.status}`}
                    >
                      <div className="node-icon">{node.is_gateway ? '🌐' : '📡'}</div>
                      <div className="node-label">Device #{node.device_id}</div>
                      <div className="node-ip">{node.ip_address}</div>
                      <div className={`node-status ${node.status}`}>{node.status}</div>
                    </div>
                  ))}
                </div>
                {selectedNetwork.tunnels.length > 0 && (
                  <div className="tunnel-list">
                    <h4>Active Tunnels</h4>
                    {selectedNetwork.tunnels.map((tunnel) => (
                      <div key={tunnel.id} className="tunnel-item">
                        <span>
                          Node #{tunnel.from_node_id} ↔ Node #{tunnel.to_node_id}
                        </span>
                        <span className={`badge ${tunnel.status === 'up' ? 'badge-success' : 'badge-danger'}`}>
                          {tunnel.status}
                        </span>
                        <span className="tunnel-metric">{tunnel.bandwidth_usage} Mbps</span>
                        <span className="tunnel-metric">{tunnel.latency} ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="create-form-container">
          <form className="create-form" onSubmit={handleCreateNetwork}>
            <h3>Create VPN Network</h3>
            <div className="form-group">
              <label>Network Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Branch Office VPN"
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="form-group">
              <label>Protocol *</label>
              <div className="protocol-grid">
                {['wireguard', 'ipsec'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`protocol-btn ${createForm.protocol === p ? 'active' : ''}`}
                    onClick={() => setCreateForm({ ...createForm, protocol: p })}
                  >
                    {p === 'wireguard' ? '🛡️' : '🔐'} {p.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="protocol-info">
                {createForm.protocol === 'wireguard'
                  ? '⚡ WireGuard: Modern, fast, and simple VPN protocol with excellent performance'
                  : '🔒 IPSec: Industry-standard protocol with broad device compatibility'}
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : '🔒 Create VPN Network'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
