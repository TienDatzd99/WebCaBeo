import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FiUser, FiCheckCircle, FiBook, FiGrid,
  FiHeart, FiBookmark, FiLoader, FiEye,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { getComics, getComic, getComicChapters } from '../api/comics.js';
import { toggleFavorite, rateComic } from '../api/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import './ComicDetail.css';

const STATUS = {
  completed: { label: 'Hoàn Thành', cls: 'st-done' },
  ongoing:   { label: 'Đang Ra',    cls: 'st-ongoing' },
};

export default function ComicDetail() {
  const { id }       = useParams();
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const relRef       = useRef(null);

  const [comic,    setComic]    = useState(null);
  const [chapters, setChapters] = useState([]);
  const [related,  setRelated]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [faved,    setFaved]    = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [hov,      setHov]      = useState(0);
  /* review form */
  const [rName,    setRName]    = useState('');
  const [rComment, setRComment] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([getComic(id), getComicChapters(id), getComics({ limit: 10 })])
      .then(([c, ch, rel]) => {
        setComic(c.data);
        setFaved(c.data.isFavorited || false);
        setMyRating(c.data.userRating || 0);
        setChapters(ch.data);
        setRelated((rel.data.comics || rel.data).filter(x => String(x.id) !== String(id)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id]);

  const toggleFav = async () => {
    if (!user) return navigate('/login');
    const r = await toggleFavorite(id);
    setFaved(r.data.favorited);
  };

  const handleRate = async (score) => {
    if (!user) return navigate('/login');
    const r = await rateComic(id, score);
    setMyRating(r.data.userRating);
    setComic(p => ({ ...p, rating: r.data.rating, ratingCount: r.data.ratingCount }));
  };

  const scrollRel = (dir) => {
    relRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  if (loading) return <div className="cd-center"><FiLoader className="spin" size={34} /></div>;
  if (!comic)  return null;

  const st         = STATUS[comic.status] || { label: comic.status, cls: 'st-ongoing' };
  const avg        = comic.rating ? Number(comic.rating).toFixed(1) : null;
  const rCount     = comic.ratingCount ?? 0;
  const firstChap  = chapters.length ? chapters[chapters.length - 1] : null;
  const latestChap = chapters.length ? chapters[0] : null;
  const lastDate   = chapters.length ? new Date(chapters[0].created_at).toLocaleDateString('vi-VN') : '—';

  /* fake reviews for demo */
  const reviews = [
    { name: 'Anonymous', stars: 5, text: 'Truyện hay lắm!', date: '13/1/2026' },
    { name: 'Anonymous', stars: 5, text: 'Đọc một hơi xong luôn!', date: '13/1/2026' },
  ];

  return (
    <div className="cd-page fade-in">

      {/* ═══════════════ HERO ═══════════════ */}
      <div className="cd-hero">
        <div className="cd-hero-bg" style={{ backgroundImage: `url(${comic.cover_url})` }} />
        <div className="cd-hero-veil" />

        <div className="cd-hero-body">
          {/* LEFT: cover */}
          <div className="cd-cover-col">
            <img src={comic.cover_url} alt={comic.title} className="cd-cover" />
          </div>

          {/* RIGHT: meta */}
          <div className="cd-meta-col">
            <h1 className="cd-title">{comic.title}</h1>

            <div className="cd-fields">
              <div className="cd-row">
                <FiUser className="cd-ri violet" />
                <span>Người dịch: <span className="clr-purple font-bold">{comic.author}</span></span>
              </div>
              <div className="cd-row">
                <FiUser className="cd-ri cyan" />
                <span>Tác giả: <span className="clr-cyan font-bold">{comic.author}</span></span>
              </div>
              <div className="cd-row">
                <FiCheckCircle className="cd-ri green" />
                <span>Trạng thái: <span className={`cd-badge ${st.cls}`}>{st.label}</span></span>
              </div>
              <div className="cd-row">
                <FiBook className="cd-ri" />
                <span>Số chương: <span className="clr-accent font-bold">{chapters.length}</span></span>
              </div>
              <div className="cd-row cd-genre-row">
                <FiGrid className="cd-ri" />
                <span>Thể loại:</span>
                <div className="cd-genre-pills">
                  {comic.genres?.map(g => <span key={g.id} className="cd-pill">{g.name}</span>)}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="cd-actions">
              {firstChap  && <Link to={`/read/${id}/${firstChap.id}`}  className="cd-btn-primary">▶ Bắt đầu đọc</Link>}
              {latestChap && <Link to={`/read/${id}/${latestChap.id}`} className="cd-btn-red">▶ Đọc mới nhất</Link>}
              <button className={`cd-btn-glass ${faved ? 'faved' : ''}`} onClick={toggleFav}>
                <FiHeart size={14}/> Yêu thích
              </button>
              <button className="cd-btn-glass">
                <FiBookmark size={14}/> Đề cử
              </button>
            </div>

            {/* Description */}
            <h2 className="cd-subtitle">Mô tả</h2>
            <p className="cd-desc">{comic.description || 'Chưa có mô tả.'}</p>

            {/* Stats bar (inside meta col, right side like camap.site) */}
            <div className="cd-stats-bar">
              <div className="cd-stat"><span className="s-val">{comic.views?.toLocaleString() ?? 0}</span><span className="s-lbl">Lượt xem</span></div>
              <div className="sd"/>
              <div className="cd-stat"><span className="s-val">0</span><span className="s-lbl">Yêu thích</span></div>
              <div className="sd"/>
              <div className="cd-stat"><span className="s-val">0</span><span className="s-lbl">Đề cử</span></div>
              <div className="sd"/>
              <div className="cd-stat"><span className="s-val">{lastDate}</span><span className="s-lbl">Lần cập nhật cuối</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ BODY ═══════════════ */}
      <div className="cd-body">

        {/* Row: LEFT=rating/comment, RIGHT=chapter+reviews */}
        <div className="cd-two-col">

          {/* LEFT */}
          <div className="cd-left-col">

            {/* Rating summary */}
            <section className="cd-section">
              <h2 className="cd-sec-title">Đánh giá và nhận xét</h2>
              <div className="cd-card">
                <div className="rating-hero">
                  <span className="rating-big-num">{avg ?? '—'}</span>
                  <div>
                    <div className="stars-row">
                      {[1,2,3,4,5].map(s => (
                        <span key={s} className={`star-d ${s <= Math.round(avg||0) ? 'lit' : ''}`}>★</span>
                      ))}
                    </div>
                    <span className="rating-cnt">{rCount} đánh giá</span>
                  </div>
                </div>
                {[
                  { lbl: 'Xuất sắc',   pct: rCount ? 67 : 0 },
                  { lbl: 'Rất tốt',    pct: rCount ? 33 : 0 },
                  { lbl: 'Trung bình', pct: 0 },
                  { lbl: 'Tệ',         pct: 0 },
                  { lbl: 'Rất tệ',     pct: 0 },
                ].map(({ lbl, pct }) => (
                  <div key={lbl} className="rb-row">
                    <span className="rb-lbl">{lbl}</span>
                    <div className="rb-track"><div className="rb-fill" style={{ width: `${pct}%` }} /></div>
                    <span className="rb-pct">{pct}%</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Write review */}
            <section className="cd-section">
              <h2 className="cd-sec-title">Đánh giá của bạn</h2>
              <div className="cd-card">
                <div className="form-field">
                  <label className="form-lbl">Tên của bạn</label>
                  <input className="form-inp" placeholder="Nhập tên của bạn..." value={rName} onChange={e => setRName(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-lbl">Đánh giá của bạn</label>
                  <div className="form-stars">
                    {[1,2,3,4,5].map(s => (
                      <button key={s}
                        className={`fstar ${s <= (hov || myRating) ? 'lit' : ''}`}
                        onMouseEnter={() => setHov(s)}
                        onMouseLeave={() => setHov(0)}
                        onClick={() => handleRate(s)}
                      >☆</button>
                    ))}
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-lbl">Nhận xét của bạn</label>
                  <textarea
                    className="form-inp form-ta"
                    placeholder="Chia sẻ cảm nhận của bạn..."
                    value={rComment}
                    onChange={e => setRComment(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <div className="cd-right-col">

            {/* Chapter list */}
            <section className="cd-section">
              <div className="chap-sec-head">
                <h2 className="cd-sec-title">Danh sách chương</h2>
                <span className="sort-label">Sắp xếp: Cũ nhất</span>
              </div>
              <div className="chap-list">
                {[...chapters].reverse().map(ch => (
                  <Link to={`/read/${id}/${ch.id}`} key={ch.id} className="chap-row">
                    <span className="chap-name">Chương {ch.number}{ch.title && ch.title !== `Chapter ${ch.number}` ? ` - ${ch.title}` : ''}</span>
                    <span className="chap-date">{new Date(ch.created_at).toLocaleDateString('vi-VN')}</span>
                  </Link>
                ))}
                {chapters.length === 0 && <p className="chap-empty">Chưa có chương nào.</p>}
              </div>
            </section>

            {/* Review list */}
            <section className="cd-section">
              <h2 className="cd-sec-title">Danh sách các đánh giá</h2>
              <div className="rev-list">
                {reviews.map((r, i) => (
                  <div key={i} className="rev-card">
                    <div className="rev-header">
                      <div className="rev-avatar">A</div>
                      <div className="rev-meta">
                        <span className="rev-name">{r.name}</span>
                        <div className="rev-stars">
                          {[1,2,3,4,5].map(s => <span key={s} className={`star-sm ${s <= r.stars ? 'lit' : ''}`}>★</span>)}
                        </div>
                      </div>
                      <span className="rev-date">{r.date}</span>
                    </div>
                    <p className="rev-text">{r.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* ── Related comics slider ── */}
        <section className="cd-section rel-section">
          <h2 className="cd-sec-title">Truyện liên quan</h2>
          <div className="rel-wrap">
            <button className="rel-arr left" onClick={() => scrollRel(-1)}><FiChevronLeft /></button>
            <div className="rel-scroller" ref={relRef}>
              {related.map(r => (
                <Link to={`/comic/${r.id}`} key={r.id} className="rel-card">
                  <div className="rel-img-wrap">
                    <img src={r.cover_url} alt={r.title} className="rel-img" />
                    <span className={`rel-badge ${r.status === 'completed' ? 'rb-done' : 'rb-ongoing'}`}>
                      {r.status === 'completed' ? 'Hoàn Thành' : 'Đang ra'}
                    </span>
                  </div>
                  <div className="rel-info">
                    <p className="rel-title">{r.title}</p>
                    <p className="rel-meta"><span className="star-gold">★</span> {r.rating ?? '5.0'}</p>
                    <p className="rel-views">Lượt xem: {r.views?.toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
            <button className="rel-arr right" onClick={() => scrollRel(1)}><FiChevronRight /></button>
          </div>
        </section>

      </div>{/* /cd-body */}
    </div>
  );
}
