# API Gateway & Intelligent Rate Limiter

A production-grade API Gateway with two hand-rolled, Redis-backed rate-limiting algorithms, async MongoDB analytics, and a real-time React dashboard.

## Architecture

```
Client → Express Gateway → Rate Limiter Middleware → http-proxy-middleware → Target (httpbin.org)
                                ↓ (async, non-blocking)
                          Analytics Buffer → MongoDB
```

## Rate Limiting Algorithms

This API Gateway implements two enterprise-grade rate-limiting algorithms. Both are executed as **Atomic Lua Scripts** inside Redis. Using Lua scripts guarantees that the entire evaluate-and-update process runs as a single, uninterrupted transaction, completely eliminating race conditions in highly concurrent environments without the overhead of distributed locks.

### 1. Token Bucket
**Concept:** Imagine a bucket with a fixed capacity of tokens. Tokens are added to the bucket at a constant rate (e.g., 1 token per second). Every incoming request consumes one token. If the bucket is empty, the request is blocked. This algorithm is excellent for handling smooth traffic while allowing short bursts.

**Implementation Details:**
- **Redis Structure:** Hash (`HSET`, `HGETALL`)
- **Memory Footprint:** O(1) space per user/project.
- **How it works:**
  1. A Lua script retrieves the `tokens` and `lastRefill` timestamp from the Redis Hash.
  2. It calculates how much time has passed since `lastRefill` and mathematically adds the proportional number of new tokens (capped at maximum capacity).
  3. If `tokens >= 1`, it decrements the count by 1, updates `lastRefill` to the current time, and allows the request.
  4. If `tokens < 1`, the request is instantly blocked.

### 2. Sliding Window Log
**Concept:** Instead of using rigid, fixed time blocks (which suffer from boundary spikes), this algorithm keeps a precise timestamp log of every individual request. It dynamically counts exactly how many requests occurred in the trailing time window (e.g., the last 60 seconds). If the count exceeds the limit, the request is blocked.

**Implementation Details:**
- **Redis Structure:** Sorted Set (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`)
- **Memory Footprint:** O(N) space per user/project, where N is the number of requests in the window.
- **How it works:**
  1. A Lua script calculates the trailing window boundary: `current_time - window_size_ms`.
  2. It aggressively cleans up old data by dropping all timestamps older than the boundary using `ZREMRANGEBYSCORE`.
  3. It counts the remaining timestamps in the Sorted Set using `ZCARD`.
  4. If the count is below the maximum limit, the current request's timestamp is added (`ZADD`) and allowed.
  5. If the count is at or above the limit, the request is blocked.

## Quick Start

### Prerequisites
- Node.js 18+
- Redis (running on `localhost:6379`)
- MongoDB (running on `localhost:27017`)

### Backend
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:4000`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` and proxies API requests to the backend.

## Testing Rate Limits

```bash
# Token Bucket (10 tokens, 1/sec refill)
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/proxy/get; done

# Sliding Window Log (10 req per 60s window)
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/proxy-sw/get; done
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /proxy/*` | Proxied (Token Bucket) |
| `GET /proxy-sw/*` | Proxied (Sliding Window) |
| `GET /api/analytics/summary` | Hourly allowed/blocked for 24h |
| `GET /api/analytics/logs?page=1&limit=50` | Paginated logs |
| `GET /health` | Health check |
