/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   SLIDING WINDOW LOG ALGORITHM  —  Redis Sorted-Set, Lua-atomic
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  ╔══════════════════════════════════════════════════════════════════════╗
 *  ║  CONCEPT                                                           ║
 *  ║  ────────                                                          ║
 *  ║  Instead of dividing time into fixed buckets (which suffer from    ║
 *  ║  boundary-burst attacks), this algorithm maintains a LOG of every  ║
 *  ║  request timestamp within the current sliding window.              ║
 *  ║                                                                    ║
 *  ║  On each incoming request we:                                      ║
 *  ║    1. Remove timestamps older than (now − windowSize).             ║
 *  ║    2. Count remaining entries.                                     ║
 *  ║    3. If count < maxRequests → ALLOW and add this timestamp.       ║
 *  ║       Else → REJECT.                                              ║
 *  ║                                                                    ║
 *  ║  WHY IS THIS MORE ACCURATE THAN A FIXED WINDOW?                   ║
 *  ║  ────────────────────────────────────────────────────────────────   ║
 *  ║  Fixed-window counters reset at boundary edges. A client can       ║
 *  ║  send `maxRequests` at the END of window W and another             ║
 *  ║  `maxRequests` at the START of window W+1, effectively doubling    ║
 *  ║  throughput across the boundary. The sliding log has NO such       ║
 *  ║  boundary because the window slides continuously with real time.   ║
 *  ║                                                                    ║
 *  ║  MEMORY TRADE-OFF                                                  ║
 *  ║  ────────────────                                                  ║
 *  ║  • Fixed window: O(1) per key (just a counter).                   ║
 *  ║  • Sliding window log: O(maxRequests) per key — we store EVERY    ║
 *  ║    allowed timestamp. For high-volume APIs this can be costly.     ║
 *  ║    Mitigation: aggressive TTL expiry + ZREMRANGEBYSCORE on read.   ║
 *  ╚══════════════════════════════════════════════════════════════════════╝
 *
 *  REDIS DATA STRUCTURE
 *  ────────────────────
 *  Sorted Set (ZSET):
 *    Key   →  rl:sw:<clientId>
 *    Score →  timestamp (epoch ms)
 *    Member → timestamp:random  (unique per request to avoid collisions)
 *
 *  Redis commands used:
 *    ZREMRANGEBYSCORE  O(log N + M)  — remove M expired members
 *    ZCARD             O(1)          — count remaining members
 *    ZADD              O(log N)      — insert new timestamp
 *    PEXPIRE           O(1)          — set TTL for auto-cleanup
 *
 *  ── Overall Time Complexity per request ──────────────────────────────
 *    O(log N + M)  where N = set cardinality, M = expired entries removed.
 *    In steady state with consistent traffic: M is small → O(log N).
 *
 *  ── Space Complexity ─────────────────────────────────────────────────
 *    O(min(R, maxRequests))  per key, where R = actual request count in
 *    the window. Worst-case: O(maxRequests) entries per key.
 *    Across all clients: O(C × maxRequests) where C = unique clients.
 */

import { getRedisClient } from '../config/redis.js';

/* ═══════════════════════════════════════════════════════════════════════
 *  Lua Script — executed atomically inside Redis
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  KEYS[1]  → the sorted set key  (e.g. "rl:sw:192.168.1.1:/api")
 *  ARGV[1]  → window size in ms
 *  ARGV[2]  → max allowed requests within the window
 *  ARGV[3]  → current epoch time in ms
 *  ARGV[4]  → unique member string (timestamp:uuid) for this request
 *
 *  Returns:  { allowed (0|1), currentCount }
 *
 *  ── Step-by-step ────────────────────────────────────────────────────
 *  1. Compute the lower bound of the window = now − windowSize.
 *  2. ZREMRANGEBYSCORE to evict all timestamps before the lower bound.
 *     → O(log N + M) where M = number of evicted entries.
 *  3. ZCARD to get the count of remaining (active-window) timestamps.
 *     → O(1)
 *  4. If count < maxRequests → ZADD the new timestamp, mark ALLOWED.
 *     → O(log N)
 *     Else → do NOT add, mark BLOCKED.
 *  5. Set PEXPIRE = windowSize so idle sets auto-cleanup.
 *     → O(1)
 */
const LUA_SLIDING_WINDOW = `
local key         = KEYS[1]
local windowMs    = tonumber(ARGV[1])
local maxRequests = tonumber(ARGV[2])
local now         = tonumber(ARGV[3])
local member      = ARGV[4]

-- ① Lower bound of the sliding window
local windowStart = now - windowMs

-- ② Evict all entries whose score (timestamp) < windowStart
--    ZREMRANGEBYSCORE key -inf windowStart
--    Time: O(log N + M), M = expired entries purged
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- ③ Count remaining entries in the active window
--    ZCARD key
--    Time: O(1) — Redis maintains cardinality metadata
local currentCount = redis.call('ZCARD', key)

local allowed = 0

-- ④ Decision gate
if currentCount < maxRequests then
  -- Room available → record this request
  --   ZADD key <score=timestamp> <member=unique_id>
  --   Time: O(log N) — skip-list insertion
  redis.call('ZADD', key, now, member)
  allowed = 1
  currentCount = currentCount + 1
end

-- ⑤ Set TTL = windowSize so the key self-destructs after inactivity
--    This prevents memory leaks from one-off clients.
redis.call('PEXPIRE', key, windowMs)

return { allowed, currentCount }
`;

/**
 * Generates a unique sorted-set member to avoid collisions.
 *
 * Why not just use the timestamp as both score AND member?
 * → Two requests arriving in the same millisecond would share the same
 *   member name, causing ZADD to overwrite instead of insert.
 *   Appending a random suffix guarantees uniqueness.
 *
 * Format: "<epoch_ms>:<random_hex>"
 */
function uniqueMember(now) {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${now}:${rand}`;
}

/**
 * SlidingWindowLog service.
 *
 * Usage:
 *   const result = await slidingWindowLog.check('rl:sw:192.168.1.1:/api');
 *   if (!result.allowed) respond429();
 */
class SlidingWindowLogService {
  /**
   * Check (and optionally record) a request against the sliding window.
   *
   * @param  {string}  key  —  Redis key, e.g. "rl:sw:<ip>:<route>"
   * @param  {number}  windowMs — size of window
   * @param  {number}  maxRequests — max allowed 
   */
  async check(key, windowMs = 60000, maxRequests = 10) {
    const redis = getRedisClient();
    const now = Date.now();
    const member = uniqueMember(now);

    const [allowed, currentCount] = await redis.eval(
      LUA_SLIDING_WINDOW,
      1,                            // number of KEYS
      key,                          // KEYS[1]
      windowMs,                     // ARGV[1]
      maxRequests,                  // ARGV[2]
      now,                          // ARGV[3]
      member                        // ARGV[4]
    );

    return {
      allowed: allowed === 1,
      currentCount: Number(currentCount),
      limit: maxRequests,
      retryAfter: Math.ceil(windowMs / 1000),
    };
  }
}

/** Singleton export */
export const slidingWindowLog = new SlidingWindowLogService();
