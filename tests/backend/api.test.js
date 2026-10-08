/**
 * API integration tests: real Express app + in-memory MongoDB.
 *
 * MongoMemoryServer reuses the locally downloaded mongod binary
 * (MONGOMS_SYSTEM_BINARY) so no second multi-hundred-MB download occurs.
 */

import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

const MONGOD_BIN =
  process.env.MONGOMS_SYSTEM_BINARY ||
  'C:\\Users\\kaviy\\AppData\\Local\\Temp\\opencode\\mongodb-bin\\mongodb-win32-x86_64-windows-7.0.24\\bin\\mongod.exe';

let mongod;
let app;
let disconnectDB;

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const donorPayload = () => ({
  name: 'Test Donor',
  email: `donor-${unique()}@test.local`,
  password: 'Secret@123',
  phone: '+91 90000 11111',
  role: 'donor',
  bloodGroup: 'O+',
  dateOfBirth: '1996-04-12',
  gender: 'male',
  weight: 72,
  city: 'Delhi',
  state: 'Delhi',
  latitude: 28.61,
  longitude: 77.21,
});

const requesterPayload = () => ({
  name: 'Test Hospital',
  email: `hospital-${unique()}@test.local`,
  password: 'Secret@123',
  phone: '+91 90000 22222',
  role: 'requester',
  organizationName: 'Test General Hospital',
  organizationType: 'hospital',
  city: 'Delhi',
});

async function registerUser(payload) {
  const res = await request(app).post('/api/auth/register').send(payload);
  return res;
}

let adminToken;
let donorToken;
let donorId;
let requesterToken;

beforeAll(async () => {
  process.env.MONGOMS_SYSTEM_BINARY = MONGOD_BIN;
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('blood_bank_test');
  process.env.TZ = 'UTC';

  ({ default: app } = await import('../../backend/src/app.js'));
  const db = await import('../../backend/src/config/db.js');
  disconnectDB = db.disconnectDB;
  await db.connectDB();

  // Fast auth fixtures (unique emails per run); admin accounts cannot self-register
  const { default: User } = await import('../../backend/src/models/User.js');
  const adminUser = new User({ name: 'Suite Admin', email: `admin-${unique()}@test.local`, phone: '+91 90000 33333', role: 'admin' });
  await adminUser.setPassword('Secret@123');
  await adminUser.save();
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: adminUser.email, password: 'Secret@123' });
  adminToken = adminLogin.body.data?.token;

  const donor = await registerUser(donorPayload());
  donorToken = donor.body.data?.token;
  donorId = donor.body.data?.user?.id;

  const requester = await registerUser(requesterPayload());
  requesterToken = requester.body.data?.token;
}, 120000);

afterAll(async () => {
  if (disconnectDB) await disconnectDB();
  if (mongod) await mongod.stop();
});

