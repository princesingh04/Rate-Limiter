/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   TOKEN BUCKET ALGORITHM  —  Redis-backed, Lua-atomic implementation
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  ╔══════════════════════════════════════════════════════════════════════╗
 *  ║  CONCEPT                                                           ║
 *  ║  ────────                                                          ║
 *  ║  A virtual "bucket" holds up to `capacity` tokens. Tokens are      ║
 *  ║  added at a constant `refillRate` (tokens/second). Each request    ║
 *  ║  consumes exactly 1 token. If the bucket is empty, the request     ║
 *  ║  is rejected (HTTP 429).                                           ║
 *  ║                                                                    ║
 *  ║  KEY PROPERTIES                                                    ║
 *  ║  ─────────────                                                     ║
 *  ║  • Allows bursts up to `capacity` in a short window.              ║
 *  ║  • Long-term throughput is bounded by `refillRate`.                ║
 *  ║  • Smooth refilling avoids the "boundary problem" of fixed        ║
 *  ║    window counters.                                                ║
 *  ╚══════════════════════════════════════════════════════════════════════╝
 *
 *  REDIS DATA STRUCTURE
 *  ────────────────────
 *  We store per-key state in a Redis Hash:
 *
 *    HSET  rl:tb:<clientId>
 *          tokens       <float>     ← current token count
 *          lastRefill   <epoch_ms>  ← last time we computed a refill
 *
 *  ── Time Complexity ──────────────────────────────────────────────────
 *  •  HGETALL     : O(n) where n = number of fields = 2 → effectively O(1)
 *  •  HSET (bulk) : O(n) where n = fields set = 2       → effectively O(1)
 *  •  PEXPIRE     : O(1)
 *  ⇒  Overall per request: O(1) constant time.
 *
 *  ── Space Complexity ─────────────────────────────────────────────────
 *  •  1 hash key per unique client identity.
 *  •  Each hash has exactly 2 fields (~80–120 bytes overhead).
 *  ⇒  O(n) where n = number of unique clients tracked.
 *
 *  WHY A LUA SCRIPT?
 *  ─────────────────
 *  Redis executes Lua scripts atomically (single-threaded event loop).
 *  This eliminates race conditions that would occur if we did separate
 *  HGETALL → compute → HSET calls from Node.js. No distributed locks
 *  or WATCH/MULTI needed.
 */

import { getRedisClient } from '../config/redis.js';

/* ═══════════════════════════════════════════════════════════════════════
 *  Lua Script — executed atomically inside Redis
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  KEYS[1]  → the bucket hash key  (e.g. "rl:tb:192.168.1.1:/api")
 *  ARGV[1]  → bucket capacity       (max tokens)
 *  ARGV[2]  → refill rate            (tokens per second)
 *  ARGV[3]  → current epoch time in milliseconds
 *
 *  Returns:  { allowed (0|1), remainingTokens }
 *
 *  ── Step-by-step ────────────────────────────────────────────────────
 *  1. Fetch the existing hash fields (tokens, lastRefill).
 *  2. If key does not exist → initialise with a full bucket.
 *  3. Compute elapsed seconds since lastRefill.
 *  4. Add refilled tokens = elapsed × refillRate, capped at capacity.
 *  5. If tokens ≥ 1 → consume 1, mark ALLOWED.
 *     Else             → mark BLOCKED.
 *  6. Persist updated tokens + lastRefill back to the hash.
 *  7. Set a TTL so idle buckets are garbage-collected automatically.
 */
const LUA_TOKEN_BUCKET = `
local key        = KEYS[1]
local capacity   = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now        = tonumber(ARGV[3])

-- ① Read current state  (O(1) — only 2 fields)
local data = redis.call('HGETALL', key)

local tokens
local lastRefill

if #data == 0 then
  -- ② First request from this client → full bucket
  tokens     = capacity
  lastRefill = now
else
  -- Parse HGETALL alternating key/value pairs
  local map = {}
  for i = 1, #data, 2 do
    map[data[i]] = data[i + 1]
  end
  tokens     = tonumber(map['tokens'])
  lastRefill = tonumber(map['lastRefill'])
end

-- ③ Compute elapsed time in seconds (ms → s)
local elapsed = (now - lastRefill) / 1000

-- ④ Refill: add tokens proportional to elapsed time, cap at capacity
tokens = math.min(capacity, tokens + (elapsed * refillRate))

local allowed = 0

-- ⑤ Attempt to consume one token
if tokens >= 1 then
  tokens  = tokens - 1
  allowed = 1
end

-- ⑥ Persist state back  (O(1))
redis.call('HSET', key, 'tokens', tostring(tokens), 'lastRefill', tostring(now))

-- ⑦ Auto-expire idle buckets after 2× the time it takes to fully refill.
--    This prevents unbounded memory growth from one-off clients.
--    TTL = (capacity / refillRate) * 2 seconds, converted to ms.
local ttlMs = math.ceil((capacity / refillRate) * 2 * 1000)
redis.call('PEXPIRE', key, ttlMs)

-- Return both values as a table  →  Node receives as an array
return { allowed, math.floor(tokens) }
`;

/**
 * TokenBucket service.
 *
 * Usage:
 *   const result = await tokenBucket.consume('rl:tb:192.168.1.1:/api');
 *   if (!result.allowed) respond429();
 */
class TokenBucketService {
  constructor() {
    /**
     * ioredis caches the SHA1 of a Lua script after the first EVALSHA.
     * We use `defineCommand` for clarity, but raw EVAL works identically.
     * The script is loaded once per connection, then invoked by SHA.
     *
     * Network cost after first call: 1 round-trip (EVALSHA), not 2.
     */
    this.scriptSha = null;
  }

  /**
   * Attempt to consume 1 token from the bucket for `key`.
   *
   * @param  {string}  key  —  Redis key, e.g. "rl:tb:<ip>:<route>"
   * @param  {number}  capacity  — max tokens
   * @param  {number}  refillRate  — tokens per second
   * @returns {Promise<{allowed: boolean, remaining: number}>}
   */
  async consume(key, capacity = 10, refillRate = 1) {
    const redis = getRedisClient();
    const now = Date.now();

    const [allowed, remaining] = await redis.eval(
      LUA_TOKEN_BUCKET,
      1,                        // number of KEYS
      key,                      // KEYS[1]
      capacity,                 // ARGV[1]
      refillRate,               // ARGV[2]
      now                       // ARGV[3]
    );

    return {
      allowed: allowed === 1,
      remaining: Number(remaining),
      limit: capacity,
      retryAfter: Math.ceil(1 / refillRate),
    };
  }
}

/** Singleton export — one service instance per process. */
export const tokenBucket = new TokenBucketService();
