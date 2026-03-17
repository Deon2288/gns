const Device = require('../models/Device');
const SNMPMetric = require('../models/SNMPMetric');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

// Common SNMP OIDs
const COMMON_OIDS = {
  sysDescr: '1.3.6.1.2.1.1.1.0',
  sysUpTime: '1.3.6.1.2.1.1.3.0',
  sysName: '1.3.6.1.2.1.1.5.0',
  ifNumber: '1.3.6.1.2.1.2.1.0',
  ifInOctets: '1.3.6.1.2.1.2.2.1.10.1',
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16.1',
  cpuLoad: '1.3.6.1.4.1.2021.10.1.3.1',
  memTotal: '1.3.6.1.4.1.2021.4.5.0',
  memFree: '1.3.6.1.4.1.2021.4.11.0',
};

const pollMetrics = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findByPk(deviceId);
    if (!device) throw new NotFoundError('Device not found');

    // Simulate SNMP polling (replace with actual net-snmp calls in production)
    // TODO: Use the 'net-snmp' npm package for actual SNMP polling:
    //   const session = snmp.createSession(device.ipAddress, device.snmpCommunity, { version: snmp.Version2c });
    //   session.get([oid], (err, varbinds) => { ... });
    const polledMetrics = [];
    const now = new Date();

    for (const [name, oid] of Object.entries(COMMON_OIDS)) {
      const simulatedValue = String(Math.floor(Math.random() * 10000));
      const metric = await SNMPMetric.create({
        deviceId: device.id,
        oid,
        oidName: name,
        value: simulatedValue,
        valueType: 'integer',
        polledAt: now,
      });
      polledMetrics.push(metric);
    }

    await device.update({ lastSeen: now, status: 'online' });
    res.json({ message: 'Metrics polled successfully', deviceId, metrics: polledMetrics });
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const { oid, limit = 100, from, to } = req.query;

    const device = await Device.findByPk(deviceId);
    if (!device) throw new NotFoundError('Device not found');

    const where = { deviceId };
    if (oid) where.oid = oid;
    if (from || to) {
      const { Op } = require('sequelize');
      where.polledAt = {};
      if (from) where.polledAt[Op.gte] = new Date(from);
      if (to) where.polledAt[Op.lte] = new Date(to);
    }

    const metrics = await SNMPMetric.findAll({
      where,
      order: [['polledAt', 'DESC']],
      limit: parseInt(limit),
    });

    res.json({ deviceId, metrics, total: metrics.length });
  } catch (err) {
    next(err);
  }
};

const configureSNMP = async (req, res, next) => {
  try {
    const { deviceId, community, version, port } = req.body;
    const device = await Device.findByPk(deviceId);
    if (!device) throw new NotFoundError('Device not found');

    await device.update({
      snmpEnabled: true,
      snmpCommunity: community || device.snmpCommunity,
      snmpVersion: version || device.snmpVersion,
      snmpPort: port || device.snmpPort,
    });

    res.json({ message: 'SNMP configured successfully', device });
  } catch (err) {
    next(err);
  }
};

module.exports = { pollMetrics, getHistory, configureSNMP };
