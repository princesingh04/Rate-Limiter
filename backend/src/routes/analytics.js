/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *   Analytics API Routes
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  GET /api/analytics/summary
 *    → Hourly allowed/blocked counts for the last 24 hours.
 *
 *  GET /api/analytics/logs?page=1&limit=50
 *    → Paginated raw request logs (newest first).
 */
import { Router } from 'express';
import { RequestLog } from '../models/RequestLog.js';
import { Project } from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Secure all analytics routes
router.use(requireAuth);

/**
 * GET /api/analytics/summary
 *
 * MongoDB aggregation pipeline:
 *   1. $match  — last 24 hours only
 *   2. $group  — bucket by hour + status
 *   3. $sort   — chronological order
 *
 * Response shape:
 *   [{ hour: "2026-03-08T14:00:00.000Z", allowed: 120, blocked: 15 }, …]
 */
router.get('/summary', async (req, res) => {
  try {
    const { projectId } = req.query;

    // Determine which projects the user is allowed to see
    const projectQuery = { userId: req.user.id };
    if (projectId) projectQuery._id = projectId;
    
    const userProjects = await Project.find(projectQuery, '_id');
    const validProjectIds = userProjects.map(p => p._id);

    if (validProjectIds.length === 0) {
      return res.json([]); // No projects or access denied -> no data
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pipeline = [
      // Stage 1: Filter to last 24 hours AND ONLY user's projects
      { 
        $match: { 
          timestamp: { $gte: twentyFourHoursAgo },
          projectId: { $in: validProjectIds }
        } 
      },

      // Stage 2: Group by truncated hour + status
      {
        $group: {
          _id: {
            hour: {
              $dateTrunc: { date: '$timestamp', unit: 'hour' },
            },
            status: '$status',
          },
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
        },
      },

      // Stage 3: Reshape into { hour, allowed, blocked }
      {
        $group: {
          _id: '$_id.hour',
          allowed: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'Passed'] }, '$count', 0],
            },
          },
          blocked: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'Blocked'] }, '$count', 0],
            },
          },
          avgResponseTime: { $avg: '$avgResponseTime' },
        },
      },

      // Stage 4: Sort chronologically
      { $sort: { _id: 1 } },

      // Stage 5: Clean field names
      {
        $project: {
          _id: 0,
          hour: '$_id',
          allowed: 1,
          blocked: 1,
          avgResponseTime: { $round: ['$avgResponseTime', 2] },
        },
      },
    ];

    const summary = await RequestLog.aggregate(pipeline);
    res.json(summary);
  } catch (err) {
    console.error('[Analytics] Summary error →', err.message);
    res.status(500).json({ error: 'Failed to retrieve analytics summary.' });
  }
});

/**
 * GET /api/analytics/logs?page=1&limit=50
 *
 * Paginated raw logs, newest first.
 */
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const { projectId } = req.query;

    const projectQuery = { userId: req.user.id };
    if (projectId) projectQuery._id = projectId;
    
    const userProjects = await Project.find(projectQuery, '_id');
    const validProjectIds = userProjects.map(p => p._id);

    if (validProjectIds.length === 0) {
      return res.json({ page, limit, total: 0, totalPages: 0, data: [] });
    }

    const logQuery = { projectId: { $in: validProjectIds } };

    const [logs, total] = await Promise.all([
      RequestLog.find(logQuery)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RequestLog.countDocuments(logQuery),
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: logs,
    });
  } catch (err) {
    console.error('[Analytics] Logs error →', err.message);
    res.status(500).json({ error: 'Failed to retrieve request logs.' });
  }
});

export default router;
