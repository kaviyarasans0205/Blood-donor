/* eslint-disable no-console */
/**
 * Development seed for the Smart Blood Donor Management and Emergency Response System.
 * Run from backend/:  npm run seed   (node ../database-seed/seed.js)
 *
 * Creates realistic demo data for every module: users of all roles, donors across
 * Indian cities, inventory batches (including expiring/expired), emergency requests
 * in every state, 6 months of donation history (feeds demand prediction), appointments,
 * notifications, reward transactions, alerts and system settings.
 *
 * Dev credentials:
 *   admin@lifeline.test    / Admin@12345    (admin)
 *   hospital@lifeline.test / Hospital@12345 (requester, City General Hospital)
 *   donor@lifeline.test    / Donor@12345    (donor, O+)
 */

const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');

const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const mongoose = backendRequire('mongoose');
const dotenv = backendRequire('dotenv');
const dns = require('dns');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

// Same resolver override as backend/src/config/index.js (VPN/security tools can
// leave c-ares with no DNS servers -> 127.0.0.1 -> ECONNREFUSED on SRV lookups).
if (process.env.MONGO_DNS_SERVERS) {
  const servers = process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blood_bank';
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysAhead = (n) => new Date(Date.now() + n * DAY);

const CITIES = {
  Delhi: { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.209, pin: '110001' },
  Mumbai: { city: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777, pin: '400001' },
  Chennai: { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, pin: '600001' },
  Bengaluru: { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, pin: '560001' },
  Kolkata: { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, pin: '700001' },
  Hyderabad: { city: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867, pin: '500001' },
  Pune: { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, pin: '411001' },
  Jaipur: { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, pin: '302001' },
};

const DEFERRED = 56; // days between whole-blood donations (default rule)

async function main() {
  const models = await import(pathToFileURL(path.join(__dirname, '..', 'backend', 'src', 'models', 'index.js')).href);
  const {
    User, Donor, Requester, BloodInventory, EmergencyRequest, Donation, Appointment,
    Notification, RewardTransaction, Alert, SystemSettings, EligibilityCheck, AuditLog, DemandPrediction,
  } = models;

  console.log(`Connecting to ${MONGO_URI.replace(/\/\/[^@]*@/, '//***@')} …`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Dropping database for a clean seed …');
  await mongoose.connection.dropDatabase();

  // ---------------------------------------------------------------- users
  const mkUser = async (name, email, password, phone, role) => {
    const u = new User({ name, email, phone, role });
    await u.setPassword(password);
    await u.save();
    return u;
  };

  const admin = await mkUser('LifeLine Admin', 'admin@lifeline.test', 'Admin@12345', '+91 98100 00001', 'admin');
  const hospitalUser = await mkUser('City General Hospital', 'hospital@lifeline.test', 'Hospital@12345', '+91 98100 00002', 'requester');
  const apolloUser = await mkUser('Apollo Blood Centre', 'apollo@lifeline.test', 'Hospital@12345', '+91 98100 00003', 'requester');

  await Requester.create({
    userId: hospitalUser._id, organizationName: 'City General Hospital', organizationType: 'hospital',
    licenseNumber: 'DL-HOSP-2019-4471', address: 'Connaught Place, Ring Road',
    city: 'Delhi', state: 'Delhi', pincode: '110001', latitude: CITIES.Delhi.lat, longitude: CITIES.Delhi.lng, verified: true,
  });
  await Requester.create({
    userId: apolloUser._id, organizationName: 'Apollo Blood Centre', organizationType: 'blood_bank',
    licenseNumber: 'DL-BB-2017-1182', address: 'Greams Road, Thousand Lights',
    city: 'Chennai', state: 'Tamil Nadu', pincode: '600006', latitude: CITIES.Chennai.lat + 0.02, longitude: CITIES.Chennai.lng + 0.02, verified: true,
  });

  // --------------------------------------------------------------- donors
  const donorSpecs = [
    { name: 'Aarav Sharma', email: 'donor@lifeline.test', phone: '+91 98200 11111', group: 'O+', place: 'Delhi', last: 120, total: 6, gender: 'male', weight: 72 },
    { name: 'Diya Patel', email: 'diya.patel@example.com', phone: '+91 98200 22222', group: 'A+', place: 'Mumbai', last: 40, total: 4, gender: 'female', weight: 58 },
    { name: 'Rohan Verma', email: 'rohan.verma@example.com', phone: '+91 98200 33333', group: 'B+', place: 'Bengaluru', last: 250, total: 9, gender: 'male', weight: 80 },
    { name: 'Ananya Iyer', email: 'ananya.iyer@example.com', phone: '+91 98200 44444', group: 'O-', place: 'Chennai', last: 25, total: 3, gender: 'female', weight: 55 },
    { name: 'Kabir Singh', email: 'kabir.singh@example.com', phone: '+91 98200 55555', group: 'AB+', place: 'Delhi', last: 90, total: 5, gender: 'male', weight: 76 },
    { name: 'Meera Nair', email: 'meera.nair@example.com', phone: '+91 98200 66666', group: 'A-', place: 'Kolkata', last: null, total: 0, gender: 'female', weight: 60 },
    { name: 'Arjun Reddy', email: 'arjun.reddy@example.com', phone: '+91 98200 77777', group: 'B-', place: 'Hyderabad', last: 310, total: 7, gender: 'male', weight: 70 },
    { name: 'Sara Khan', email: 'sara.khan@example.com', phone: '+91 98200 88888', group: 'O+', place: 'Pune', last: 5, total: 2, gender: 'female', weight: 62 },
    { name: 'Vikram Joshi', email: 'vikram.joshi@example.com', phone: '+91 98200 99999', group: 'AB-', place: 'Jaipur', last: 180, total: 4, gender: 'male', weight: 68 },
    { name: 'Ishita Bose', email: 'ishita.bose@example.com', phone: '+91 98201 10101', group: 'A+', place: 'Kolkata', last: 14, total: 3, gender: 'female', weight: 57 },
    { name: 'Aditya Rao', email: 'aditya.rao@example.com', phone: '+91 98201 20202', group: 'O+', place: 'Bengaluru', last: 65, total: 5, gender: 'male', weight: 74 },
    { name: 'Nisha Gupta', email: 'nisha.gupta@example.com', phone: '+91 98201 30303', group: 'B+', place: 'Mumbai', last: 260, total: 6, gender: 'female', weight: 59 },
    { name: 'Farhan Ali', email: 'farhan.ali@example.com', phone: '+91 98201 40404', group: 'O-', place: 'Delhi', last: 70, total: 2, gender: 'male', weight: 71 },
    { name: 'Tara Menon', email: 'tara.menon@example.com', phone: '+91 98201 50505', group: 'A+', place: 'Chennai', last: null, total: 0, gender: 'female', weight: 54 },
  ];

  const donors = [];
  for (const s of donorSpecs) {
    const loc = CITIES[s.place];
    const u = await mkUser(s.name, s.email, 'Donor@12345', s.phone, 'donor');
    const dob = daysAgo(24 * 365 + (s.name.length * 7) % 120);
    const d = await Donor.create({
      userId: u._id, bloodGroup: s.group, dateOfBirth: dob, gender: s.gender, weight: s.weight,
      address: `${s.name.split(' ')[0]} Residence, ${loc.city}`, city: loc.city, state: loc.state, pincode: loc.pin,
      latitude: loc.lat + ((s.name.length % 5) - 2) * 0.01, longitude: loc.lng + ((s.name.length % 7) - 3) * 0.01,
      lastDonationDate: s.last == null ? null : daysAgo(s.last),
      totalDonations: s.total, availability: s.last === 5 ? 'busy' : 'available',
      lastEngagementAt: daysAgo(Math.min(s.last ?? 300, 45)),
    });
    d.eligibilityStatus = s.last == null || s.last >= DEFERRED ? 'eligible' : 'ineligible';
    d.nextEligibleDate = s.last == null ? null : (s.last >= DEFERRED ? null : daysAhead(DEFERRED - s.last));
    await d.save();
    donors.push({ doc: d, spec: s });
  }
  const donorByGroup = (g) => donors.filter((x) => x.doc.bloodGroup === g);

  // --------------------------------------------------- donation history
  // ~6 months of completed donations (drives prediction trends + rewards).
  const donationDocs = [];
  const rewardTx = [];
  const monthPoints = {};
  for (let m = 5; m >= 0; m--) {
    const count = 8 + ((5 - m) % 3); // 8-10 per month
    for (let i = 0; i < count; i++) {
      const eligibleDonors = donors.filter((x) => x.spec.total > 0);
      const pick = eligibleDonors[(m * 11 + i * 3) % eligibleDonors.length];
      const when = daysAgo(m * 30 + ((i * 5) % 26) + 2);
      const rec = await Donation.create({
        donorId: pick.doc._id, bloodGroup: pick.doc.bloodGroup, units: 1, donationDate: when,
        location: ['City General Hospital', 'Apollo Blood Centre', 'LifeLine Blood Camp, ' + pick.spec.place][i % 3],
        status: 'completed', recordedBy: admin._id,
      });
      donationDocs.push(rec);
      const key = String(pick.doc._id);
      monthPoints[key] = (monthPoints[key] || 0) + 100;
      rewardTx.push({
        donorId: pick.doc._id, points: 100, balanceAfter: monthPoints[key],
        transactionType: 'donation', donationRef: rec._id,
        description: `Donation at ${rec.location}`,
        createdAt: when, updatedAt: when,
      });
    }
  }
  await RewardTransaction.insertMany(rewardTx);
  for (const [id, pts] of Object.entries(monthPoints)) {
    await Donor.updateOne({ _id: id }, { $set: { rewardPoints: pts } });
  }

  // ---------------------------------------------------------- inventory
  const groups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  const stockPlan = {
    'A+': [{ u: 24, exp: 30, loc: 'Delhi Blood Bank' }, { u: 14, exp: 12, loc: 'Mumbai Blood Bank' }],
    'A-': [{ u: 9, exp: 25, loc: 'Delhi Blood Bank' }, { u: 5, exp: 5, loc: 'Chennai Blood Centre' }],
    'B+': [{ u: 20, exp: 28, loc: 'Bengaluru Blood Bank' }, { u: 11, exp: 9, loc: 'Kolkata Blood Bank' }],
    'B-': [{ u: 6, exp: 3, loc: 'Mumbai Blood Bank' }, { u: 4, exp: 40, loc: 'Delhi Blood Bank' }],
    'O+': [{ u: 30, exp: 35, loc: 'Delhi Blood Bank' }, { u: 18, exp: 15, loc: 'Pune Blood Bank' }],
    'O-': [{ u: 4, exp: 20, loc: 'Delhi Blood Bank' }, { u: 3, exp: 7, loc: 'Chennai Blood Centre' }],
    'AB+': [{ u: 12, exp: 22, loc: 'Hyderabad Blood Bank' }, { u: 8, exp: 11, loc: 'Jaipur Blood Bank' }],
    'AB-': [{ u: 5, exp: 6, loc: 'Kolkata Blood Bank' }, { u: 3, exp: 1, loc: 'Delhi Blood Bank' }],
  };
  const inventoryDocs = [];
  let batchSeq = 1000;
  for (const g of groups) {
    for (const b of stockPlan[g]) {
      const collected = daysAgo(35 - b.exp > 0 ? 35 - b.exp : 1);
      const expiry = daysAhead(b.exp);
      const expired = b.exp <= 0;
      inventoryDocs.push(await BloodInventory.create({
        bloodGroup: g, units: b.u, batchNumber: `BB-${g.replace('+', 'P').replace('-', 'M')}-${batchSeq++}`,
        collectionDate: expired ? daysAgo(95) : collected, expiryDate: expired ? daysAgo(5) : expiry,
        location: b.loc, status: expired ? 'expired' : 'available',
        createdBy: admin._id, notes: b.exp <= 7 && !expired ? 'Expiring soon - prioritise for transfusion' : undefined,
      }));
    }
  }

  // ------------------------------------------------ emergency requests
  const hospitalCoords = CITIES.Delhi;
  const req = (o) => ({
    requesterId: hospitalUser._id, contactNumber: '+91 98110 22334', latitude: hospitalCoords.lat, longitude: hospitalCoords.lng,
    address: 'Connaught Place, Ring Road, Delhi', ...o,
  });
  const er1 = await EmergencyRequest.create(req({
    patientName: 'Ravi Kumar', hospital: 'City General Hospital', bloodGroup: 'O-', requiredUnits: 6, fulfilledUnits: 2,
    requiredAt: daysAhead(1), priority: 'CRITICAL', priorityScore: 92, status: 'Matching',
    notes: 'Road traffic accident victim, continuous bleeding. Positive cross-match required.',
    matchedDonors: [
      { donorId: donorByGroup('O-')[0].doc._id, distanceKm: 3.4, notifiedAt: daysAgo(0.2), response: 'accepted' },
      { donorId: donorByGroup('O-')[1].doc._id, distanceKm: 11.2, notifiedAt: daysAgo(0.2), response: 'pending' },
    ],
  }));
  await EmergencyRequest.create(req({
    patientName: 'Sunita Devi', hospital: 'City General Hospital', bloodGroup: 'A+', requiredUnits: 3, fulfilledUnits: 0,
    requiredAt: daysAhead(2), priority: 'URGENT', priorityScore: 74, status: 'Pending',
    notes: 'Scheduled surgery, pre-operative requirement.',
  }));
  await EmergencyRequest.create(req({
    patientName: 'Mohammed Faiz', hospital: 'City General Hospital', bloodGroup: 'B+', requiredUnits: 2, fulfilledUnits: 0,
    requiredAt: daysAhead(5), priority: 'NORMAL', priorityScore: 41, status: 'Pending',
    notes: 'Chronic anaemia management.',
  }));
  await EmergencyRequest.create(req({
    patientName: 'Priya Malhotra', hospital: 'City General Hospital', bloodGroup: 'AB+', requiredUnits: 4, fulfilledUnits: 4,
    requiredAt: daysAgo(4), priority: 'URGENT', priorityScore: 70, status: 'Fulfilled', resolvedAt: daysAgo(4),
  }));
  await EmergencyRequest.create(req({
    patientName: 'Deepak Chauhan', hospital: 'City General Hospital', bloodGroup: 'O+', requiredUnits: 5, fulfilledUnits: 3,
    requiredAt: daysAgo(6), priority: 'CRITICAL', priorityScore: 88, status: 'Partially Fulfilled', resolvedAt: daysAgo(6),
  }));
  await EmergencyRequest.create(req({
    patientName: 'Aisha Thomas', hospital: 'City General Hospital', bloodGroup: 'A-', requiredUnits: 2, fulfilledUnits: 0,
    requiredAt: daysAgo(9), priority: 'NORMAL', priorityScore: 35, status: 'Cancelled',
    notes: 'Patient transferred to another facility.',
  }));
  await EmergencyRequest.create(req({
    patientName: 'Gopal Mishra', hospital: 'City General Hospital', bloodGroup: 'B-', requiredUnits: 3, fulfilledUnits: 0,
    requiredAt: daysAgo(12), priority: 'URGENT', priorityScore: 66, status: 'Expired',
  }));
  // one from the second requester so the list shows cross-org data (admin view)
  await EmergencyRequest.create({
    requesterId: apolloUser._id, patientName: 'Lakshmi Raman', hospital: 'Apollo Blood Centre',
    contactNumber: '+91 98400 55667', bloodGroup: 'O+', requiredUnits: 4, fulfilledUnits: 1,
    latitude: CITIES.Chennai.lat, longitude: CITIES.Chennai.lng, address: 'Greams Road, Chennai',
    requiredAt: daysAhead(1), priority: 'CRITICAL', priorityScore: 90, status: 'Matching',
    notes: 'Post-partum haemorrhage.',
    matchedDonors: [{ donorId: donorByGroup('O+')[2].doc._id, distanceKm: 5.1, notifiedAt: daysAgo(0.1), response: 'pending' }],
  });

  // -------------------------------------------------------- appointments
  await Appointment.create([
    { donorId: donors[0].doc._id, location: 'Delhi Blood Bank', appointmentDate: daysAhead(2), appointmentTime: '10:00', status: 'Confirmed', notes: 'Regular quarterly donation' },
    { donorId: donors[5].doc._id, location: 'Kolkata Blood Bank', appointmentDate: daysAhead(3), appointmentTime: '11:30', status: 'Pending' },
    { donorId: donors[12].doc._id, location: 'Delhi Blood Bank', appointmentDate: daysAhead(1), appointmentTime: '09:15', status: 'Pending', notes: 'First-time appointment' },
    { donorId: donors[1].doc._id, location: 'Mumbai Blood Bank', appointmentDate: daysAgo(10), appointmentTime: '14:00', status: 'Completed' },
    { donorId: donors[3].doc._id, location: 'Chennai Blood Centre', appointmentDate: daysAgo(20), appointmentTime: '16:30', status: 'Completed' },
    { donorId: donors[7].doc._id, location: 'Pune Blood Bank', appointmentDate: daysAgo(6), appointmentTime: '12:00', status: 'No-show' },
    { donorId: donors[10].doc._id, location: 'Bengaluru Blood Bank', appointmentDate: daysAgo(3), appointmentTime: '10:45', status: 'Cancelled', notes: 'Donor unwell' },
  ]);

  // ------------------------------------------------------- notifications
  const mkNotif = (userId, type, channel, title, message, extra = {}) =>
    Notification.create({ userId, type, channel, title, message, status: channel === 'inapp' ? 'sent' : 'mocked', sentAt: daysAgo(extra.days ?? 1), ...extra });

  await mkNotif(donors[0].doc.userId, 'appointment_reminder', 'inapp', 'Upcoming donation appointment',
    'Your donation appointment at Delhi Blood Bank is in 2 days at 10:00.', { days: 0.5 });
  await mkNotif(donors[0].doc.userId, 'reward_earned', 'inapp', 'You earned 100 reward points',
    'Thank you for your donation! 100 points have been added to your balance.', { days: 3 });
  await mkNotif(donors[0].doc.userId, 'donor_match', 'inapp', 'Urgent O- request near you',
    'A critical O- request was raised 3.4 km away. Please respond if you can donate.', { days: 0.2 });
  await mkNotif(admin._id, 'low_stock', 'inapp', 'O- stock below threshold',
    'Available O- units (7) are below the configured threshold (8). Consider a donor drive.', { days: 0.3 });
  await mkNotif(admin._id, 'expiry_warning', 'inapp', 'Batches expiring within 7 days',
    '4 batches across 3 locations expire within 7 days. Prioritise them for transfusion.', { days: 0.6 });
  await mkNotif(hospitalUser._id, 'emergency_request', 'inapp', 'Request Ravi Kumar matched with 2 donors',
    'Two O- donors were notified for your critical request. Track responses in My Requests.', { days: 0.2 });

  // -------------------------------------------------------------- alerts
  await Alert.create([
    { type: 'low_stock', severity: 'critical', title: 'O- below critical threshold', message: 'O- available units (7) < critical threshold (8). Arrange emergency collection.', bloodGroup: 'O-', relatedEntity: { entityType: 'BloodInventory' } },
    { type: 'expiry_warning', severity: 'warning', title: 'AB- batch expiring tomorrow', message: 'Batch BB-ABM-1014 at Delhi Blood Bank (3 units) expires within 24 hours.', bloodGroup: 'AB-', relatedEntity: { entityType: 'BloodInventory', entityId: inventoryDocs[inventoryDocs.length - 1]._id } },
    { type: 'expiry_warning', severity: 'info', title: 'B- batch expiring in 3 days', message: 'Batch at Mumbai Blood Bank (6 units) expires in 3 days — use on a first-expiry-first-out basis.', bloodGroup: 'B-', isResolved: true, resolvedAt: daysAgo(1), resolvedBy: admin._id },
  ]);

  // --------------------------------------------------- system settings
  await SystemSettings.insertMany([
    { key: 'low_stock_thresholds', value: { 'A+': 10, 'A-': 6, 'B+': 10, 'B-': 6, 'AB+': 6, 'AB-': 4, 'O+': 12, 'O-': 8 }, description: 'Units per group triggering a low-stock alert', updatedBy: admin._id },
    { key: 'reward_config', value: { perDonation: 100, streakBonus: 50, referralBonus: 200, redemptionRate: 10 }, description: 'Reward point rules', updatedBy: admin._id },
    { key: 'eligibility_rules', value: { minAge: 16, maxAge: 65, minWeightKg: 50, deferDays: 56, maxFrequencyPerYear: 4 }, description: 'Donation eligibility rules', updatedBy: admin._id },
    { key: 'reengagement_inactive_months', value: 6, description: 'Donors inactive longer than this receive re-engagement reminders', updatedBy: admin._id },
    { key: 'expiry_warning_days', value: 7, description: 'Warn when batches expire within N days', updatedBy: admin._id },
    { key: 'appointment_reminder_hours', value: 24, description: 'Send appointment reminder N hours before', updatedBy: admin._id },
  ]);

  // ------------------------------------------------- eligibility checks
  await EligibilityCheck.create([
    { donorId: donors[0].doc._id, answers: { recentSurgery: false, feverLast14Days: false, travelling: false, medications: 'none', lastDonationDays: 120, weightOk: true }, result: 'ELIGIBLE', reasons: [], rulesVersion: '1' },
    { donorId: donors[7].doc._id, answers: { recentSurgery: false, feverLast14Days: false, travelling: false, medications: 'none', lastDonationDays: 5, weightOk: true }, result: 'NOT_ELIGIBLE', reasons: ['Last donation was 5 days ago; minimum deferral period is 56 days'], rulesVersion: '1' },
  ]);

  // ----------------------------------------------------------- audit log
  await AuditLog.insertMany([
    { userId: admin._id, action: 'seed:run', entityType: 'System', changes: { donors: donors.length, inventoryBatches: inventoryDocs.length, donations: donationDocs.length }, status: 'success' },
  ]);

  const counts = {
    users: await User.countDocuments(), donors: await Donor.countDocuments(),
    requesters: await Requester.countDocuments(), inventory: await BloodInventory.countDocuments(),
    emergencyRequests: await EmergencyRequest.countDocuments(), donations: await Donation.countDocuments(),
    appointments: await Appointment.countDocuments(), notifications: await Notification.countDocuments(),
    rewardTransactions: await RewardTransaction.countDocuments(), alerts: await Alert.countDocuments(),
  };

  console.log('\nSeed complete:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`);
  console.log('\nDev credentials:');
  console.log('  admin@lifeline.test    / Admin@12345');
  console.log('  hospital@lifeline.test / Hospital@12345');
  console.log('  donor@lifeline.test    / Donor@12345');
  console.log('  (all other donor accounts use Donor@12345)');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});