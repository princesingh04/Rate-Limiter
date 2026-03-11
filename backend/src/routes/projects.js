import { Router } from 'express';
import { Project } from '../models/Project.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Protect all project routes
router.use(requireAuth);

/**
 * GET /api/projects
 * List all projects belonging to the logged-in user.
 */
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    console.error('[Projects] Read error →', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * POST /api/projects
 * Create a new endpoint/project.
 */
router.post('/', async (req, res) => {
  try {
    const { name, targetUrl, rateLimitConfig } = req.body;

    if (!name || !targetUrl) {
      return res.status(400).json({ error: 'Name and targetUrl are required.' });
    }

    // Limit free tier users to e.g. 3 projects (hardcoded for MVP)
    const existingCount = await Project.countDocuments({ userId: req.user.id });
    if (existingCount >= 3 && req.user.tier === 'Free') {
      return res.status(403).json({ error: 'Free tier is limited to 3 projects. Please upgrade.' });
    }

    const project = new Project({
      userId: req.user.id,
      name,
      targetUrl,
      rateLimitConfig: rateLimitConfig || undefined, // fallback to Mongoose defaults
    });

    await project.save();
    res.status(201).json(project);
  } catch (err) {
    console.error('[Projects] Create error →', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * PATCH /api/projects/:id
 * Update project details (like targetUrl or rate limits)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const project = await Project.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: updates },
      { new: true } // return updated doc
    );

    if (!project) return res.status(404).json({ error: 'Project not found.' });

    res.json(project);
  } catch (err) {
    console.error('[Projects] Update error →', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id, userId: req.user.id });
    
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Note: In production you would also delete related RequestLogs or archive them
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('[Projects] Delete error →', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