describe('auth', () => {
  test('register returns token + safe user object', async () => {
    const res = await registerUser(donorPayload());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toMatch(/@test\.local$/);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('duplicate email is rejected with 409', async () => {
    const p = donorPayload();
    await registerUser(p);
    const res = await request(app).post('/api/auth/register').send(p);
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('EMAIL_TAKEN');
  });

  test('cannot self-register as admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Evil Admin', email: `evil-${unique()}@test.local`, password: 'Secret@123', phone: '+91 90000 44444', role: 'admin' });
    expect(res.status).toBe(422);
  });

  test('login with wrong password fails with 401', async () => {
    const p = donorPayload();
    await registerUser(p);
    const res = await request(app).post('/api/auth/login').send({ email: p.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  test('login + /me round-trip', async () => {
    const p = donorPayload();
    await registerUser(p);
    const login = await request(app).post('/api/auth/login').send({ email: p.email, password: p.password });
    expect(login.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(p.email.toLowerCase());
    expect(me.body.data.profile).toHaveProperty('bloodGroup');
  });

  test('protected route rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('rbac', () => {
  test('donor token cannot access admin dashboard (403)', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${donorToken}`);
    expect(res.status).toBe(403);
  });

  test('admin token can access admin dashboard', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.cards).toHaveProperty('totalDonors');
    expect(res.body.data.cards).toHaveProperty('availableUnits');
  });

  test('donor cannot create emergency requests (403)', async () => {
    const res = await request(app)
      .post('/api/emergency-requests')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        patientName: 'X Y', hospital: 'A Hospital', contactNumber: '+91 90000 00000',
        bloodGroup: 'A+', requiredUnits: 2, latitude: 28.6, longitude: 77.2,
        requiredAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(res.status).toBe(403);
  });

  test('requester can access priority queue', async () => {
    const res = await request(app).get('/api/emergency-requests/priority-queue').set('Authorization', `Bearer ${requesterToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('emergency requests', () => {
  let requestId;

  test('requester creates a request; priority is auto-classified', async () => {
    const res = await request(app)
      .post('/api/emergency-requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        patientName: 'Integration Patient',
        hospital: 'Test General Hospital',
        contactNumber: '+91 90000 33333',
        bloodGroup: 'O-',
        requiredUnits: 4,
        latitude: 28.6139,
        longitude: 77.209,
        address: 'Test Street, Delhi',
        requiredAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // within 2h
        emergencyLevel: 'critical',
        notes: 'severe bleeding, ICU',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.priority).toBe('CRITICAL');
    expect(res.body.data.priorityScore).toBeGreaterThanOrEqual(110);
    expect(res.body.data.status).toMatch(/Pending|Matching/);
    requestId = res.body.data._id;
  });

  test('validation rejects malformed request (422)', async () => {
    const res = await request(app)
      .post('/api/emergency-requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ patientName: 'X', bloodGroup: 'Z+' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  test('queue orders CRITICAL first and reflects the new request', async () => {
    const res = await request(app).get('/api/emergency-requests/priority-queue?includeResolved=true').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const priorities = res.body.data.map((r) => r.priority);
    const rank = { CRITICAL: 0, URGENT: 1, NORMAL: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(rank[priorities[i]]).toBeGreaterThanOrEqual(rank[priorities[i - 1]]);
    }
    expect(priorities).toContain('CRITICAL');
  });

  test('admin can run matching for the request', async () => {
    const res = await request(app)
      .post(`/api/emergency-requests/${requestId}/match?radiusKm=500&notify=false`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('matches');
  });
});

describe('inventory', () => {
  test('admin lists inventory with stock summary', async () => {
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('stockSummary');
    expect(typeof res.body.meta.stockSummary['O+']).toBe('number');
  });

  test('admin adds and removes a batch', async () => {
    const create = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bloodGroup: 'AB-',
        units: 2,
        batchNumber: `SUITE-${unique()}`.toUpperCase(),
        collectionDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        location: 'Test Blood Bank',
      });
    expect(create.status).toBe(201);

    const del = await request(app)
      .delete(`/api/inventory/${create.body.data._id}?mode=discard`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(del.status);
  });

  test('donor cannot modify inventory (403)', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ bloodGroup: 'A+', units: 1, batchNumber: 'X', collectionDate: new Date().toISOString(), expiryDate: new Date(Date.now() + 86400000).toISOString(), location: 'L' });
    expect(res.status).toBe(403);
  });
});

describe('eligibility', () => {
  test('rules endpoint returns rules + medical disclaimer', async () => {
    const res = await request(app).get('/api/eligibility/rules').set('Authorization', `Bearer ${donorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rules).toHaveProperty('deferralDaysAfterDonation', 56);
    expect(res.body.data.disclaimer).toMatch(/medical|healthcare|not a substitute|professional/i);
  });

  test('donor screening returns structured result', async () => {
    const res = await request(app)
      .post('/api/eligibility/check')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ weightKg: 72, age: 28, answers: {} });
    expect(res.status).toBe(201);
    expect(['ELIGIBLE', 'NOT_ELIGIBLE']).toContain(res.body.data.result);
    expect(res.body.data).toHaveProperty('reasons');
    expect(res.body.data).toHaveProperty('checkId');
  });

  test('ineligible screening explains why', async () => {
    const res = await request(app)
      .post('/api/eligibility/check')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ weightKg: 40, age: 28, answers: {} });
    expect(res.status).toBe(201);
    expect(res.body.data.result).toBe('NOT_ELIGIBLE');
    expect(res.body.data.reasons.join(' ')).toMatch(/50/);
  });
});

describe('notifications + rewards', () => {
  test('donor sees own notifications only', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${donorToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('unread');
  });

  test('reward summary returns zero-balance shape for new donor', async () => {
    const res = await request(app).get('/api/rewards').set('Authorization', `Bearer ${donorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('points');
    expect(res.body.data).toHaveProperty('history');
  });

  test('admin send without userId is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'general', title: 't', message: 'm' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  test('admin send to a user delivers in-app notification', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: donorId, type: 'general', title: 'Suite notice', message: 'hello', channels: ['inapp'] });
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${donorToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((n) => n.title === 'Suite notice')).toBe(true);
  });

  test('non-admin cannot send notifications', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ userId: donorId, title: 't', message: 'm' });
    expect(res.status).toBe(403);
  });
});

describe('predictions + reports (admin)', () => {
  test('demand prediction endpoint responds with model metadata', async () => {
    const res = await request(app)
      .post('/api/prediction/demand')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ forecastDays: 7 });
    expect(res.status).toBe(200);
    const preds = res.body.data;
    expect(Array.isArray(preds)).toBe(true);
    expect(preds.length).toBe(8);
    for (const p of preds) {
      expect(p).toHaveProperty('predictedDemand');
      expect(p).toHaveProperty('riskLevel');
      expect(p.modelMeta).toHaveProperty('model');
    }
  }, 60000);

  test('report types list is exposed', async () => {
    const res = await request(app).get('/api/admin/reports/types').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.arrayContaining(['donors', 'blood_stock', 'emergency_requests']));
  });

  test('donors CSV report returns CSV content', async () => {
    const res = await request(app)
      .get('/api/admin/reports?type=donors&format=csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Accept', 'text/csv');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Name');
    expect(res.text.split('\n').length).toBeGreaterThan(1);
  });
});
