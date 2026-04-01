import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FiUser, FiCheckCircle, FiBook, FiGrid,
  FiHeart, FiBookmark, FiLoader, FiEye,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { getComics, getComic, getComicChapters, invalidateComicCache, prefetchComicDetail, prefetchHomeData } from '../api/comics.js';
import { toggleFavorite, toggleRecommend, rateComic } from '../api/auth.js';
import { getComicReviews, submitComicReview } from '../api/ratings.js';
import { useAuth } from '../context/AuthContext.jsx';
import './ComicDetail.css';

const STATUS = {
  completed: { label: 'Hoàn Thành', cls: 'st-done' },
  ongoing:   { label: 'Đang Ra',    cls: 'st-ongoing' },
};

const DEFAULT_AUDIO_URL = 'https://www.youtube.com/@CaBeoAudio';
const FALLBACK_COVER = '/placeholder-cover.svg';
const FALLBACK_HOME = '/placeholder-home.svg';

const safeImage = (value, fallback = FALLBACK_COVER) => {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
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
  const [recommended, setRecommended] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [hov,      setHov]      = useState(0);
  /* review form */
  const [rName,    setRName]    = useState('');
  const [rComment, setRComment] = useState('');
  const [reviews,  setReviews]  = useState([]);
  const [reviewErr, setReviewErr] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getComic(id), getComicChapters(id), getComics({ limit: 10 }), getComicReviews(id)])
      .then(([c, ch, rel, rv]) => {
        setComic(c.data);
        setFaved(c.data.isFavorited || false);
        setRecommended(c.data.isRecommended || false);
        setMyRating(c.data.userRating || 0);
        setChapters(ch.data);
        setRelated((rel.data.comics || rel.data).filter(x => String(x.id) !== String(id)));
        setReviews(rv.data.reviews || []);
        setReviewErr('');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    prefetchHomeData().catch(() => {});
  }, []);

  useEffect(() => {
    const candidates = [comic?.home_cover_url, comic?.cover_url]
      .filter(Boolean)
      .slice(0, 2);

    related.slice(0, 4).forEach((item) => {
      if (item?.home_cover_url) candidates.push(item.home_cover_url);
      else if (item?.cover_url) candidates.push(item.cover_url);
    });

    candidates.forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    });
  }, [comic, related]);

  const toggleFav = async () => {
    try {
      if (!user) return navigate('/login');
      const r = await toggleFavorite(id);
      const nextFavorited = Boolean(r?.data?.favorited);
      setFaved(nextFavorited);
      setComic((prev) => {
        if (!prev) return prev;
        const current = Number(prev.favoriteCount || 0);
        const nextCount = nextFavorited ? current + 1 : Math.max(0, current - 1);
        return { ...prev, favoriteCount: nextCount };
      });
      invalidateComicCache(id);
    } catch {
      window.alert('Không thể cập nhật yêu thích lúc này. Vui lòng thử lại.');
    }
  };

  const toggleRec = async () => {
    try {
      if (!user) return navigate('/login');
      const r = await toggleRecommend(id);
      const nextRecommended = Boolean(r?.data?.recommended);
      const nextCount = Number(r?.data?.recommendCount || 0);
      setRecommended(nextRecommended);
      setComic((prev) => (prev ? { ...prev, recommendCount: nextCount } : prev));
      invalidateComicCache(id);
    } catch {
      window.alert('Không thể cập nhật đề cử lúc này. Vui lòng thử lại.');
    }
  };

  const handleRate = async (score) => {
    if (!user) return navigate('/login');
    const r = await rateComic(id, score);
    setMyRating(r.data.userRating);
    setComic(p => ({ ...p, rating: r.data.rating, ratingCount: r.data.ratingCount }));
    invalidateComicCache(id);
  };

  const handleSubmitReview = async () => {
    if (!user) return navigate('/login');

    const comment = rComment.trim();
    const name = rName.trim();
    if (!comment) {
      setReviewErr('Vui lòng nhập nhận xét trước khi gửi.');
      return;
    }

    setSavingReview(true);
    setReviewErr('');
    try {
      const r = await submitComicReview(id, {
        name,
        comment,
        score: myRating || undefined,
      });

      if (r.data.review) {
        setReviews(prev => [
          r.data.review,
          ...prev.filter(item => item.userId !== r.data.review.userId),
        ]);
      }

      setComic(p => ({
        ...p,
        rating: r.data.rating,
        ratingCount: r.data.ratingCount,
      }));
      if (r.data.userRating) setMyRating(r.data.userRating);
      setRComment('');
      invalidateComicCache(id);
    } catch (err) {
      setReviewErr(err?.response?.data?.error || 'Không gửi được nhận xét. Vui lòng thử lại.');
    } finally {
      setSavingReview(false);
    }
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
  const audioHref  = comic.audio_url
    ? (comic.audio_url.startsWith('http://') || comic.audio_url.startsWith('https://')
      ? comic.audio_url
      : `https://${comic.audio_url}`)
    : DEFAULT_AUDIO_URL;
  const translatorName = (comic.translator || comic.author || '').trim();
  const authorName = (comic.author || '').trim();
  const coverImage = safeImage(comic.cover_url, FALLBACK_COVER);
  const heroImage = safeImage(comic.home_cover_url || comic.cover_url, FALLBACK_HOME);

  return (
    <div className="cd-page fade-in">

      {/* ═══════════════ HERO ═══════════════ */}
      <div className="cd-hero">
        <div className="cd-hero-bg" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="cd-hero-veil" />

        <div className="cd-hero-body">
          {/* LEFT: cover */}
          <div className="cd-cover-col">
            <img
              src={coverImage}
              alt={comic.title}
              className="cd-cover"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_COVER;
              }}
            />
          </div>

          {/* RIGHT: meta */}
          <div className="cd-meta-col">
            <h1 className="cd-title">{comic.title}</h1>

            <div className="cd-fields">
              <div className="cd-row">
                <FiUser className="cd-ri violet" />
                <span>Người dịch: <span className="clr-purple font-bold">{translatorName || 'Đang cập nhật'}</span></span>
              </div>
              {authorName && authorName !== translatorName && (
                <div className="cd-row">
                  <FiUser className="cd-ri cyan" />
                  <span>Tác giả: <span className="clr-cyan font-bold">{authorName}</span></span>
                </div>
              )}
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
              <a href={audioHref} target="_blank" rel="noreferrer" className="cd-btn-red">
                ▶ Nghe audio
              </a>
              {latestChap && <Link to={`/read/${id}/${latestChap.id}`} className="cd-btn-red">▶ Đọc mới nhất</Link>}
              <button className={`cd-btn-glass ${faved ? 'faved' : ''}`} onClick={toggleFav}>
                <FiHeart size={14}/> Yêu thích
              </button>
              <button className={`cd-btn-glass ${recommended ? 'faved' : ''}`} onClick={toggleRec}>
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
              <div className="cd-stat"><span className="s-val">{Number(comic.favoriteCount || 0).toLocaleString()}</span><span className="s-lbl">Yêu thích</span></div>
              <div className="sd"/>
              <div className="cd-stat"><span className="s-val">{Number(comic.recommendCount || 0).toLocaleString()}</span><span className="s-lbl">Đề cử</span></div>
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
                        type="button"
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
                {reviewErr && <p className="review-msg review-err">{reviewErr}</p>}
                <div className="review-submit-wrap">
                  <button
                    type="button"
                    className="review-submit-btn"
                    onClick={handleSubmitReview}
                    disabled={savingReview}
                  >
                    {savingReview ? 'Đang gửi...' : 'Gửi nhận xét'}
                  </button>
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
                {reviews.length === 0 && <p className="chap-empty">Chưa có nhận xét nào.</p>}
                {reviews.map((r) => (
                  <div key={r.id} className="rev-card">
                    <div className="rev-header">
                      <div className="rev-avatar">{(r.name || 'A').trim().charAt(0).toUpperCase()}</div>
                      <div className="rev-meta">
                        <span className="rev-name">{r.name}</span>
                        <div className="rev-stars">
                          {[1,2,3,4,5].map(s => <span key={s} className={`star-sm ${s <= r.stars ? 'lit' : ''}`}>★</span>)}
                        </div>
                      </div>
                      <span className="rev-date">{new Date(r.date).toLocaleDateString('vi-VN')}</span>
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
                <Link
                  to={`/comic/${r.id}`}
                  key={r.id}
                  className="rel-card"
                  onMouseEnter={() => prefetchComicDetail(r.id).catch(() => {})}
                  onFocus={() => prefetchComicDetail(r.id).catch(() => {})}
                  onTouchStart={() => prefetchComicDetail(r.id).catch(() => {})}
                >
                  <div className="rel-img-wrap">
                    <img
                      src={safeImage(r.home_cover_url || r.cover_url, FALLBACK_HOME)}
                      alt={r.title}
                      className="rel-img"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_HOME;
                      }}
                    />
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
