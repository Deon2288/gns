const ping = require('ping');
const ScanJob = require('../models/ScanJob');
const Device = require('../models/Device');
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

const scanNetwork = async (req, res, next) => {
  try {
    const { ipRange = '192.168.1.0/24' } = req.body;

    const job = await ScanJob.create({ ipRange, status: 'running', startedAt: new Date() });

    // Async scan (non-blocking response)
    setImmediate(async () => {
      try {
        const [baseIp] = ipRange.split('/');
        const parts = baseIp.split('.');
        const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
    // Batch ping operations to avoid overwhelming network resources (max 25 concurrent)
    const BATCH_SIZE = 25;
    const allIps = [];
    for (let i = 1; i <= 254; i++) allIps.push(`${subnet}.${i}`);

    const results = [];
    for (let i = 0; i < allIps.length; i += BATCH_SIZE) {
      const batch = allIps.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((ip) => ping.promise.probe(ip, { timeout: 1 }).then((res) => ({ ip, alive: res.alive, time: res.time })))
      );
      results.push(...batchResults);
    }
        const found = results.filter((r) => r.alive);

        // Upsert discovered devices
        for (const d of found) {
          await Device.upsert({ ipAddress: d.ip, status: 'online', lastSeen: new Date() });
        }

        await job.update({ status: 'completed', completedAt: new Date(), devicesFound: found.length, results: found });
      } catch (err) {
        logger.error('Scan error:', err);
        await job.update({ status: 'failed', errorMessage: err.message, completedAt: new Date() });
      }
    });

    res.status(202).json({ message: 'Scan started', jobId: job.id, ipRange });
  } catch (err) {
    next(err);
  }
};

const listDevices = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { ipAddress: { [Op.like]: `%${search}%` } },
        { hostname: { [Op.like]: `%${search}%` } },
        { name: { [Op.like]: `%${search}%` } },
      ];
    }
    const devices = await Device.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ devices, total: devices.length });
  } catch (err) {
    next(err);
  }
};

const getDevice = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) throw new NotFoundError('Device not found');
    res.json({ device });
  } catch (err) {
    next(err);
  }
};

const deleteDevice = async (req, res, next) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) throw new NotFoundError('Device not found');
    await device.destroy();
    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    next(err);
  }
};

const getScanStatus = async (req, res, next) => {
  try {
    const job = await ScanJob.findByPk(req.params.jobId);
    if (!job) throw new NotFoundError('Scan job not found');
    res.json({ job });
  } catch (err) {
    next(err);
  }
};

module.exports = { scanNetwork, listDevices, getDevice, deleteDevice, getScanStatus };
