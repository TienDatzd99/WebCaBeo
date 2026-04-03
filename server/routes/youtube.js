import express from 'express';
import process from 'node:process';
import db from '../db.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_CACHE_KEY = 'youtube_info';
const YOUTUBE_CACHE_TTL_MS = 30 * 60 * 1000;
const YOUTUBE_CACHE_STALE_TTL_MS = 24 * 60 * 60 * 1000;

let inFlightRefresh = null;

function normalizeHandle(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return value.startsWith('@') ? value : `@${value}`;
}

function extractHandleFromUrl(channelUrl) {
  if (!channelUrl) return null;
  const source = String(channelUrl).trim();
  if (!source) return null;

  const directHandle = source.match(/@[^/?#\s]+/);
  if (directHandle) return normalizeHandle(directHandle[0]);

  try {
    const parsed = new URL(source);
    const match = parsed.pathname.match(/@[^/?#\s]+/);
    return match ? normalizeHandle(match[0]) : null;
  } catch {
    return null;
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapVideo(item) {
  if (!item?.id) return null;

  const thumbnail = item.snippet?.thumbnails?.high?.url
    || item.snippet?.thumbnails?.medium?.url
    || item.snippet?.thumbnails?.default?.url
    || null;

  const viewCount = toNumber(item.statistics?.viewCount, 0);

  return {
    id: item.id,
    title: item.snippet?.title || 'Untitled',
    thumbnail,
    publishedAt: item.snippet?.publishedAt || null,
    viewCount,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    embedUrl: `https://www.youtube.com/embed/${item.id}`,
  };
}

async function fetchYouTube(path, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${YOUTUBE_API_BASE}/${path}?${query.toString()}`);

  if (!response.ok) {
    const body = await response.text();
    let parsedBody = null;

    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = null;
    }

    const reason = parsedBody?.error?.errors?.[0]?.reason || null;
    const message = parsedBody?.error?.message || body || `HTTP ${response.status}`;
    const error = new Error(`YouTube API ${response.status}: ${message}`);
    error.status = response.status;
    error.reason = reason;
    error.payload = parsedBody;
    throw error;
  }

  return response.json();
}

async function resolveChannel({ apiKey, channelId, channelHandle }) {
  if (channelId) {
    const byId = await fetchYouTube('channels', {
      part: 'statistics,snippet,contentDetails',
      id: channelId,
      key: apiKey,
    });
    return byId?.items?.[0] || null;
  }

  if (channelHandle) {
    const byHandle = await fetchYouTube('channels', {
      part: 'statistics,snippet,contentDetails',
      forHandle: channelHandle,
      key: apiKey,
    });
    return byHandle?.items?.[0] || null;
  }

  return null;
}

function getCachedYouTubeInfo() {
  const row = db.prepare('SELECT payload, cached_at FROM youtube_cache WHERE cache_key = ?').get(YOUTUBE_CACHE_KEY);

  if (!row?.payload) {
    return null;
  }

  try {
    return {
      payload: JSON.parse(row.payload),
      cachedAt: Number(row.cached_at) || 0,
    };
  } catch {
    return null;
  }
}

function setCachedYouTubeInfo(payload) {
  db.prepare(`
    INSERT INTO youtube_cache (cache_key, payload, cached_at)
    VALUES (?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      payload = excluded.payload,
      cached_at = excluded.cached_at
  `).run(YOUTUBE_CACHE_KEY, JSON.stringify(payload), Date.now());
}

function buildYouTubePayload({ channel, latest, mostViewed, stale = false }) {
  const channelId = channel.id;

  return {
    channel: {
      id: channelId,
      title: channel.snippet?.title || 'YouTube Channel',
      avatar: channel.snippet?.thumbnails?.high?.url
        || channel.snippet?.thumbnails?.medium?.url
        || channel.snippet?.thumbnails?.default?.url
        || null,
      url: channel.url || `https://www.youtube.com/channel/${channelId}`,
      subscribeUrl: `https://www.youtube.com/channel/${channelId}?sub_confirmation=1`,
      subscriberCount: toNumber(channel.statistics?.subscriberCount, 0),
    },
    videos: {
      latest,
      mostViewed,
    },
    meta: {
      stale,
      cachedAt: Date.now(),
    },
  };
}

async function fetchYouTubeInfo({ apiKey, channelId, channelHandle, envChannelUrl }) {
  const channel = await resolveChannel({ apiKey, channelId, channelHandle });

  if (!channel) {
    return null;
  }

  const resolvedChannelId = channel.id;
  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads || null;

  let latest = [];
  let mostViewed = null;

  if (uploadsPlaylistId) {
    const uploadsData = await fetchYouTube('playlistItems', {
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: '10',
      key: apiKey,
    });

    const latestIds = (uploadsData?.items || [])
      .map((item) => item.snippet?.resourceId?.videoId)
      .filter(Boolean);

    const videoDetails = latestIds.length
      ? await fetchYouTube('videos', {
          part: 'snippet,statistics',
          id: latestIds.join(','),
          key: apiKey,
        })
      : { items: [] };

    const detailMap = new Map((videoDetails.items || []).map((item) => [item.id, item]));
    const latestVideos = latestIds
      .map((id) => mapVideo(detailMap.get(id)))
      .filter(Boolean)
      .slice(0, 2);

    latest = latestVideos;
  }

  const topViewData = await fetchYouTube('search', {
    part: 'snippet',
    channelId: resolvedChannelId,
    order: 'viewCount',
    type: 'video',
    maxResults: '10',
    key: apiKey,
  });

  const topViewCandidates = (topViewData?.items || [])
    .map((item) => item.id?.videoId)
    .filter(Boolean);

  const mostViewedId = topViewCandidates.find((id) => !latest.some((video) => video.id === id))
    || topViewCandidates[0]
    || null;

  if (mostViewedId) {
    const mostViewedData = await fetchYouTube('videos', {
      part: 'snippet,statistics',
      id: mostViewedId,
      key: apiKey,
    });

    mostViewed = mapVideo(mostViewedData?.items?.[0] || null);
  }

  return buildYouTubePayload({
    channel: {
      ...channel,
      id: resolvedChannelId,
      url: envChannelUrl || `https://www.youtube.com/channel/${resolvedChannelId}`,
    },
    latest,
    mostViewed,
    stale: false,
  });
}

function isQuotaExceeded(error) {
  return error?.status === 403 && error?.reason === 'quotaExceeded';
}

router.get('/info', optionalAuth, async (req, res) => {
  const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query?.refresh || '').trim().toLowerCase());
  const envChannelId = process.env.YOUTUBE_CHANNEL_ID;
  const envChannelHandle = normalizeHandle(process.env.YOUTUBE_CHANNEL_HANDLE);
  const apiKey = process.env.YOUTUBE_API_KEY;
  const envChannelUrl = process.env.YOUTUBE_CHANNEL_URL || null;
  const derivedHandle = extractHandleFromUrl(envChannelUrl);
  const channelHandle = envChannelHandle || derivedHandle;

  if (forceRefresh && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only', details: 'Chỉ admin mới được phép cập nhật ngay.' });
  }

  if (!apiKey || (!envChannelId && !channelHandle)) {
    return res.status(503).json({
      error: 'YouTube is not configured',
      details: 'Set YOUTUBE_API_KEY and one of YOUTUBE_CHANNEL_ID or YOUTUBE_CHANNEL_HANDLE (or YOUTUBE_CHANNEL_URL with @handle).',
    });
  }

  try {
    const cached = getCachedYouTubeInfo();
    const isFresh = cached && (Date.now() - cached.cachedAt) < YOUTUBE_CACHE_TTL_MS;

    if (!forceRefresh && isFresh) {
      return res.json(cached.payload);
    }

    if (!inFlightRefresh) {
      inFlightRefresh = fetchYouTubeInfo({
        apiKey,
        channelId: envChannelId,
        channelHandle,
        envChannelUrl,
      }).finally(() => {
        inFlightRefresh = null;
      });
    }

    const payload = await inFlightRefresh;

    if (!payload) {
      return res.status(404).json({ error: 'YouTube channel not found' });
    }

    setCachedYouTubeInfo(payload);
    return res.json(payload);
  } catch (error) {
    const cached = getCachedYouTubeInfo();

    if (cached?.payload && (Date.now() - cached.cachedAt) < YOUTUBE_CACHE_STALE_TTL_MS) {
      console.warn('[/api/youtube/info] quota or upstream failure, serving cached payload:', error.message);
      return res.status(200).json({
        ...cached.payload,
        meta: {
          ...(cached.payload.meta || {}),
          stale: true,
          cacheFallback: true,
          error: error.message,
        },
      });
    }

    console.error('[/api/youtube/info] error:', error.message);

    if (isQuotaExceeded(error)) {
      return res.status(429).json({
        error: 'YouTube quota đã hết',
        details: 'Quota của YouTube Data API đã vượt giới hạn. Hãy chờ reset quota hoặc dùng dữ liệu cache.',
      });
    }

    return res.status(502).json({ error: 'Failed to fetch YouTube data', details: error.message });
  }
});

export default router;
