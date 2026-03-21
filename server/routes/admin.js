import { Router } from 'express';
import db from '../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET as SECRET } from '../middleware/auth.js';

const router = Router();

/* ── Admin auth middleware ─────────────────────── */
function adminOnly(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(adminOnly);

/* ══════════════════════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════════════════════ */
router.get('/stats', (req, res) => {
  const totalComics   = db.prepare('SELECT COUNT(*) as cnt FROM comics').get().cnt;
  const totalChapters = db.prepare('SELECT COUNT(*) as cnt FROM chapters').get().cnt;
  const totalUsers    = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const totalViews    = db.prepare('SELECT COALESCE(SUM(views),0) as v FROM comics').get().v;
  const totalRatings  = db.prepare('SELECT COUNT(*) as cnt FROM ratings').get().cnt;
  const totalFavs     = db.prepare('SELECT COUNT(*) as cnt FROM favorites').get().cnt;

  const recentComics = db.prepare(`
    SELECT id, title, author, status, views, created_at
    FROM comics ORDER BY created_at DESC LIMIT 5
  `).all();

  const recentUsers = db.prepare(`
    SELECT id, username, email, role, created_at
    FROM users ORDER BY created_at DESC LIMIT 5
  `).all();

  const topComics = db.prepare(`
    SELECT id, title, views FROM comics ORDER BY views DESC LIMIT 5
  `).all();

  res.json({
    totalComics, totalChapters, totalUsers,
    totalViews, totalRatings, totalFavs,
    recentComics, recentUsers, topComics
  });
});

/* ══════════════════════════════════════════════════
   COMIC MANAGEMENT
══════════════════════════════════════════════════ */
router.get('/comics', (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const q = `%${search}%`;

  const comics = db.prepare(`
    SELECT c.*, COUNT(DISTINCT ch.id) as chapter_count,
           GROUP_CONCAT(DISTINCT g.name) as genre_names
    FROM comics c
    LEFT JOIN chapters ch ON ch.comic_id = c.id
    LEFT JOIN comic_genres cg ON cg.comic_id = c.id
    LEFT JOIN genres g ON g.id = cg.genre_id
    WHERE c.title LIKE ? OR c.author LIKE ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(q, q, Number(limit), Number(offset));

  const total = db.prepare(
    'SELECT COUNT(*) as cnt FROM comics WHERE title LIKE ? OR author LIKE ?'
  ).get(q, q).cnt;

  res.json({ comics, total, page: Number(page), limit: Number(limit) });
});

router.get('/comics/:id', (req, res) => {
  const comic = db.prepare('SELECT * FROM comics WHERE id = ?').get(req.params.id);
  if (!comic) return res.status(404).json({ error: 'Not found' });
  const genres = db.prepare(`
    SELECT g.id, g.name FROM genres g
    JOIN comic_genres cg ON cg.genre_id = g.id WHERE cg.comic_id = ?
  `).all(req.params.id);
  res.json({ ...comic, genres });
});

router.post('/comics', (req, res) => {
  const { title, author, description, cover_url, status, genre_ids = [] } = req.body;
  if (!title || !author) return res.status(400).json({ error: 'title and author required' });

  const info = db.prepare(`
    INSERT INTO comics (title, author, description, cover_url, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, author, description || '', cover_url || '', status || 'ongoing');

  const id = info.lastInsertRowid;
  const insG = db.prepare('INSERT OR IGNORE INTO comic_genres VALUES (?, ?)');
  genre_ids.forEach(gid => insG.run(id, gid));

  res.json({ id, message: 'Comic created' });
});

router.put('/comics/:id', (req, res) => {
  const { title, author, description, cover_url, status, genre_ids } = req.body;
  db.prepare(`
    UPDATE comics SET title=?, author=?, description=?, cover_url=?, status=?
    WHERE id=?
  `).run(title, author, description, cover_url, status, req.params.id);

  if (genre_ids !== undefined) {
    db.prepare('DELETE FROM comic_genres WHERE comic_id = ?').run(req.params.id);
    const insG = db.prepare('INSERT OR IGNORE INTO comic_genres VALUES (?, ?)');
    genre_ids.forEach(gid => insG.run(req.params.id, gid));
  }

  res.json({ message: 'Updated' });
});

router.delete('/comics/:id', (req, res) => {
  db.prepare('DELETE FROM comics WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

/* ══════════════════════════════════════════════════
   CHAPTER MANAGEMENT
══════════════════════════════════════════════════ */
router.get('/comics/:comicId/chapters', (req, res) => {
  const chapters = db.prepare(`
    SELECT ch.*, COUNT(cp.id) as page_count
    FROM chapters ch
    LEFT JOIN chapter_pages cp ON cp.chapter_id = ch.id
    WHERE ch.comic_id = ?
    GROUP BY ch.id
    ORDER BY ch.number ASC
  `).all(req.params.comicId);
  res.json(chapters);
});

router.post('/comics/:comicId/chapters', (req, res) => {
  const { number, title } = req.body;
  if (!number) return res.status(400).json({ error: 'number required' });
  const info = db.prepare(
    'INSERT INTO chapters (comic_id, number, title) VALUES (?, ?, ?)'
  ).run(req.params.comicId, number, title || `Chapter ${number}`);
  res.json({ id: info.lastInsertRowid, message: 'Chapter created' });
});

router.put('/chapters/:id', (req, res) => {
  const { number, title } = req.body;
  db.prepare('UPDATE chapters SET number=?, title=? WHERE id=?')
    .run(number, title, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/chapters/:id', (req, res) => {
  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

/* Chapter pages */
router.get('/chapters/:id/pages', (req, res) => {
  const pages = db.prepare(
    'SELECT * FROM chapter_pages WHERE chapter_id = ? ORDER BY page_num'
  ).all(req.params.id);
  res.json(pages);
});

router.post('/chapters/:id/pages', (req, res) => {
  const { image_url, page_num } = req.body;
  const info = db.prepare(
    'INSERT INTO chapter_pages (chapter_id, page_num, image_url) VALUES (?, ?, ?)'
  ).run(req.params.id, page_num, image_url);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/pages/:id', (req, res) => {
  db.prepare('DELETE FROM chapter_pages WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

/* ══════════════════════════════════════════════════
   USER MANAGEMENT
══════════════════════════════════════════════════ */
router.get('/users', (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const q = `%${search}%`;

  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.role, u.created_at,
           COUNT(DISTINCT f.comic_id) as fav_count,
           COUNT(DISTINCT r.comic_id) as rating_count
    FROM users u
    LEFT JOIN favorites f ON f.user_id = u.id
    LEFT JOIN ratings r ON r.user_id = u.id
    WHERE u.username LIKE ? OR u.email LIKE ?
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(q, q, Number(limit), Number(offset));

  const total = db.prepare(
    'SELECT COUNT(*) as cnt FROM users WHERE username LIKE ? OR email LIKE ?'
  ).get(q, q).cnt;

  res.json({ users, total });
});

router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['user','admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

router.put('/users/:id/password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Min 6 chars' });
  db.prepare('UPDATE users SET password=? WHERE id=?')
    .run(bcrypt.hashSync(password, 10), req.params.id);
  res.json({ message: 'Password updated' });
});

router.delete('/users/:id', (req, res) => {
  if (req.user.id === Number(req.params.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

/* ══════════════════════════════════════════════════
   GENRES
══════════════════════════════════════════════════ */
router.get('/genres', (req, res) => {
  res.json(db.prepare('SELECT * FROM genres ORDER BY name').all());
});

router.post('/genres', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)').run(name);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/genres/:id', (req, res) => {
  db.prepare('DELETE FROM genres WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

export default router;
