import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { getYouTubeLinks, openYouTube } from '../utils/openYouTube.js';
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

function YouTubeLink({ href, onBlocked, children, ...props }) {
  const cleanup = useRef(null);
  useEffect(() => () => cleanup.current?.(), []);
  const links = getYouTubeLinks(href);
  return (
    <a
      {...props}
      href={links?.appUrl || href}
      target={links ? '_self' : '_blank'}
      rel="noreferrer"
      onClick={(event) => {
        cleanup.current?.();
        cleanup.current = openYouTube(href, event, window, onBlocked);
      }}
    >
      {children}
    </a>
  );
}

function VideoBox({ title, video, featured = false, onBlocked }) {
  if (!video) {
    return (
      <div className="info-video-box is-empty">
        <p>Chưa có dữ liệu video</p>
      </div>
    );
  }

  return (
    <article className={`info-video-box${featured ? ' is-featured' : ''}`}>
      <div className="info-video-content">
        <YouTubeLink className="info-video-preview" href={video.url} onBlocked={onBlocked} aria-label={`Mở video ${video.title}`}>
          <img src={video.thumbnail} alt={video.title} className="info-video-thumb" loading="lazy" />
          <span className="info-play-badge">▶</span>
        </YouTubeLink>
        <div className="info-video-meta">
          <div className="info-video-title">{title}</div>
          <YouTubeLink href={video.url} onBlocked={onBlocked}>{video.title}</YouTubeLink>
          <span>{formatViews(video.viewCount)}</span>
        </div>
      </div>
    </article>
  );
}

export default function Info() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [blockedUrl, setBlockedUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const fallbackInput = useRef(null);
  const handleBlocked = (url) => {
    setCopyStatus('');
    setBlockedUrl(url);
  };
  const copyYouTubeLink = async () => {
    try {
      await navigator.clipboard.writeText(blockedUrl);
      setCopyStatus('Đã sao chép. Hãy dán link vào Safari để mở YouTube.');
    } catch {
      fallbackInput.current?.focus();
      fallbackInput.current?.select();
      setCopyStatus('Nhấn giữ link bên dưới và chọn Sao chép, sau đó dán vào Safari.');
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load(forceRefresh = false) {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/youtube/new', {
          params: forceRefresh ? { refresh: 1 } : undefined,
        });
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

  const handleRefreshNow = async () => {
    setRefreshing(true);
    setError('');
    try {
      const { data } = await api.get('/youtube/new', { params: { refresh: 1 } });
      setPayload(data);
    } catch (err) {
      const message = err?.response?.data?.details || err?.response?.data?.error || err.message || 'Không cập nhật được dữ liệu YouTube';
      setError(message);
    } finally {
      setRefreshing(false);
    }
  };

  const latestVideos = useMemo(() => payload?.videos?.latest || [], [payload]);
  const mostViewedVideo = useMemo(() => payload?.videos?.mostViewed || null, [payload]);

  return (
    <section className="info-page">
      {blockedUrl && (
        <div className="info-open-help" role="status">
          <strong>Chưa mở được ứng dụng YouTube?</strong>
          <p>Nếu đang dùng TikTok hoặc Facebook, mở menu của trình duyệt và chọn mở bằng Safari hoặc trình duyệt ngoài nếu có. Bạn cũng có thể sao chép link dưới đây rồi dán vào Safari.</p>
          <input ref={fallbackInput} aria-label="Link YouTube để sao chép" readOnly value={blockedUrl} onFocus={(event) => event.target.select()} />
          <div className="info-open-help-actions">
            <button type="button" onClick={copyYouTubeLink}>Sao chép link</button>
            <a href={blockedUrl} target="_blank" rel="noreferrer">Xem trên web</a>
            <button type="button" onClick={() => setBlockedUrl('')}>Đóng</button>
          </div>
          {copyStatus && <p>{copyStatus}</p>}
        </div>
      )}
      <div className="info-wrap">
        <aside className="info-channel-card">
          <YouTubeLink
            className="info-logo-link"
            href={payload?.channel?.url || 'https://www.youtube.com'}
            onBlocked={handleBlocked}
            target="_blank"
            rel="noreferrer"
            aria-label="Mở kênh YouTube"
          >
            {payload?.channel?.avatar ? (
              <img src={payload.channel.avatar} alt={payload?.channel?.title || 'Kênh YouTube'} className="info-channel-avatar" loading="lazy" />
            ) : (
              <YouTubeLogo />
            )}
          </YouTubeLink>

          <div className="info-channel-meta">
            <h1>{payload?.channel?.title || 'Kênh YouTube'}</h1>

            <p className="info-subscribers">
              {loading ? 'Đang tải người đăng ký...' : `${formatSubscribers(payload?.channel?.subscriberCount)} người đăng ký`}
            </p>

            {payload?.meta?.cacheFallback && (
              <p className="info-error">
                Đang hiển thị dữ liệu cache vì quota YouTube đã hết. Dữ liệu có thể chưa phải bản mới nhất.
              </p>
            )}

            <YouTubeLink
              className="info-subscribe-btn"
              href={payload?.channel?.subscribeUrl || 'https://www.youtube.com'}
              onBlocked={handleBlocked}
              target="_blank"
              rel="noreferrer"
            >
              Đăng ký
            </YouTubeLink>

            {user?.role === 'admin' && (
              <button
                type="button"
                className="info-subscribe-btn"
                onClick={handleRefreshNow}
                disabled={refreshing || loading}
                style={{ marginTop: '10px' }}
              >
                {refreshing ? 'Đang cập nhật...' : 'Cập nhật ngay'}
              </button>
            )}

            {error && <p className="info-error">{error}</p>}
          </div>
        </aside>

        <div className="info-videos-area">
          <VideoBox title="Video mới nhất #1" video={latestVideos[0]} onBlocked={handleBlocked} />
          <VideoBox title="Video mới nhất #2" video={latestVideos[1]} onBlocked={handleBlocked} />
          <VideoBox title="Video nhiều lượt xem nhất" video={mostViewedVideo} featured onBlocked={handleBlocked} />
        </div>
      </div>
    </section>
  );
}
