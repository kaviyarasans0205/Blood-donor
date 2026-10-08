import mongoose from 'mongoose';
import config from './index.js';

export async function connectDB() {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri, { autoIndex: true });
    console.log(`[db] MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] MongoDB connection error:', err.message);
    if (config.isTest) throw err;
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

mongoose.connection.on('disconnected', () => {
  if (!config.isTest) console.warn('[db] MongoDB disconnected');
});
