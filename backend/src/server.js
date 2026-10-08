import dns from 'node:dns';

const dnsServers = process.env.MONGO_DNS_SERVERS
  ? process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['8.8.8.8', '8.8.4.4'];
dns.setServers(dnsServers);

import app from './app.js';
import config from './config/index.js';
import { connectDB } from './config/db.js';
import { startJobs } from './jobs/index.js';

async function main() {
  await connectDB();
  if (!config.isTest && process.env.VERCEL !== '1') {
    startJobs();
  }

  if (process.env.VERCEL === '1') {
    return;
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] API listening on http://localhost:${config.port} (${config.env})`);
    console.log(`[server] Swagger docs at http://localhost:${config.port}/api-docs`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      const { disconnectDB } = await import('./config/db.js');
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) =>
    console.error('[server] unhandledRejection:', reason)
  );
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});

export default app;
