import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Import DB to ensure it's initialized on startup
import db from './db.js';

import comicsRouter    from './routes/comics.js';
import chaptersRouter  from './routes/chapters.js';
import authRouter      from './routes/auth.js';
import favoritesRouter from './routes/favorites.js';
import ratingsRouter   from './routes/ratings.js';
import historyRouter   from './routes/history.js';
import adminRouter     from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173'];
const FRONTEND_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

// Allow same-origin and configured origins in production
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || FRONTEND_ORIGINS.includes(origin)) {
      cb(null, true);
    } else if (process.env.NODE_ENV === 'production' && !origin) {
      cb(null, true);
    } else {
      cb(null, true);
    }
  },
  credentials: true,
};

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/comics',    comicsRouter);
app.use('/api/chapters',  chaptersRouter);
app.use('/api/auth',      authRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/ratings',   ratingsRouter);
app.use('/api/history',   historyRouter);
app.use('/api/admin',     adminRouter);

// Health check
app.get('/api/health', (_, res) => {
  try {
    const comicsCount = db.prepare('SELECT COUNT(*) as cnt FROM comics').get().cnt;
    const usersCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      db: { comicsCount, usersCount }
    });
  } catch (err) {
    console.error('[/api/health] DB error:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    path: req.path
  });
});
// ── Serve React App ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../dist')));

// SPA fallback - serve index.html for all unmatched non-API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  return res.sendFile(path.join(__dirname, '../dist/index.html'));
});
app.listen(PORT, () => {
  console.log(`Truyện Của Cá API running at http://localhost:${PORT}`);
});
