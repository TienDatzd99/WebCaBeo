import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/ratings/:comicId  { score: 1-5 }
router.post('/:comicId', authenticateToken, (req, res) => {
  const { score } = req.body;
  if (!score || score < 1 || score > 5)
    return res.status(400).json({ error: 'score phải từ 1 đến 5' });

  db.prepare(`
    INSERT INTO ratings (user_id, comic_id, score) VALUES (?, ?, ?)
    ON CONFLICT(user_id, comic_id) DO UPDATE SET score = excluded.score
  `).run(req.user.id, req.params.comicId, score);

  const row = db.prepare('SELECT AVG(score) as avg, COUNT(*) as cnt FROM ratings WHERE comic_id = ?').get(req.params.comicId);
  res.json({ rating: parseFloat(row.avg.toFixed(1)), ratingCount: row.cnt, userRating: score });
});

export default router;
