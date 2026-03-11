/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Centralised configuration constants.
 *  Every tunable is loaded from env with a sensible default.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ─── Token Bucket ────────────────────────────────────
export const TOKEN_BUCKET_CAPACITY = parseInt(
  process.env.TOKEN_BUCKET_CAPACITY,
  10
) || 10;

/** Tokens added per second */
export const TOKEN_REFILL_RATE = parseFloat(
  process.env.TOKEN_REFILL_RATE
) || 1;

// ─── Sliding Window Log ──────────────────────────────
/** Window size in milliseconds (default 60 s) */
export const SLIDING_WINDOW_SIZE_MS = parseInt(
  process.env.SLIDING_WINDOW_SIZE_MS,
  10
) || 60_000;

export const SLIDING_WINDOW_MAX_REQUESTS = parseInt(
  process.env.SLIDING_WINDOW_MAX_REQUESTS,
  10
) || 10;

// ─── Analytics Buffer ────────────────────────────────
export const ANALYTICS_FLUSH_INTERVAL_MS = parseInt(
  process.env.ANALYTICS_FLUSH_INTERVAL_MS,
  10
) || 5_000;

export const ANALYTICS_BATCH_SIZE = parseInt(
  process.env.ANALYTICS_BATCH_SIZE,
  10
) || 50;

// ─── Server / Proxy ─────────────────────────────────
export const PORT = parseInt(process.env.PORT, 10) || 4000;
export const TARGET_URL = process.env.TARGET_URL || 'https://httpbin.org';
