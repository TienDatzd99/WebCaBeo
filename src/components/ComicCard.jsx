import { Link } from 'react-router-dom';
import { prefetchComicDetail } from '../api/comics.js';
import './ComicCard.css';

const FALLBACK_COVER = '/placeholder-cover.svg';
const FALLBACK_HOME = '/placeholder-home.svg';

const withFallback = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};

const STATUS_META = {
  ongoing: { label: 'Đang ra', cls: 'badge-ongoing' },
  completed: { label: 'Hoàn thành', cls: 'badge-done' },
  hiatus: { label: 'Tạm ngưng', cls: 'badge-hiatus' },
};

const getStatusMeta = (status) => STATUS_META[status] || STATUS_META.ongoing;

/* Horizontal/Square card — used in "Truyện đề cử" and "Đề cử" sliders */
export function CardSquare({ comic }) {
  const statusMeta = getStatusMeta(comic.status);
  const rating = Number(comic.rating ?? 0);
  const homeImage = withFallback(comic.home_cover_url || comic.cover_url, FALLBACK_HOME);
  const handlePrefetch = () => {
    prefetchComicDetail(comic.id).catch(() => {});
  };

  return (
    <Link
      to={`/comic/${comic.id}`}
      className="card-sq"
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <div className="card-sq-img">
        <img
          src={homeImage}
          alt={comic.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = FALLBACK_HOME;
          }}
        />
        <span className={`card-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
      </div>
      <div className="card-sq-info">
        <div className="card-sq-row1">
          <p className="card-sq-title">{comic.title}</p>
          <span className="card-sq-rating"><span className="star-y">★</span> {rating > 0 ? rating.toFixed(1) : '—'}</span>
        </div>
        <div className="card-sq-row2">
          <span className="card-sq-views">Lượt xem: {comic.views?.toLocaleString() ?? 0}</span>
          <span className="card-sq-chaps">{comic.chapterCount ?? comic.chapter_count ?? '—'} chương</span>
        </div>
      </div>
    </Link>
  );
}

/* Portrait card — used in "Truyện mới nhất" grid */
export function CardPortrait({ comic }) {
  const statusMeta = getStatusMeta(comic.status);
  const coverImage = withFallback(comic.cover_url, FALLBACK_COVER);
  const handlePrefetch = () => {
    prefetchComicDetail(comic.id).catch(() => {});
  };

  return (
    <Link
      to={`/comic/${comic.id}`}
      className="card-pt"
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <div className="card-pt-img">
        <img
          src={coverImage}
          alt={comic.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = FALLBACK_COVER;
          }}
        />
        <span className={`card-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
        {comic.isNew && <span className="card-badge badge-new" style={{ top: '6px', right: comic.status ? '68px' : '6px' }}>Mới</span>}
      </div>
      <div className="card-pt-info">
        <div className="card-pt-row1">
          <p className="card-pt-title">{comic.title}</p>
          <span className="card-pt-rating"><span className="star-y">★</span> {comic.rating ?? '5.0'}</span>
        </div>
        <div className="card-pt-row2">
          <span className="card-pt-views">Lượt xem: {comic.views?.toLocaleString()}</span>
          <span className="card-pt-chaps">{comic.chapterCount ?? comic.chapter_count ?? '—'} chương</span>
        </div>
      </div>
    </Link>
  );
}

/* Default export = portrait (backward compat) */
export default CardPortrait;
