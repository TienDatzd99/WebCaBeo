import jwt from 'jsonwebtoken';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'camap_super_secret_2024';

const isRevokedToken = (jti) => {
  if (!jti) return false;
  const row = db.prepare('SELECT 1 FROM token_revocations WHERE jti = ? LIMIT 1').get(jti);
  return !!row;
};

export const verifyAccessToken = (token) => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (isRevokedToken(payload?.jti)) return null;
    return payload;
  } catch {
    return null;
  }
};

export const revokeAccessToken = (token, reason = 'security') => {
  const payload = verifyAccessToken(token);
  if (!payload?.jti) return false;
  db.prepare(
    'INSERT OR IGNORE INTO token_revocations (jti, user_id, reason) VALUES (?, ?, ?)'
  ).run(payload.jti, payload.id || null, reason);
  return true;
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
  req.user = payload;
  req.token = token;
  next();
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
      req.token = token;
    }
  }
  next();
};

export { JWT_SECRET };
