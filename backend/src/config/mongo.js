/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Mongoose connection helper.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import mongoose from 'mongoose';

/**
 * Connect to MongoDB with sensible defaults.
 * Mongoose buffers commands so the app can start
 * accepting requests while the connection is pending.
 */
export async function connectMongo() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rate_limiter';

  try {
    await mongoose.connect(uri, {
      // These are generally defaults in Mongoose 8+, but explicit is better.
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('[MongoDB] ✔ Connected →', uri);
  } catch (err) {
    console.error('[MongoDB] ✘ Connection failed →', err.message);
    // Non-fatal: the proxy can still function without analytics.
  }
}

export async function closeMongo() {
  await mongoose.connection.close();
  console.log('[MongoDB] Connection closed.');
}
