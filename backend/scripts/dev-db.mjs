import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lock = path.join(__dirname, 'mongod-uri.txt');

const mongod = await MongoMemoryServer.create();
fs.writeFileSync(lock, mongod.getUri());
console.log('MongoDB ready at', mongod.getUri());

process.on('SIGTERM', async () => {
  await mongod.stop();
  try { fs.unlinkSync(lock); } catch {}
  process.exit(0);
});

// keep alive
setInterval(() => {}, 1 << 30);
