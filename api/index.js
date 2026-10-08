import dns from 'node:dns';

const dnsServers = process.env.MONGO_DNS_SERVERS
  ? process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['8.8.8.8', '8.8.4.4'];
dns.setServers(dnsServers);

import app from '../backend/src/app.js';
import { connectDB } from '../backend/src/config/db.js';

let connPromise;

export default async function handler(req, res) {
  if (!connPromise) {
    connPromise = connectDB();
  }
  await connPromise;
  return app(req, res);
}
