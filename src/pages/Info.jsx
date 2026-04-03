import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import './Info.css';

function formatSubscribers(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function formatViews(value) {
  return `${new Intl.NumberFormat('vi-VN').format(value || 0)} lượt xem`;
}

function YouTubeLogo() {
  return (
    <svg viewBox="0 0 90 64" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="88" height="62" rx="16" fill="#ff0033" />
      <polygon points="37,20 37,44 58,32" fill="#ffffff" />
    </svg>
  );
}

function VideoBox({ title, video, featured = false }) {
  if (!video) {
    return (
      <div className="info-video-box is-empty">
        <p>Chưa có dữ liệu video</p>
      </div>
    );
  }

  return (
    <article className={`info-video-box${featured ? ' is-featured' : ''}`}>
      <div className="info-video-title">{title}</div>
      <a className="info-video-preview" href={video.url} target="_blank" rel="noreferrer" aria-label={`Mở video ${video.title}`}>
        <img src={video.thumbnail} alt={video.title} className="info-video-thumb" loading="lazy" />
        <span className="info-play-badge">▶</span>
      </a>
      <div className="info-video-meta">
        <a href={video.url} target="_blank" rel="noreferrer">{video.title}</a>
        <span>{formatViews(video.viewCount)}</span>
      </div>
    </article>
  );
}

export default function Info() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/youtube/info');
        if (!cancelled) {
          setPayload(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.response?.data?.details || err?.response?.data?.error || err.message || 'Không tải được dữ liệu YouTube';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const latestVideos = useMemo(() => payload?.videos?.latest || [], [payload]);
  const mostViewedVideo = useMemo(() => payload?.videos?.mostViewed || null, [payload]);

  return (
    <section className="info-page">
      <div className="info-wrap">
        <aside className="info-channel-card">
          <a
            className="info-logo-link"
            href={payload?.channel?.url || 'https://www.youtube.com'}
            target="_blank"
            rel="noreferrer"
            aria-label="Mở kênh YouTube"
          >
            {payload?.channel?.avatar ? (
              <img src={payload.channel.avatar} alt={payload?.channel?.title || 'Kênh YouTube'} className="info-channel-avatar" loading="lazy" />
            ) : (
              <YouTubeLogo />
            )}
          </a>

          <h1>{payload?.channel?.title || 'Kênh YouTube'}</h1>

          <p className="info-subscribers">
            {loading ? 'Đang tải người đăng ký...' : `${formatSubscribers(payload?.channel?.subscriberCount)} người đăng ký`}
          </p>

          <a
            className="info-subscribe-btn"
            href={payload?.channel?.subscribeUrl || 'https://www.youtube.com'}
            target="_blank"
            rel="noreferrer"
          >
            Đăng ký
          </a>

          {error && <p className="info-error">{error}</p>}
        </aside>

        <div className="info-videos-area">
          <div className="info-videos-top-row">
            <VideoBox title="Video mới nhất #1" video={latestVideos[0]} />
            <VideoBox title="Video mới nhất #2" video={latestVideos[1]} />
          </div>
          <VideoBox title="Video nhiều lượt xem nhất" video={mostViewedVideo} featured />
        </div>
      </div>
    </section>
  );
}
