import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/favorites/:comicId  – toggle
router.post('/:comicId', authenticateToken, (req, res) => {
  const { comicId } = req.params;
  const userId = req.user.id;
  const existing = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND comic_id = ?').get(userId, comicId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND comic_id = ?').run(userId, comicId);
    res.json({ favorited: false });
  } else {
    db.prepare("INSERT INTO favorites (user_id, comic_id) VALUES (?, ?)").run(userId, comicId);
    res.json({ favorited: true });
  }
});

// GET /api/favorites  – list current user's favorites
router.get('/', authenticateToken, (req, res) => {
  const comics = db.prepare(`
    SELECT c.* FROM comics c
    JOIN favorites f ON c.id = f.comic_id
    WHERE f.user_id = ?
    ORDER BY f.added_at DESC
  `).all(req.user.id);
  res.json(comics);
});

export default router;
