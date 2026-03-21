import { Link } from 'react-router-dom';
import './ComicCard.css';

/* Horizontal/Square card — used in "Truyện đề cử" and "Đề cử" sliders */
export function CardSquare({ comic }) {
  const statusLabel = comic.status === 'completed' ? 'Hoàn thành' : 'Đang ra';
  const statusCls   = comic.status === 'completed' ? 'badge-done' : 'badge-ongoing';

  return (
    <Link to={`/comic/${comic.id}`} className="card-sq">
      <div className="card-sq-img">
        <img src={comic.cover_url} alt={comic.title} loading="lazy" />
        <span className={`card-badge ${statusCls}`}>{statusLabel}</span>
      </div>
      <div className="card-sq-info">
        <p className="card-sq-title">{comic.title}</p>
        <div className="card-sq-row2">
          <span className="card-sq-views">Lượt xem: {comic.views?.toLocaleString()}</span>
          <span className="card-sq-chaps">{comic.chapterCount ?? comic.chapter_count ?? '—'} chương</span>
        </div>
      </div>
    </Link>
  );
}

/* Portrait card — used in "Truyện mới nhất" grid */
export function CardPortrait({ comic }) {
  const statusLabel = comic.status === 'completed' ? 'Hoàn thành' : 'Đang ra';
  const statusCls   = comic.status === 'completed' ? 'badge-done' : 'badge-ongoing';

  return (
    <Link to={`/comic/${comic.id}`} className="card-pt">
      <div className="card-pt-img">
        <img src={comic.cover_url} alt={comic.title} loading="lazy" />
        <span className={`card-badge ${statusCls}`}>{statusLabel}</span>
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
