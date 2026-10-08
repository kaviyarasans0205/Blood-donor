import dns from 'node:dns';
const dnsServers = process.env.MONGO_DNS_SERVERS
  ? process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['8.8.8.8', '8.8.4.4'];
dns.setServers(dnsServers);

import app from './app.js';
import { connectDB } from './config/db.js';

let conn;

export default async function handler(req, res) {
  if (!conn) {
    conn = connectDB();
  }
  await conn;
  return app(req, res);
}
