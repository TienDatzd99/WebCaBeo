import express from 'express';
import db from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const setCacheHeaders = (req, res, { publicMaxAge = 30, sMaxAge = 90 } = {}) => {
  const hasAuth = Boolean(req.headers.authorization) || Boolean(req.user);
  if (hasAuth) {
    res.set('Cache-Control', 'private, no-store');
    return;
  }

  const swr = Math.max(sMaxAge * 2, 60);
  res.set('Cache-Control', `public, max-age=${publicMaxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
};

const isInlineImageData = (value) => typeof value === 'string' && value.startsWith('data:image/');
const sanitizeImageUrl = (value) => (isInlineImageData(value) ? '' : value);
const sanitizeComicMedia = (comic) => {
  if (!comic) return comic;
  return {
    ...comic,
    cover_url: sanitizeImageUrl(comic.cover_url),
    home_cover_url: sanitizeImageUrl(comic.home_cover_url),
  };
};

// Helper to attach genres and average rating to a comic
const enrichComic = (comic) => {
  if (!comic) return null;
  const genres = db.prepare(`
    SELECT g.id, g.name FROM genres g
    JOIN comic_genres cg ON g.id = cg.genre_id
    WHERE cg.comic_id = ?
  `).all(comic.id);
  const ratingRow = db.prepare('SELECT AVG(score) as avg, COUNT(*) as cnt FROM ratings WHERE comic_id = ?').get(comic.id);
  const chapterRow = db.prepare('SELECT COUNT(*) as cnt FROM chapters WHERE comic_id = ?').get(comic.id);
  const latestChap = db.prepare('SELECT number FROM chapters WHERE comic_id = ? ORDER BY number DESC LIMIT 1').get(comic.id);
  return sanitizeComicMedia({
    ...comic,
    genres,
    rating: ratingRow.avg ? parseFloat(ratingRow.avg.toFixed(1)) : null,
    ratingCount: ratingRow.cnt,
    chapterCount: chapterRow.cnt,
    latestChapter: latestChap ? latestChap.number : null,
  });
};

const enrichComicListBatch = (comics = []) => {
  if (!comics.length) return [];

  const comicIds = comics.map((c) => c.id);
  const placeholders = comicIds.map(() => '?').join(', ');

  const genreRows = db.prepare(`
    SELECT cg.comic_id, g.id, g.name
    FROM comic_genres cg
    JOIN genres g ON g.id = cg.genre_id
    WHERE cg.comic_id IN (${placeholders})
  `).all(...comicIds);

  const ratingRows = db.prepare(`
    SELECT comic_id, AVG(score) as avg, COUNT(*) as cnt
    FROM ratings
    WHERE comic_id IN (${placeholders})
    GROUP BY comic_id
  `).all(...comicIds);

  const chapterRows = db.prepare(`
    SELECT comic_id, COUNT(*) as cnt, MAX(number) as latestChapter
    FROM chapters
    WHERE comic_id IN (${placeholders})
    GROUP BY comic_id
  `).all(...comicIds);

  const genresByComic = new Map();
  for (const row of genreRows) {
    if (!genresByComic.has(row.comic_id)) genresByComic.set(row.comic_id, []);
    genresByComic.get(row.comic_id).push({ id: row.id, name: row.name });
  }

  const ratingByComic = new Map(ratingRows.map((r) => [r.comic_id, r]));
  const chapterByComic = new Map(chapterRows.map((r) => [r.comic_id, r]));

  return comics.map((comic) => {
    const ratingRow = ratingByComic.get(comic.id);
    const chapterRow = chapterByComic.get(comic.id);

    return sanitizeComicMedia({
      ...comic,
      genres: genresByComic.get(comic.id) || [],
      rating: ratingRow?.avg ? parseFloat(ratingRow.avg.toFixed(1)) : null,
      ratingCount: ratingRow?.cnt || 0,
      chapterCount: chapterRow?.cnt || 0,
      latestChapter: chapterRow?.latestChapter ?? null,
    });
  });
};

const toHomeCardComic = (comic, { includeDescription = false } = {}) => {
  if (!comic) return null;

  return {
    id: comic.id,
    title: comic.title,
    author: comic.author,
    translator: comic.translator,
    cover_url: sanitizeImageUrl(comic.cover_url),
    home_cover_url: sanitizeImageUrl(comic.home_cover_url),
    status: comic.status,
    views: comic.views,
    rating: comic.rating,
    ratingCount: comic.ratingCount,
    chapterCount: comic.chapterCount,
    latestChapter: comic.latestChapter,
    ...(includeDescription ? { description: comic.description } : {}),
  };
};

// GET /api/comics/home - aggregate payload for homepage with a single request
router.get('/home', (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 30, sMaxAge: 120 });

    const HOME_COMIC_FIELDS = `
      c.id,
      c.title,
      c.author,
      c.translator,
      c.cover_url,
      c.home_cover_url,
      c.status,
      c.views,
      c.created_at
    `;

    const featuredRows = db.prepare(`
      SELECT
        ${HOME_COMIC_FIELDS},
        SUBSTR(IFNULL(c.description, ''), 1, 280) as description
      FROM home_sliders hs
      JOIN comics c ON c.id = hs.comic_id
      WHERE hs.is_active = 1
      ORDER BY hs.sort_order ASC, hs.id ASC
      LIMIT 10
    `).all();

    const featuredFallback = db.prepare(`
      SELECT
        ${HOME_COMIC_FIELDS},
        SUBSTR(IFNULL(c.description, ''), 1, 280) as description
      FROM comics c
      ORDER BY c.views DESC, c.created_at DESC
      LIMIT 10
    `).all();
    const featuredRaw = featuredRows.length ? featuredRows : featuredFallback;
    const popularRaw = db.prepare(`
      SELECT ${HOME_COMIC_FIELDS}
      FROM comics c
      ORDER BY c.views DESC, c.created_at DESC
      LIMIT 10
    `).all();
    const latestRaw = db.prepare(`
      SELECT ${HOME_COMIC_FIELDS}
      FROM comics c
      ORDER BY c.created_at DESC
      LIMIT 10
    `).all();

    const uniqueMap = new Map();
    [...featuredRaw, ...popularRaw, ...latestRaw].forEach((comic) => {
      if (!uniqueMap.has(comic.id)) uniqueMap.set(comic.id, comic);
    });

    const enrichedById = new Map(
      enrichComicListBatch([...uniqueMap.values()]).map((comic) => [comic.id, comic])
    );

    const featured = featuredRaw
      .map((comic) => toHomeCardComic(enrichedById.get(comic.id), { includeDescription: true }))
      .filter(Boolean);
    const popular = popularRaw
      .map((comic) => toHomeCardComic(enrichedById.get(comic.id)))
      .filter(Boolean);
    const latest = latestRaw
      .map((comic) => toHomeCardComic(enrichedById.get(comic.id)))
      .filter(Boolean);

    res.json({ featured, popular, latest });
  } catch (error) {
    console.error('[/api/comics/home] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics/featured
router.get('/featured', (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 30, sMaxAge: 120 });

    const rows = db.prepare(`
      SELECT c.*
      FROM home_sliders hs
      JOIN comics c ON c.id = hs.comic_id
      WHERE hs.is_active = 1
      ORDER BY hs.sort_order ASC, hs.id ASC
      LIMIT 10
    `).all();

    if (!rows.length) {
      const fallback = db.prepare('SELECT * FROM comics ORDER BY views DESC, created_at DESC LIMIT 10').all();
      return res.json({ comics: enrichComicListBatch(fallback) });
    }

    res.json({ comics: enrichComicListBatch(rows) });
  } catch (error) {
    console.error('[/api/comics/featured] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics/:id/chapters
router.get('/:id/chapters', (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 30, sMaxAge: 120 });

    const chapters = db.prepare(`
      SELECT id, comic_id, number, title, views, created_at
      FROM chapters WHERE comic_id = ? ORDER BY number DESC
    `).all(req.params.id);
    res.json(chapters);
  } catch (error) {
    console.error('[/api/comics/:id/chapters] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics  ?sort=views|favorited|newest  &genre=&search=&limit=&page=
router.get('/', optionalAuth, (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 20, sMaxAge: 60 });

    const { type, genre, search, sort, status, limit = 12, page = 1, offset } = req.query;
    const off = offset !== undefined ? parseInt(offset) : (parseInt(page) - 1) * parseInt(limit);

    // Determine order
    let orderBy = 'c.created_at DESC';
    if (type === 'popular' || type === 'featured' || sort === 'views') orderBy = 'c.views DESC';
    if (sort === 'favorited') orderBy = '(SELECT COUNT(*) FROM favorites f WHERE f.comic_id = c.id) DESC';
    if (sort === 'newest')    orderBy = 'c.created_at DESC';

    let query = `SELECT DISTINCT c.* FROM comics c`;
    const params = [];

    if (genre) {
      query += ` JOIN comic_genres cg ON c.id = cg.comic_id JOIN genres g ON g.id = cg.genre_id`;
    }
    const conditions = [];
    if (genre)  { conditions.push('g.name = ?'); params.push(genre); }
    if (search) {
      conditions.push("(c.title LIKE ? OR c.author LIKE ? OR IFNULL(c.translator, '') LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;

    // Count query (same conditions, no limit)
    const countQuery = query.replace('SELECT DISTINCT c.*', 'SELECT COUNT(DISTINCT c.id) as cnt');
    const total = db.prepare(countQuery).get(...params).cnt;

    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), off);

    const comics = db.prepare(query).all(...params);
    res.json({ comics: enrichComicListBatch(comics), total });
  } catch (error) {
    console.error('[/api/comics] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics/:id
router.get('/:id', optionalAuth, (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 10, sMaxAge: 20 });

    const comic = db.prepare('SELECT * FROM comics WHERE id = ?').get(req.params.id);
    if (!comic) return res.status(404).json({ error: 'Comic not found' });

    // Increment views
    db.prepare('UPDATE comics SET views = views + 1 WHERE id = ?').run(comic.id);

    const enriched = enrichComic(comic);

    let isFavorited = false;
    let userRating = null;
    if (req.user) {
      isFavorited = !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND comic_id = ?').get(req.user.id, comic.id);
      const ur = db.prepare('SELECT score FROM ratings WHERE user_id = ? AND comic_id = ?').get(req.user.id, comic.id);
      userRating = ur ? ur.score : null;
    }

    res.json({ ...enriched, isFavorited, userRating });
  } catch (error) {
    console.error('[/api/comics/:id] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

export default router;
