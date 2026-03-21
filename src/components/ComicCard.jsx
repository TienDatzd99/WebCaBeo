import { Link } from 'react-router-dom';
import './ComicCard.css';

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
  const homeImage = comic.home_cover_url || comic.cover_url;

  return (
    <Link to={`/comic/${comic.id}`} className="card-sq">
      <div className="card-sq-img">
        <img src={homeImage} alt={comic.title} loading="lazy" />
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

  return (
    <Link to={`/comic/${comic.id}`} className="card-pt">
      <div className="card-pt-img">
        <img src={comic.cover_url} alt={comic.title} loading="lazy" />
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
