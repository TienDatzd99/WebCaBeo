import { Router } from 'express';
import db from '../db.js';
import bcrypt from 'bcryptjs';
import { verifyAccessToken } from '../middleware/auth.js';

const router = Router();

/* ── Admin auth middleware ─────────────────────── */
function adminOnly(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const decoded = verifyAccessToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });
  if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  req.user = decoded;
  next();
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
    WHERE c.title LIKE ? OR c.author LIKE ? OR IFNULL(c.translator, '') LIKE ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(q, q, q, Number(limit), Number(offset));

  const total = db.prepare(
    "SELECT COUNT(*) as cnt FROM comics WHERE title LIKE ? OR author LIKE ? OR IFNULL(translator, '') LIKE ?"
  ).get(q, q, q).cnt;

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
  const {
    title,
    author,
    translator,
    description,
    cover_url,
    audio_url,
    status,
    genre_ids = [],
    chapters = []
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const insertComic = db.prepare(`
    INSERT INTO comics (title, author, translator, description, cover_url, audio_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insG = db.prepare('INSERT OR IGNORE INTO comic_genres VALUES (?, ?)');
  const insertChapter = db.prepare(
    'INSERT INTO chapters (comic_id, number, title, content) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    const info = insertComic.run(
      title,
      author || '',
      translator || '',
      description || '',
      cover_url || '',
      audio_url || '',
      status || 'ongoing'
    );

    const id = info.lastInsertRowid;
    genre_ids.forEach((gid) => insG.run(id, gid));

    if (Array.isArray(chapters)) {
      chapters.forEach((ch) => {
        const number = Number(ch?.number);
        if (!Number.isFinite(number)) return;
        const chapterTitle = (ch?.title || '').trim();
        const chapterContent = (ch?.content || '').trim();
        insertChapter.run(id, number, chapterTitle, chapterContent);
      });
    }

    return id;
  });

  const id = tx();
  res.json({ id, message: 'Comic created' });
});

router.put('/comics/:id', (req, res) => {
  const { title, author, translator, description, cover_url, audio_url, status, genre_ids } = req.body;
  db.prepare(`
    UPDATE comics SET title=?, author=?, translator=?, description=?, cover_url=?, audio_url=?, status=?
    WHERE id=?
  `).run(title, author || '', translator || '', description, cover_url, audio_url || '', status, req.params.id);

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
   HOMEPAGE SLIDER MANAGEMENT
══════════════════════════════════════════════════ */
router.get('/sliders', (req, res) => {
  const sliders = db.prepare(`
    SELECT hs.id, hs.comic_id, hs.sort_order, hs.is_active, hs.created_at,
           c.title, c.author, c.cover_url, c.status
    FROM home_sliders hs
    JOIN comics c ON c.id = hs.comic_id
    ORDER BY hs.sort_order ASC, hs.id ASC
  `).all();
  res.json(sliders);
});

router.post('/sliders', (req, res) => {
  const { comic_id, sort_order = 0, is_active = 1 } = req.body;
  if (!comic_id) return res.status(400).json({ error: 'comic_id required' });

  const comic = db.prepare('SELECT id FROM comics WHERE id = ?').get(comic_id);
  if (!comic) return res.status(404).json({ error: 'Comic not found' });

  try {
    const info = db.prepare(`
      INSERT INTO home_sliders (comic_id, sort_order, is_active)
      VALUES (?, ?, ?)
    `).run(comic_id, Number(sort_order) || 0, is_active ? 1 : 0);

    res.json({ id: info.lastInsertRowid, message: 'Slider item created' });
  } catch {
    res.status(409).json({ error: 'Truyện này đã có trong slider' });
  }
});

router.put('/sliders/:id', (req, res) => {
  const current = db.prepare('SELECT * FROM home_sliders WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Not found' });

  const nextSort = req.body.sort_order !== undefined ? Number(req.body.sort_order) || 0 : current.sort_order;
  const nextActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : current.is_active;

  db.prepare('UPDATE home_sliders SET sort_order = ?, is_active = ? WHERE id = ?')
    .run(nextSort, nextActive, req.params.id);
  res.json({ message: 'Updated' });
});

router.delete('/sliders/:id', (req, res) => {
  db.prepare('DELETE FROM home_sliders WHERE id = ?').run(req.params.id);
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
  const { number, title, content } = req.body;
  if (!number) return res.status(400).json({ error: 'number required' });
  const info = db.prepare(
    'INSERT INTO chapters (comic_id, number, title, content) VALUES (?, ?, ?, ?)'
  ).run(req.params.comicId, number, (title || '').trim(), content || '');
  res.json({ id: info.lastInsertRowid, message: 'Chapter created' });
});

router.put('/chapters/:id', (req, res) => {
  const { number, title, content } = req.body;
  db.prepare('UPDATE chapters SET number=?, title=?, content=? WHERE id=?')
    .run(number, title, content || '', req.params.id);
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
