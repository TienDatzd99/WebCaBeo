import express from 'express';
import { Buffer } from 'node:buffer';
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
const mediaUrlFor = (comicId, kind) => `/api/comics/${comicId}/media/${kind}`;

const getApiBaseUrl = (req) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.get('host');
  return `${proto}://${host}`;
};

const toPublicImageUrl = (comicId, kind, value, apiBaseUrl = '') => {
  if (!value || typeof value !== 'string') return '';
  if (isInlineImageData(value)) return `${apiBaseUrl}${mediaUrlFor(comicId, kind)}`;
  return value;
};

const sanitizeComicMedia = (comic, idSource, apiBaseUrl = '') => {
  if (!comic) return comic;
  const comicId = idSource ?? comic.id;
  return {
    ...comic,
    cover_url: toPublicImageUrl(comicId, 'cover', comic.cover_url, apiBaseUrl),
    home_cover_url: toPublicImageUrl(comicId, 'home-cover', comic.home_cover_url, apiBaseUrl),
  };
};

const parseInlineImageData = (value) => {
  if (!isInlineImageData(value)) return null;
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(value);
  if (!match) return null;
  return {
    mimeType: match[1],
    base64: match[2],
  };
};

// Helper to attach genres and average rating to a comic
const enrichComic = (comic, apiBaseUrl = '') => {
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
  }, comic.id, apiBaseUrl);
};

const enrichComicListBatch = (comics = [], apiBaseUrl = '') => {
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
    }, comic.id, apiBaseUrl);
  });
};

const normalizeStatusFilter = (status) => {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return '';

  const aliases = new Map([
    ['đang ra', 'ongoing'],
    ['dang ra', 'ongoing'],
    ['ongoing', 'ongoing'],
    ['đã hoàn thành', 'completed'],
    ['da hoan thanh', 'completed'],
    ['completed', 'completed'],
    ['đã dừng', 'paused'],
    ['da dung', 'paused'],
    ['paused', 'paused'],
  ]);

  return aliases.get(raw) || String(status || '').trim();
};

const getChapterCountCondition = (mode) => {
  if (mode === 'short') {
    return {
      clause: '(SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) < ?',
      params: [100],
    };
  }

  if (mode === 'medium') {
    return {
      clause: '(SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) BETWEEN ? AND ?',
      params: [100, 300],
    };
  }

  if (mode === 'long') {
    return {
      clause: '(SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) > ?',
      params: [300],
    };
  }

  return null;
};

const getLoaiCondition = (loai) => {
  const value = String(loai || '').trim().toLowerCase();
  if (value === 'truyện ngắn' || value === 'truyen ngan') {
    return {
      clause: '(SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) < ?',
      params: [100],
    };
  }

  if (value === 'truyện dài' || value === 'truyen dai') {
    return {
      clause: '(SELECT COUNT(*) FROM chapters ch WHERE ch.comic_id = c.id) >= ?',
      params: [100],
    };
  }

  return null;
};

