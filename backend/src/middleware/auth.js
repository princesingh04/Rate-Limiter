import jwt from 'jsonwebtoken';

// In production, this should always be a strong secret in .env
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-dev-key';

/**
 * Middleware to verify a JWT in the Authorization header.
 * Attaches the decoded user payload to `req.user`.
 */
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Bearer token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach decoded token payload (e.g. { id, email, tier })
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed →', err.message);
    res.status(401).json({ error: 'Unauthorized', message: 'Token is invalid or expired' });
  }
}

/**
 * Helper to generate a token for a user payload.
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: '7d' } // 7-day session
  );
}
