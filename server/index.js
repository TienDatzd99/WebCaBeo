import express from 'express';
import cors from 'cors';
import compression from 'compression';
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
import adsRouter       from './routes/ads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173'];
const FRONTEND_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;
const ALLOWED_ORIGINS = new Set(FRONTEND_ORIGINS);

function parseEnvBoolean(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

const SERVE_FRONTEND = parseEnvBoolean(process.env.SERVE_FRONTEND, true);

// Allow same-origin and explicitly configured origins.
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
};

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  immutable: true,
}));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/comics',    comicsRouter);
app.use('/api/chapters',  chaptersRouter);
app.use('/api/auth',      authRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/ratings',   ratingsRouter);
app.use('/api/history',   historyRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/ads',       adsRouter);

// Health check
app.get('/api/health', (_, res) => {
  try {
    const comicsCount = db.prepare('SELECT COUNT(*) as cnt FROM comics').get().cnt;
    const usersCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      db: { comicsCount, usersCount },
      runtime: {
        serveFrontend: SERVE_FRONTEND,
        frontendOrigins: FRONTEND_ORIGINS,
      },
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

if (SERVE_FRONTEND) {
  // ── Serve React App ─────────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, '../dist'), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }

      if (filePath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // SPA fallback - serve index.html for all unmatched non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    return res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  // API-only mode: do not serve frontend/static from Railway.
  app.get('/', (_req, res) => {
    const preferredFrontend = FRONTEND_ORIGINS.values().next().value;
    if (preferredFrontend) {
      return res.redirect(302, preferredFrontend);
    }
    return res.status(200).json({
      name: 'Truyen Cua Ca API',
      status: 'ok',
      docs: '/api/health',
    });
  });
}

app.listen(PORT, () => {
  console.log(`Truyện Của Cá API running at http://localhost:${PORT} (serveFrontend=${SERVE_FRONTEND})`);
});
