/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Redis client singleton.
 *  Uses ioredis — a robust, cluster-aware Redis driver.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
import Redis from 'ioredis';

let client = null;

/**
 * Returns a lazily-initialised Redis client.
 * Subsequent calls return the same instance (singleton pattern).
 */
export function getRedisClient() {
  if (client) return client;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // Exponential back-off capped at 3 s
      return Math.min(times * 200, 3000);
    },
    lazyConnect: false,
  });

  client.on('connect', () => console.log('[Redis] ✔ Connected'));
  client.on('error', (err) => console.error('[Redis] ✘ Error →', err.message));

  return client;
}

/**
 * Gracefully close the Redis connection (used during shutdown).
 */
export async function closeRedis() {
  if (client) {
    await client.quit();
    client = null;
    console.log('[Redis] Connection closed.');
  }
}
