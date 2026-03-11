/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   Rate Limiter Middleware Factory
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  Returns an Express middleware that intercepts requests, applies the
 *  chosen rate-limiting algorithm, and fires an analytics log
 *  asynchronously (fire-and-forget) so the proxy path is never blocked
 *  by database I/O.
 *
 *  Supported algorithms:
 *    • "token-bucket"       →  Token Bucket (Redis Hash)
 *    • "sliding-window-log" →  Sliding Window Log (Redis Sorted Set)
 */

import { tokenBucket } from '../services/tokenBucket.js';
import { slidingWindowLog } from '../services/slidingWindowLog.js';
import { analyticsBuffer } from '../services/analyticsBuffer.js';

/**
 * Single middleware: extracts rate limit config from `req.project`
 */
export const rateLimiter = async (req, res, next) => {
  if (!req.project) {
    console.error('[RateLimiter] Missing req.project. Did you forget the project lookup middleware?');
    return next();
  }

  const startTime = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';
  
  // To avoid storing the /proxy/:projectId prefix in analytics, we use originalUrl matching trick
  // or simply the req.url which has the stripped path if using express Router.
  // Actually targetRoute should be the PATH sent to the target, which is req.originalUrl
  const route = req.originalUrl;
  
  const config = req.project.rateLimitConfig;
  const algorithm = config.algorithm || 'token-bucket';
  
  const keyPrefix = algorithm === 'token-bucket' ? 'rl:tb' : 'rl:sw';
  const key = `${keyPrefix}:${req.project.id}:${clientIp}`;

  try {
    let result;

    if (algorithm === 'token-bucket') {
      result = await tokenBucket.consume(key, config.capacity, config.refillRate);
    } else {
      result = await slidingWindowLog.check(key, config.windowMs, config.maxRequests);
    }

    res.set({
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(
        result.remaining ?? Math.max(0, result.limit - result.currentCount)
      ),
      'X-RateLimit-Algorithm': algorithm,
    });

    if (!result.allowed) {
      res.set('Retry-After', String(result.retryAfter));

      analyticsBuffer.push({
        timestamp: new Date(),
        ipAddress: clientIp,
        targetRoute: route,
        status: 'Blocked',
        responseTime: Date.now() - startTime,
        algorithm,
        projectId: req.project.id,
      });

      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${result.retryAfter}s.`,
        algorithm,
      });
    }

    res.on('finish', () => {
      analyticsBuffer.push({
        timestamp: new Date(),
        ipAddress: clientIp,
        targetRoute: route,
        status: 'Passed',
        responseTime: Date.now() - startTime,
        algorithm,
        projectId: req.project.id,
      });
    });

    next();
  } catch (err) {
    console.error('[RateLimiter] Redis error, failing open →', err.message, err.stack);
    next();
  }
};
