import { Router } from 'express';
import { User } from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Valid email and password (min 6 chars) required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const user = new User({ email, passwordHash: password }); // pre-save hook hashes it
    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, email: user.email, tier: user.tier },
    });
  } catch (err) {
    console.error('[Auth] Signup error →', err);
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email, tier: user.tier },
    });
  } catch (err) {
    console.error('[Auth] Login error →', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

export default router;
