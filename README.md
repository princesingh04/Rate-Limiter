# API Gateway & Intelligent Rate Limiter

A production-grade API Gateway with two hand-rolled, Redis-backed rate-limiting algorithms, async MongoDB analytics, and a real-time React dashboard.

## Architecture

```
Client → Express Gateway → Rate Limiter Middleware → http-proxy-middleware → Target (httpbin.org)
                                ↓ (async, non-blocking)
                          Analytics Buffer → MongoDB
```

## Rate Limiting Algorithms

| Algorithm | Redis Structure | Route | Complexity |
|---|---|---|---|
| **Token Bucket** | Hash (`HSET`/`HGETALL`) | `/proxy/*` | O(1) time, O(1) space per key |
| **Sliding Window Log** | Sorted Set (`ZADD`/`ZREMRANGEBYSCORE`/`ZCARD`) | `/proxy-sw/*` | O(log N) time, O(N) space per key |

Both algorithms are implemented as **atomic Lua scripts** to eliminate race conditions without distributed locks.

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
