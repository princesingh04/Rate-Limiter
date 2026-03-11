/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   Buffered Analytics Logger
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  Design goals:
 *    1. Logging MUST NOT block the proxy request-response cycle.
 *    2. Minimise MongoDB round-trips by batching via `insertMany`.
 *    3. Flush automatically on buffer-full OR on a periodic timer.
 *    4. Provide a manual `flush()` for graceful shutdown.
 *
 *  ── How it works ────────────────────────────────────────────────────
 *  • `push(entry)` appends to an in-memory array (O(1)).
 *  • When the array reaches `ANALYTICS_BATCH_SIZE`, _flush() fires.
 *  • A setInterval also triggers _flush() every ANALYTICS_FLUSH_INTERVAL_MS
 *    to avoid stale data sitting in memory during low-traffic periods.
 *  • _flush() swaps the buffer (snapshot), then calls insertMany on
 *    the snapshot — no lock contention.
 *
 *  ── Failure mode ────────────────────────────────────────────────────
 *  If MongoDB is unreachable, the batch is logged to stderr and
 *  discarded. For a production system you'd push to a dead-letter
 *  queue (Redis list, SQS, etc.), but for this MVP graceful degradation
 *  is acceptable.
 */

import { RequestLog } from '../models/RequestLog.js';
import {
  ANALYTICS_BATCH_SIZE,
  ANALYTICS_FLUSH_INTERVAL_MS,
} from '../config/constants.js';

class AnalyticsBuffer {
  constructor() {
    /** @type {Array<Object>} In-memory buffer */
    this._buffer = [];

    /** @type {NodeJS.Timeout | null} Periodic flush handle */
    this._timer = null;

    /** @type {boolean} Guard to prevent concurrent flushes */
    this._flushing = false;

    // Start the periodic flush timer
    this._timer = setInterval(() => {
      this._flush();
    }, ANALYTICS_FLUSH_INTERVAL_MS);

    // Allow the Node.js process to exit even if the timer is still active.
    if (this._timer.unref) this._timer.unref();
  }

  /**
   * Enqueue a log entry. This is SYNCHRONOUS and returns immediately —
   * it will never block the caller.
   *
   * @param {Object} entry — matches RequestLog schema shape
   */
  push(entry) {
    this._buffer.push(entry);

    if (this._buffer.length >= ANALYTICS_BATCH_SIZE) {
      // Fire-and-forget — deliberately NOT awaited.
      this._flush();
    }
  }

  /**
   * Flush the current buffer to MongoDB.
   * Uses a swap-and-write pattern to avoid blocking new pushes.
   */
  async _flush() {
    if (this._flushing || this._buffer.length === 0) return;

    this._flushing = true;

    // ── Swap: take a snapshot and reset the buffer atomically ────────
    // (JS is single-threaded so this is safe without locks)
    const batch = this._buffer;
    this._buffer = [];

    try {
      /**
       * insertMany is significantly faster than individual create() calls.
       *   - Single round-trip to MongoDB for N documents.
       *   - `ordered: false` allows the driver to insert in parallel;
       *     a single bad doc won't abort the entire batch.
       */
      await RequestLog.insertMany(batch, { ordered: false });
    } catch (err) {
      console.error(
        `[AnalyticsBuffer] Failed to flush ${batch.length} entries →`,
        err.message
      );
      // In production: push `batch` to a dead-letter queue here.
    } finally {
      this._flushing = false;
    }
  }

  /**
   * Graceful shutdown: flush remaining entries and stop the timer.
   */
  async shutdown() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    await this._flush();
    console.log('[AnalyticsBuffer] Shutdown complete.');
  }
}

/** Singleton export */
export const analyticsBuffer = new AnalyticsBuffer();
