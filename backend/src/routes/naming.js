const express = require('express');
const router = express.Router();

// In-memory storage (replace with DB in production)
let namingRules = [];
let ruleIdCounter = 1;

// ─── Naming Rules CRUD ───────────────────────────────────────────────────────

// Get all naming rules
router.get('/rules', (req, res) => {
    res.json(namingRules.sort((a, b) => a.priority - b.priority));
});

// Create a naming rule
router.post('/rules', (req, res) => {
    const {
        rule_name,
        pattern,
        variables = {},
        conditions = {},
        enabled = true,
        priority = namingRules.length + 1,
        snmp_enabled = false,
        snmp_config = null,
        apply_to_new_scans = true,
    } = req.body;

    if (!rule_name || !pattern) {
        return res.status(400).json({ message: 'rule_name and pattern are required' });
    }

    const rule = {
        rule_id: `rule-${ruleIdCounter++}`,
        rule_name,
        pattern,
        variables,
        conditions,
        enabled,
        priority,
        snmp_enabled,
        snmp_config,
        apply_to_new_scans,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    namingRules.push(rule);
    res.status(201).json(rule);
});

// Update a naming rule
router.put('/rules/:id', (req, res) => {
    const index = namingRules.findIndex(r => r.rule_id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Rule not found' });

    namingRules[index] = {
        ...namingRules[index],
        ...req.body,
        rule_id: namingRules[index].rule_id,
        created_at: namingRules[index].created_at,
        updated_at: new Date().toISOString(),
    };

    res.json(namingRules[index]);
});

// Delete a naming rule
router.delete('/rules/:id', (req, res) => {
    const index = namingRules.findIndex(r => r.rule_id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Rule not found' });

    namingRules.splice(index, 1);
    res.status(204).send();
});

// ─── Test Naming Pattern ──────────────────────────────────────────────────────

router.post('/test', (req, res) => {
    const { pattern, device } = req.body;

    if (!pattern || !device) {
        return res.status(400).json({ message: 'pattern and device are required' });
    }

    const name = applyPattern(pattern, device);
    res.json({ pattern, device, result: name });
});

// ─── SNMP Configuration ──────────────────────────────────────────────────────

router.post('/snmp', (req, res) => {
    const {
        enabled = true,
        community_string = 'public',
        version = '2c',
        timeout = 5000,
        oid_name = '1.3.6.1.2.1.1.5.0',
        prefix = '',
        suffix = '',
    } = req.body;

    // In production, store globally and use in scans
    res.json({
        message: 'SNMP configuration saved',
        config: { enabled, community_string, version, timeout, oid_name, prefix, suffix },
    });
});

// ─── Apply Naming Rules ──────────────────────────────────────────────────────

router.post('/apply', (req, res) => {
    const { device_ids, rule_id } = req.body;

    if (!device_ids || !Array.isArray(device_ids)) {
        return res.status(400).json({ message: 'device_ids array is required' });
    }

    let rule = null;
    if (rule_id) {
        rule = namingRules.find(r => r.rule_id === rule_id);
        if (!rule) return res.status(404).json({ message: 'Rule not found' });
    }

    // In a real system, fetch devices from DB and apply name
    const applied = device_ids.map(id => ({
        device_id: id,
        applied_rule: rule ? rule.rule_name : 'default',
        new_name: rule ? applyPattern(rule.pattern, { device_id: id }) : id,
    }));

    res.json({ applied_count: applied.length, devices: applied });
});

// ─── Pattern Engine ──────────────────────────────────────────────────────────

function applyPattern(pattern, device) {
    const counters = {};

    return pattern.replace(/\{(\w+)\}/g, (match, variable) => {
        switch (variable) {
            case 'manufacturer': return device.manufacturer || 'Unknown';
            case 'model':        return device.model || 'Unknown';
            case 'protocol':     return (device.protocol || 'unknown').toUpperCase();
            case 'serial':       return device.serial || device.device_id || '000000';
            case 'imei':         return device.imei || '000000000000000';
            case 'ip':           return device.ip || '0.0.0.0';
            case 'subnet': {
                if (!device.ip) return '0.0.0';
                const parts = device.ip.split('.');
                return `${parts[0]}.${parts[1]}.${parts[2]}`;
            }
            case 'host': {
                if (!device.ip) return '0';
                return device.ip.split('.').pop();
            }
            case 'location': return device.location || device.ip_range || 'Unknown';
            case 'counter': {
                const key = pattern;
                counters[key] = (counters[key] || 0) + 1;
                return String(counters[key]).padStart(3, '0');
            }
            case 'timestamp': return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            case 'snmp_name':  return device.snmp_name || 'UnknownHost';
            default: return match;
        }
    });
}

module.exports = router;
module.exports.applyPattern = applyPattern;
