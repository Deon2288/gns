process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = '/tmp/gns-discovery-test.db';

const request = require('supertest');
const app = require('../server');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const Device = require('../models/Device');

let accessToken;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // Create user and login
  await User.create({ username: 'admin', email: 'admin@example.com', password: 'password123' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@example.com', password: 'password123' });
  accessToken = res.body.accessToken;
});

afterAll(async () => {
  // connection cleanup handled by --forceExit
});

describe('Discovery API', () => {
  describe('POST /api/discovery/scan', () => {
    it('should start a scan job', async () => {
      const res = await request(app)
        .post('/api/discovery/scan')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ipRange: '127.0.0.1/32' });
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('jobId');
      expect(res.body).toHaveProperty('message', 'Scan started');
    });

    it('should fail without auth', async () => {
      const res = await request(app).post('/api/discovery/scan').send({ ipRange: '127.0.0.1/32' });
      expect(res.status).toBe(401);
    });

    it('should fail with invalid IP range', async () => {
      const res = await request(app)
        .post('/api/discovery/scan')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ipRange: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/discovery/scan/:jobId', () => {
    it('should return scan job status', async () => {
      const createRes = await request(app)
        .post('/api/discovery/scan')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ipRange: '127.0.0.1/32' });
      const jobId = createRes.body.jobId;

      const res = await request(app)
        .get(`/api/discovery/scan/${jobId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.job).toHaveProperty('id', jobId);
    });

    it('should return 404 for unknown job', async () => {
      const res = await request(app)
        .get('/api/discovery/scan/99999')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/discovery/devices', () => {
    beforeAll(async () => {
      await Device.create({ ipAddress: '10.0.0.1', status: 'online' });
      await Device.create({ ipAddress: '10.0.0.2', status: 'offline' });
    });

    it('should list all devices', async () => {
      const res = await request(app)
        .get('/api/discovery/devices')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('devices');
      expect(Array.isArray(res.body.devices)).toBe(true);
    });

    it('should filter devices by status', async () => {
      const res = await request(app)
        .get('/api/discovery/devices?status=online')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.devices.every((d) => d.status === 'online')).toBe(true);
    });
  });

  describe('GET /api/discovery/devices/:id', () => {
    let deviceId;
    beforeAll(async () => {
      const device = await Device.create({ ipAddress: '192.168.1.100', status: 'online' });
      deviceId = device.id;
    });

    it('should return device details', async () => {
      const res = await request(app)
        .get(`/api/discovery/devices/${deviceId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.device).toHaveProperty('id', deviceId);
    });

    it('should return 404 for unknown device', async () => {
      const res = await request(app)
        .get('/api/discovery/devices/99999')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/discovery/devices/:id', () => {
    it('should delete a device', async () => {
      const device = await Device.create({ ipAddress: '192.168.99.99', status: 'online' });
      const res = await request(app)
        .delete(`/api/discovery/devices/${device.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Device deleted successfully');
    });

    it('should return 404 for already deleted device', async () => {
      const res = await request(app)
        .delete('/api/discovery/devices/99999')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });
});
