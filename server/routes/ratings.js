import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const setPublicCache = (res, { maxAge = 15, sMaxAge = 60 } = {}) => {
  const swr = Math.max(sMaxAge * 2, 60);
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
};

const formatReview = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  stars: row.stars || 0,
  text: row.text,
  date: row.date,
});

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

// GET /api/ratings/:comicId/reviews
router.get('/:comicId/reviews', (req, res) => {
  setPublicCache(res, { maxAge: 15, sMaxAge: 90 });

  const rows = db.prepare(`
    SELECT rv.id, rv.user_id,
           COALESCE(NULLIF(rv.display_name, ''), u.username, 'Anonymous') as name,
           COALESCE(rt.score, 0) as stars,
           rv.comment as text,
           rv.created_at as date
    FROM reviews rv
    LEFT JOIN users u ON u.id = rv.user_id
    LEFT JOIN ratings rt ON rt.user_id = rv.user_id AND rt.comic_id = rv.comic_id
    WHERE rv.comic_id = ?
    ORDER BY datetime(rv.created_at) DESC, rv.id DESC
  `).all(req.params.comicId);

  res.json({ reviews: rows.map(formatReview) });
});

// POST /api/ratings/:comicId/reviews  { name, comment, score? }
router.post('/:comicId/reviews', authenticateToken, (req, res) => {
  const comicId = Number(req.params.comicId);
  const name = (req.body.name || '').trim();
  const comment = (req.body.comment || '').trim();
  const score = req.body.score;

  if (!comment) return res.status(400).json({ error: 'Vui lòng nhập nhận xét.' });
  if (comment.length > 1000) return res.status(400).json({ error: 'Nhận xét tối đa 1000 ký tự.' });
  if (name.length > 80) return res.status(400).json({ error: 'Tên hiển thị tối đa 80 ký tự.' });

  if (score !== undefined && score !== null) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'score phải từ 1 đến 5' });
    }

    db.prepare(`
      INSERT INTO ratings (user_id, comic_id, score) VALUES (?, ?, ?)
      ON CONFLICT(user_id, comic_id) DO UPDATE SET score = excluded.score
    `).run(req.user.id, comicId, score);
  }

  db.prepare(`
    INSERT INTO reviews (user_id, comic_id, display_name, comment)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, comic_id)
    DO UPDATE SET
      display_name = excluded.display_name,
      comment = excluded.comment,
      updated_at = datetime('now')
  `).run(req.user.id, comicId, name, comment);

  const reviewRow = db.prepare(`
    SELECT rv.id, rv.user_id,
           COALESCE(NULLIF(rv.display_name, ''), u.username, 'Anonymous') as name,
           COALESCE(rt.score, 0) as stars,
           rv.comment as text,
           rv.created_at as date
    FROM reviews rv
    LEFT JOIN users u ON u.id = rv.user_id
    LEFT JOIN ratings rt ON rt.user_id = rv.user_id AND rt.comic_id = rv.comic_id
    WHERE rv.user_id = ? AND rv.comic_id = ?
  `).get(req.user.id, comicId);

  const ratingRow = db.prepare('SELECT AVG(score) as avg, COUNT(*) as cnt FROM ratings WHERE comic_id = ?').get(comicId);
  res.json({
    review: formatReview(reviewRow),
    rating: ratingRow.avg ? parseFloat(ratingRow.avg.toFixed(1)) : null,
    ratingCount: ratingRow.cnt,
    userRating: score ?? reviewRow.stars,
  });
});

export default router;
