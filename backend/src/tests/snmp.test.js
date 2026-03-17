process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = '/tmp/gns-snmp-test.db';

const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Device = require('../models/Device');
const SNMPMetric = require('../models/SNMPMetric');

let accessToken;
let testDevice;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await User.create({ username: 'snmpuser', email: 'snmp@example.com', password: 'password123' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'snmp@example.com', password: 'password123' });
  accessToken = res.body.accessToken;
  testDevice = await Device.create({ ipAddress: '10.10.10.1', status: 'online' });
});

afterAll(async () => {
  // connection cleanup handled by --forceExit
});

describe('SNMP API', () => {
  describe('POST /api/snmp/poll/:deviceId', () => {
    it('should poll metrics for a device', async () => {
      const res = await request(app)
        .post(`/api/snmp/poll/${testDevice.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metrics');
      expect(Array.isArray(res.body.metrics)).toBe(true);
      expect(res.body.metrics.length).toBeGreaterThan(0);
    });

    it('should return 404 for unknown device', async () => {
      const res = await request(app)
        .post('/api/snmp/poll/99999')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const res = await request(app).post(`/api/snmp/poll/${testDevice.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/snmp/history/:deviceId', () => {
    beforeAll(async () => {
      await SNMPMetric.create({
        deviceId: testDevice.id,
        oid: '1.3.6.1.2.1.1.1.0',
        oidName: 'sysDescr',
        value: 'Test Device',
        polledAt: new Date(),
      });
    });

    it('should return metric history', async () => {
      const res = await request(app)
        .get(`/api/snmp/history/${testDevice.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metrics');
      expect(Array.isArray(res.body.metrics)).toBe(true);
    });

    it('should filter by OID', async () => {
      const res = await request(app)
        .get(`/api/snmp/history/${testDevice.id}?oid=1.3.6.1.2.1.1.1.0`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.metrics.every((m) => m.oid === '1.3.6.1.2.1.1.1.0')).toBe(true);
    });

    it('should return 404 for unknown device', async () => {
      const res = await request(app)
        .get('/api/snmp/history/99999')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/snmp/configure', () => {
    it('should configure SNMP for a device', async () => {
      const res = await request(app)
        .post('/api/snmp/configure')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: testDevice.id, community: 'private', version: '2c', port: 161 });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('SNMP configured successfully');
    });

    it('should fail with invalid deviceId', async () => {
      const res = await request(app)
        .post('/api/snmp/configure')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown device', async () => {
      const res = await request(app)
        .post('/api/snmp/configure')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: 99999, community: 'public' });
      expect(res.status).toBe(404);
    });
  });
});
