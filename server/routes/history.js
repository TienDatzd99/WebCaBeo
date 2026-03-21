import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/history
router.get('/', authenticateToken, (req, res) => {
  const history = db.prepare(`
    SELECT c.id, c.title, c.cover_url, c.status,
           ch.number as last_chapter_number, ch.id as last_chapter_id,
           rh.read_at
    FROM reading_history rh
    JOIN comics c ON c.id = rh.comic_id
    LEFT JOIN chapters ch ON ch.id = rh.chapter_id
    WHERE rh.user_id = ?
    ORDER BY rh.read_at DESC
    LIMIT 20
  `).all(req.user.id);
  res.json(history);
});

export default router;
