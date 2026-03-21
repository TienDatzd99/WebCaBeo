import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { JWT_SECRET, authenticateToken, revokeAccessToken } from '../middleware/auth.js';

const router = express.Router();

const signToken = (user) => jwt.sign(
  { id: user.id, username: user.username, role: user.role, jti: randomUUID() },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) return res.status(409).json({ error: 'Email hoặc tên người dùng đã tồn tại' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hash);
  const user = db.prepare('SELECT id, username, email, avatar, role FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Vui lòng điền email và mật khẩu' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });

  const { password: _pw, ...safeUser } = user;
  const token = signToken(user);
  res.json({ token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, email, avatar, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /api/auth/security-flag
router.post('/security-flag', authenticateToken, (req, res) => {
  const { reason = 'devtools-detected' } = req.body || {};
  const revoked = revokeAccessToken(req.token, reason);
  res.json({ success: true, revoked });
});

export default router;
