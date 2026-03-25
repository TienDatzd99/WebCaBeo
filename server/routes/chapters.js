import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const setPublicCache = (res, { maxAge = 10, sMaxAge = 45 } = {}) => {
  const swr = Math.max(sMaxAge * 2, 60);
  res.set('Cache-Control', `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
};

// GET /api/chapters/:id  – returns chapter detail + all pages
router.get('/:id', (req, res) => {
  setPublicCache(res, { maxAge: 10, sMaxAge: 60 });

  const chapter = db.prepare(`
    SELECT ch.*, c.title as comic_title, c.id as comic_id
    FROM chapters ch
    JOIN comics c ON ch.comic_id = c.id
    WHERE ch.id = ?
  `).get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  db.prepare('UPDATE chapters SET views = views + 1 WHERE id = ?').run(chapter.id);
  const pages = db.prepare('SELECT * FROM chapter_pages WHERE chapter_id = ? ORDER BY page_num').all(chapter.id);

  // get prev/next
  const prevChap = db.prepare('SELECT id, number FROM chapters WHERE comic_id = ? AND number < ? ORDER BY number DESC LIMIT 1').get(chapter.comic_id, chapter.number);
  const nextChap = db.prepare('SELECT id, number FROM chapters WHERE comic_id = ? AND number > ? ORDER BY number ASC  LIMIT 1').get(chapter.comic_id, chapter.number);

  res.json({ ...chapter, pages, prevChapter: prevChap || null, nextChapter: nextChap || null });
});

// POST /api/chapters/:id/history  – record reading progress (auth optional)
router.post('/:id/history', authenticateToken, (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  db.prepare(`
    INSERT INTO reading_history (user_id, comic_id, chapter_id, read_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, comic_id) DO UPDATE SET chapter_id = excluded.chapter_id, read_at = excluded.read_at
  `).run(req.user.id, chapter.comic_id, chapter.id);

  res.json({ success: true });
});

export default router;
