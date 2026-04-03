import express from 'express';
import process from 'node:process';

const router = express.Router();

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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
    throw new Error(`YouTube API ${response.status}: ${body}`);
  }

  return response.json();
}

async function resolveChannel({ apiKey, channelId, channelHandle }) {
  if (channelId) {
    const byId = await fetchYouTube('channels', {
      part: 'statistics,snippet',
      id: channelId,
      key: apiKey,
    });
    return byId?.items?.[0] || null;
  }

  if (channelHandle) {
    const byHandle = await fetchYouTube('channels', {
      part: 'statistics,snippet',
      forHandle: channelHandle,
      key: apiKey,
    });
    return byHandle?.items?.[0] || null;
  }

  return null;
}

router.get('/info', async (_req, res) => {
  const envChannelId = process.env.YOUTUBE_CHANNEL_ID;
  const envChannelHandle = normalizeHandle(process.env.YOUTUBE_CHANNEL_HANDLE);
  const apiKey = process.env.YOUTUBE_API_KEY;
  const envChannelUrl = process.env.YOUTUBE_CHANNEL_URL || null;
  const derivedHandle = extractHandleFromUrl(envChannelUrl);
  const channelHandle = envChannelHandle || derivedHandle;

  if (!apiKey || (!envChannelId && !channelHandle)) {
    return res.status(503).json({
      error: 'YouTube is not configured',
      details: 'Set YOUTUBE_API_KEY and one of YOUTUBE_CHANNEL_ID or YOUTUBE_CHANNEL_HANDLE (or YOUTUBE_CHANNEL_URL with @handle).',
    });
  }

  try {
    const channel = await resolveChannel({
      apiKey,
      channelId: envChannelId,
      channelHandle,
    });

    if (!channel) {
      return res.status(404).json({ error: 'YouTube channel not found' });
    }

    const channelId = channel.id;
    const channelUrl = envChannelUrl || `https://www.youtube.com/channel/${channelId}`;

    const latestData = await fetchYouTube('search', {
      part: 'snippet',
      channelId,
      order: 'date',
      type: 'video',
      maxResults: '2',
      key: apiKey,
    });

    const latestIds = (latestData?.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);

    const topViewData = await fetchYouTube('search', {
      part: 'snippet',
      channelId,
      order: 'viewCount',
      type: 'video',
      maxResults: '10',
      key: apiKey,
    });

    const topViewCandidates = (topViewData?.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);

    const mostViewedId = topViewCandidates.find((id) => !latestIds.includes(id)) || topViewCandidates[0] || null;

    const allIds = [...new Set([...latestIds, ...(mostViewedId ? [mostViewedId] : [])])];

    const videoDetails = allIds.length
      ? await fetchYouTube('videos', {
          part: 'snippet,statistics',
          id: allIds.join(','),
          key: apiKey,
        })
      : { items: [] };

    const detailMap = new Map((videoDetails.items || []).map((item) => [item.id, item]));

    const latest = latestIds
      .map((id) => mapVideo(detailMap.get(id)))
      .filter(Boolean)
      .slice(0, 2);

    const mostViewed = mostViewedId ? mapVideo(detailMap.get(mostViewedId)) : null;

    return res.json({
      channel: {
        id: channelId,
        title: channel.snippet?.title || 'YouTube Channel',
        avatar: channel.snippet?.thumbnails?.high?.url
          || channel.snippet?.thumbnails?.medium?.url
          || channel.snippet?.thumbnails?.default?.url
          || null,
        url: channelUrl,
        subscribeUrl: `https://www.youtube.com/channel/${channelId}?sub_confirmation=1`,
        subscriberCount: toNumber(channel.statistics?.subscriberCount, 0),
      },
      videos: {
        latest,
        mostViewed,
      },
    });
  } catch (error) {
    console.error('[/api/youtube/info] error:', error.message);
    return res.status(502).json({ error: 'Failed to fetch YouTube data', details: error.message });
  }
});

export default router;
