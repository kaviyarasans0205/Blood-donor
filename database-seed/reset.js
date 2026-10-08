/* eslint-disable no-console */
/**
 * Reset: drops the connected database, then creates only the minimal login
 * accounts (admin + donor + requester). No demo donors/inventory/history.
 *
 * Run from backend/:  npm run reset   (node ../database-seed/reset.js)
 *
 * Credentials created:
 *   admin@lifeline.test    / Admin@12345    (admin)
 *   donor@lifeline.test    / Donor@12345    (donor, O+)
 *   hospital@lifeline.test / Hospital@12345 (requester, City General Hospital)
 */

const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const dns = require('dns');

const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const mongoose = backendRequire('mongoose');
const dotenv = backendRequire('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

// Same resolver override as seed.js — see backend/src/config/index.js.
if (process.env.MONGO_DNS_SERVERS) {
  const servers = process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blood_bank';

async function main() {
  console.log(`Connecting to ${MONGO_URI.replace(/\/\/[^@]*@/, '//***@')} …`);
  await mongoose.connect(MONGO_URI);
  console.log('Dropping database …');
  await mongoose.connection.dropDatabase();

  const { User, Donor, Requester } = await import(
    pathToFileURL(path.join(__dirname, '..', 'backend', 'src', 'models', 'index.js')).href
  );

  const mkUser = async ({ password, ...rest }) => {
    const u = new User(rest);
    await u.setPassword(password);
    await u.save();
    return u;
  };

  await mkUser({ name: 'Administrator', email: 'admin@lifeline.test', phone: '+91 90000 00001', role: 'admin', password: 'Admin@12345' });

  const donorUser = await mkUser({
    name: 'Demo Donor', email: 'donor@lifeline.test', phone: '+91 90000 00002', role: 'donor', password: 'Donor@12345',
  });
  await Donor.create({
    userId: donorUser._id,
    bloodGroup: 'O+',
    dateOfBirth: new Date('1995-03-12'),
    gender: 'male',
    weight: 68,
    address: 'Demo Colony',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    latitude: 28.6139,
    longitude: 77.209,
    eligibilityStatus: 'eligible',
    availability: 'available',
    notificationConsent: true,
  });

  const hospitalUser = await mkUser({
    name: 'Hospital Contact', email: 'hospital@lifeline.test', phone: '+91 90000 00003', role: 'requester', password: 'Hospital@12345',
  });
  await Requester.create({
    userId: hospitalUser._id,
    organizationName: 'City General Hospital',
    organizationType: 'hospital',
    address: '1 Hospital Road',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    latitude: 28.6139,
    longitude: 77.209,
  });

  console.log('\nReset complete. Login accounts:');
  console.log('  admin@lifeline.test    / Admin@12345');
  console.log('  donor@lifeline.test    / Donor@12345');
  console.log('  hospital@lifeline.test / Hospital@12345');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
