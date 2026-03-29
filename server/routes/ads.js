import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/ads/random - Get a random active ad
router.get('/random', (req, res) => {
  try {
    const ads = db.prepare(`
      SELECT id, title, image_url, link_url
      FROM ads
      WHERE is_active = 1
      ORDER BY RANDOM()
      LIMIT 1
    `).all();

    if (ads.length === 0) {
      return res.json({
        id: null,
        title: null,
        image_url: null,
        link_url: null,
      });
    }

    res.json(ads[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ads - Get all active ads
router.get('/', (req, res) => {
  try {
    const ads = db.prepare(`
      SELECT id, title, image_url, link_url
      FROM ads
      WHERE is_active = 1
    `).all();

    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: GET /api/ads/all - Get all ads (admin only)
router.get('/all', (req, res) => {
  try {
    const ads = db.prepare(`
      SELECT id, title, image_url, link_url, is_active, created_at, updated_at
      FROM ads
      ORDER BY created_at DESC
    `).all();

    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
