/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   API Gateway — Express Server & Reverse Proxy
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  Request lifecycle:
 *    Client → Express → RateLimiter Middleware → http-proxy-middleware → Target
 *
 *  Routes:
 *    /proxy/*           →  Proxied to TARGET_URL (rate-limited)
 *    /api/analytics/*   →  Analytics dashboard API
 *    /health            →  Health check
 */

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { getRedisClient, closeRedis } from './config/redis.js';
import { connectMongo, closeMongo } from './config/mongo.js';
import { PORT } from './config/constants.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { analyticsBuffer } from './services/analyticsBuffer.js';

import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import analyticsRouter from './routes/analytics.js';
import { Project } from './models/Project.js';

const app = express();

// ─── Global Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Trust the first proxy (e.g. nginx) so req.ip resolves correctly.
app.set('trust proxy', 1);

// ─── Health Check ───────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ─── API Routes (Dashboard) ─────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/analytics', analyticsRouter);

// ─── SaaS Dynamic Proxy Engine (/proxy/:projectId/*) ────────────────
app.use(
  '/proxy/:projectId',
  
  // 1. Project Lookup Middleware
  async (req, res, next) => {
    try {
      const project = await Project.findById(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Gateway Endpoint Not Found' });
      
      req.project = project;
      next();
    } catch (err) {
      res.status(400).json({ error: 'Invalid Endpoint ID format' });
    }
  },

  // 2. Dynamic Rate Limiter
  rateLimiter,

  // 3. Dynamic HTTP Proxy
  createProxyMiddleware({
    // router function yields the target dynamically per request
    router: (req) => req.project.targetUrl,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      // Remove the `/proxy/<projectId>` prefix before forwarding to target
      const matchKey = `/proxy/${req.params.projectId}`;
      return path.replace(matchKey, '') || '/';
    },
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Forwarded-For', req.ip || '0.0.0.0');
        proxyReq.setHeader('X-RateLimiter-Project', req.project.id);
      },
      error: (err, _req, res) => {
        console.error('[Proxy] Error →', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad Gateway', message: 'Target URL is unreachable' });
        }
      },
    },
  })
);

// ─── Graceful Shutdown ──────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully…`);
  await analyticsBuffer.shutdown();
  await closeRedis();
  await closeMongo();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Bootstrap ──────────────────────────────────────────────────────
async function start() {
  getRedisClient();
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   SaaS API Gateway & Rate Limiter                        ║
║   ────────────────────────────────────────────────────    ║
║   Port        : ${PORT}                                     ║
║   Endpoints   : Dynamic per Tenant (/proxy/:projectId)   ║
║   Auth API    : /api/auth                                ║
║   Project API : /api/projects                            ║
║   Analytics   : /api/analytics                           ║
╚══════════════════════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error('[Server] Fatal startup error →', err);
  process.exit(1);
});