const toHomeCardComic = (comic, { includeDescription = false, apiBaseUrl = '' } = {}) => {
  if (!comic) return null;

  return {
    id: comic.id,
    title: comic.title,
    author: comic.author,
    translator: comic.translator,
    cover_url: toPublicImageUrl(comic.id, 'cover', comic.cover_url, apiBaseUrl),
    home_cover_url: toPublicImageUrl(comic.id, 'home-cover', comic.home_cover_url, apiBaseUrl),
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
    const apiBaseUrl = getApiBaseUrl(req);

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
      enrichComicListBatch([...uniqueMap.values()], apiBaseUrl).map((comic) => [comic.id, comic])
    );

    const featured = featuredRaw
      .map((comic) => toHomeCardComic(enrichedById.get(comic.id), { includeDescription: true, apiBaseUrl }))
      .filter(Boolean);
    const popular = popularRaw
      .map((comic) => toHomeCardComic(enrichedById.get(comic.id), { apiBaseUrl }))
      .filter(Boolean);
    const latest = latestRaw
      .map((comic) => toHomeCardComic(enrichedById.get(comic.id), { apiBaseUrl }))
      .filter(Boolean);

    res.json({ featured, popular, latest });
  } catch (error) {
    console.error('[/api/comics/home] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics/:id/media/:kind - serve legacy inline images without bloating JSON payloads
router.get('/:id/media/:kind', (req, res) => {
  try {
    const kind = String(req.params.kind || '').toLowerCase();
    if (!['cover', 'home-cover'].includes(kind)) {
      return res.status(400).json({ error: 'Invalid media kind' });
    }

    const comic = db.prepare('SELECT id, cover_url, home_cover_url FROM comics WHERE id = ?').get(req.params.id);
    if (!comic) return res.status(404).json({ error: 'Comic not found' });

    const rawValue = kind === 'cover' ? comic.cover_url : comic.home_cover_url;
    const parsed = parseInlineImageData(rawValue);

    if (!parsed) {
      if (typeof rawValue === 'string' && rawValue.trim()) {
        return res.redirect(302, rawValue);
      }
      return res.status(404).json({ error: 'Media not found' });
    }

    const buffer = Buffer.from(parsed.base64, 'base64');
    res.setHeader('Content-Type', parsed.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return res.send(buffer);
  } catch (error) {
    console.error('[/api/comics/:id/media/:kind] Error:', error.message);
    return res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics/featured
router.get('/featured', (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 30, sMaxAge: 120 });
    const apiBaseUrl = getApiBaseUrl(req);

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
      return res.json({ comics: enrichComicListBatch(fallback, apiBaseUrl) });
    }

    res.json({ comics: enrichComicListBatch(rows, apiBaseUrl) });
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
    const apiBaseUrl = getApiBaseUrl(req);

    const {
      type,
      genre,
      search,
      sort,
      status,
      loai,
      chapters,
      min_rating,
      limit = 12,
      page = 1,
      offset,
    } = req.query;

    const safeLimit = Math.max(1, Math.min(60, Number.parseInt(limit, 10) || 12));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const off = offset !== undefined
      ? Math.max(0, Number.parseInt(offset, 10) || 0)
      : (safePage - 1) * safeLimit;

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
    if (status) {
      const normalizedStatus = normalizeStatusFilter(status);
      conditions.push('LOWER(c.status) = LOWER(?)');
      params.push(normalizedStatus);
    }

    const loaiCondition = getLoaiCondition(loai);
    if (loaiCondition) {
      conditions.push(loaiCondition.clause);
      params.push(...loaiCondition.params);
    }

    const chapterCondition = getChapterCountCondition(String(chapters || '').trim().toLowerCase());
    if (chapterCondition) {
      conditions.push(chapterCondition.clause);
      params.push(...chapterCondition.params);
    }

    const minRating = Number.parseFloat(min_rating);
    if (Number.isFinite(minRating) && minRating > 0) {
      conditions.push('IFNULL((SELECT AVG(r.score) FROM ratings r WHERE r.comic_id = c.id), 0) >= ?');
      params.push(minRating);
    }

    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;

    // Count query (same conditions, no limit)
    const countQuery = query.replace('SELECT DISTINCT c.*', 'SELECT COUNT(DISTINCT c.id) as cnt');
    const total = db.prepare(countQuery).get(...params).cnt;

    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(safeLimit, off);

    const comics = db.prepare(query).all(...params);
    res.json({ comics: enrichComicListBatch(comics, apiBaseUrl), total });
  } catch (error) {
    console.error('[/api/comics] Error:', error.message);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

// GET /api/comics/:id
router.get('/:id', optionalAuth, (req, res) => {
  try {
    setCacheHeaders(req, res, { publicMaxAge: 10, sMaxAge: 20 });
    const apiBaseUrl = getApiBaseUrl(req);

    const comic = db.prepare('SELECT * FROM comics WHERE id = ?').get(req.params.id);
    if (!comic) return res.status(404).json({ error: 'Comic not found' });

    // Increment views
    db.prepare('UPDATE comics SET views = views + 1 WHERE id = ?').run(comic.id);

    const enriched = enrichComic(comic, apiBaseUrl);

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
