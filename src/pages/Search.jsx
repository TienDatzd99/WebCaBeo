import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiSearch, FiFilter, FiX, FiChevronDown, FiEye } from 'react-icons/fi';
import { getComics } from '../api/comics.js';
import { getAdminGenres } from '../api/admin.js';
import './Search.css';

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Mới nhất' },
  { value: 'views',    label: 'Nhiều xem nhất' },
  { value: 'favorited',label: 'Yêu thích nhất' },
];

const LOAI_OPTIONS   = ['Truyện ngắn', 'Truyện dài'];
const STATUS_OPTIONS = ['Đang ra', 'Đã hoàn thành', 'Đã dừng'];
const CHAPTER_OPTIONS = [
  { value: '',       label: 'Độ dài bất kỳ' },
  { value: 'short',  label: 'Ngắn (< 100 chương)' },
  { value: 'medium', label: 'Trung bình (100 - 300 chương)' },
  { value: 'long',   label: 'Dài (> 300 chương)' },
];

const LIMIT = 18;

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam   = searchParams.get('q') || '';
  const sortParam    = searchParams.get('sort') || 'newest';
  const statusParam  = searchParams.get('status') || '';
  const genreParam   = searchParams.get('genre') || '';
  const loaiParam    = searchParams.get('loai') || '';
  const ratingParam  = Number(searchParams.get('rating') || 0);
  const chapParam    = searchParams.get('chapters') || '';
  const pageParam    = Number(searchParams.get('page') || 1);

  const [comics,      setComics]      = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [genres,      setGenres]      = useState([]);
  const [showFilter,  setShowFilter]  = useState(window.innerWidth >= 900);
  const [searchInput, setSearchInput] = useState(queryParam);
  const [ratingLocal, setRatingLocal] = useState(ratingParam);

  // Load genres once
  useEffect(() => {
    getAdminGenres().then(r => setGenres(r.data)).catch(() => {});
  }, []);

  // Load comics on filter change
  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: LIMIT, page: pageParam, sort: sortParam };
    if (queryParam)  params.search   = queryParam;
    if (statusParam) params.status   = statusParam;
    if (genreParam)  params.genre    = genreParam;
    if (ratingParam) params.min_rating = ratingParam;
    if (chapParam)   params.chapters = chapParam;

    getComics(params)
      .then(r => { const d = r.data; setComics(d.comics || d); setTotal(d.total || 0); })
      .catch(() => setComics([]))
      .finally(() => setLoading(false));
  }, [queryParam, sortParam, statusParam, genreParam, ratingParam, chapParam, pageParam]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key, val) => setSearchParams(prev => {
    if (val !== '' && val !== null && val !== undefined) prev.set(key, val);
    else prev.delete(key);
    if (key !== 'page') prev.set('page', '1');
    return new URLSearchParams(prev);
  });

  const clearAll = () => { setRatingLocal(0); setSearchParams({}); };
  const submitSearch = (e) => { e.preventDefault(); setParam('q', searchInput.trim()); };

  const hasFilters = queryParam || statusParam || genreParam || loaiParam || ratingParam || chapParam;
  const totalPages = Math.ceil(total / LIMIT);

  /* Pagination numbers */
  const pageNums = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [];
    if (pageParam <= 4) {
      for (let i = 1; i <= Math.min(5, totalPages); i++) pages.push(i);
      if (totalPages > 5) { pages.push('...'); pages.push(totalPages); }
    } else if (pageParam >= totalPages - 3) {
      pages.push(1); pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1); pages.push('...');
      for (let i = pageParam - 1; i <= pageParam + 1; i++) pages.push(i);
      pages.push('...'); pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="sp-page">
      <div className="sp-container">

        {/* ── Header ── */}
        <div className="sp-header">
          <div className="sp-title-row">
            <span className="sp-title">Kết quả tìm kiếm</span>
            {!loading && <span className="sp-count">{total.toLocaleString()} kết quả</span>}
          </div>

          <form className="sp-search-wrap" onSubmit={submitSearch}>
            <FiSearch className="sp-search-ico" />
            <input
              className="sp-search-input"
              placeholder="Tìm kiếm theo tên truyện, tác giả, ..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </form>

          <div className="sp-toolbar">
            <div className="sp-toolbar-left">
              <button
                className={`sp-filter-btn ${showFilter ? 'active' : ''}`}
                onClick={() => setShowFilter(f => !f)}
              >
                <FiFilter /> Bộ lọc
              </button>
              {hasFilters && (
                <button className="sp-clear-btn" onClick={clearAll}>
                  <FiX /> Xóa tất cả bộ lọc
                </button>
              )}
            </div>
            <div className="sp-sort-wrap">
              <span className="sp-sort-label">Sắp xếp theo:</span>
              <div className="sp-sort-select-wrap">
                <select
                  className="sp-sort-select"
                  value={sortParam}
                  onChange={e => setParam('sort', e.target.value)}
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <FiChevronDown className="sp-sort-arrow" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className={`sp-body ${showFilter ? 'has-filter' : ''}`}>

          {/* ── Sidebar — matches camap.site exactly ── */}
          {showFilter && (
            <aside className="sp-sidebar">
              <div className="sp-sidebar-header">Lọc theo</div>

              <div className="sp-sidebar-body">

                {/* Loại truyện */}
                <div className="sp-filter-group">
                  <label className="sp-filter-label">Loại truyện</label>
                  <div className="sp-filter-checks">
                    {LOAI_OPTIONS.map(l => (
                      <label key={l} className="sp-check-row">
                        <input
                          type="checkbox"
                          className="sp-checkbox"
                          checked={loaiParam === l}
                          onChange={() => setParam('loai', loaiParam === l ? '' : l)}
                        />
                        <span className="sp-check-label">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Thể loại */}
                {genres.length > 0 && (
                  <div className="sp-filter-group">
                    <label className="sp-filter-label">Thể loại</label>
                    <div className="sp-filter-checks sp-genre-scroll">
                      {genres.map(g => (
                        <label key={g.id} className="sp-check-row">
                          <input
                            type="checkbox"
                            className="sp-checkbox"
                            checked={genreParam === g.name}
                            onChange={() => setParam('genre', genreParam === g.name ? '' : g.name)}
                          />
                          <span className="sp-check-label">{g.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="sp-divider" />

                {/* Trạng thái */}
                <div className="sp-filter-group">
                  <label className="sp-filter-label">Trạng thái</label>
                  <div className="sp-filter-checks">
                    {STATUS_OPTIONS.map(s => (
                      <label key={s} className="sp-check-row">
                        <input
                          type="checkbox"
                          className="sp-checkbox"
                          checked={statusParam === s}
                          onChange={() => setParam('status', statusParam === s ? '' : s)}
                        />
                        <span className="sp-check-label">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="sp-divider" />

                {/* Rating slider */}
                <div className="sp-filter-group">
                  <label className="sp-filter-label">Rating</label>
                  <input
                    type="range"
                    min={0} max={5} step={0.5}
                    value={ratingLocal}
                    className="sp-slider"
                    onChange={e => setRatingLocal(Number(e.target.value))}
                    onMouseUp={() => setParam('rating', ratingLocal || '')}
                    onTouchEnd={() => setParam('rating', ratingLocal || '')}
                  />
                  <div className="sp-slider-labels">
                    <span>0</span>
                    <span>{ratingLocal > 0 ? `${ratingLocal}+` : '0.0+'}</span>
                    <span>5</span>
                  </div>
                </div>

                <div className="sp-divider" />

                {/* Số chương */}
                <div className="sp-filter-group">
                  <label className="sp-filter-label">Số chương</label>
                  <div className="sp-filter-checks">
                    {CHAPTER_OPTIONS.map(c => (
                      <label key={c.value} className="sp-check-row">
                        <input
                          type="radio"
                          name="chapterCount"
                          className="sp-checkbox"
                          checked={chapParam === c.value}
                          onChange={() => setParam('chapters', c.value)}
                        />
                        <span className="sp-check-label">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </aside>
          )}

          {/* Cards grid */}
          <div className="sp-main">
            {loading ? (
              <div className="sp-grid">
                {Array(LIMIT).fill(0).map((_, i) => (
                  <div key={i} className="sp-card">
                    <div className="sp-card-img skel" style={{ height: 192 }} />
                    <div className="sp-card-info">
                      <div className="skel-line" style={{ width:'80%', height:13, borderRadius:3, background:'#2d2d2d' }} />
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <div className="skel-line" style={{ width:'38%', height:11, borderRadius:3, background:'#2a2a2a' }} />
                        <div className="skel-line" style={{ width:'32%', height:11, borderRadius:3, background:'#2a2a2a' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : comics.length > 0 ? (
              <div className="sp-grid">
                {comics.map(c => <SearchCard key={c.id} comic={c} />)}
              </div>
            ) : (
              <div className="sp-empty">
                <FiSearch size={40} style={{ color: '#4b5563' }} />
                <p>Không tìm thấy truyện nào</p>
                {hasFilters && (
                  <button className="sp-clear-btn" style={{ marginTop: 8 }} onClick={clearAll}>
                    <FiX /> Xóa bộ lọc
                  </button>
                )}
              </div>
            )}

            {totalPages > 1 && (
              <div className="sp-pagination">
                <button className="sp-pg-btn sp-pg-text" disabled={pageParam <= 1}
                  onClick={() => setParam('page', pageParam - 1)}>Trước</button>

                {pageNums().map((p, i) =>
                  p === '...'
                    ? <span key={`e${i}`} className="sp-pg-ellipsis">...</span>
                    : <button key={p}
                        className={`sp-pg-btn ${p === pageParam ? 'active' : ''}`}
                        onClick={() => setParam('page', p)}>{p}</button>
                )}

                <button className="sp-pg-btn sp-pg-text" disabled={pageParam >= totalPages}
                  onClick={() => setParam('page', pageParam + 1)}>Sau</button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Card ── */
function SearchCard({ comic }) {
  const statusLabel = comic.status === 'completed' ? 'Đã Hoàn Thành' : 'Đang Ra';
  const fmtViews = n => {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return n.toLocaleString('vi-VN');
    return String(n);
  };
  return (
    <Link to={`/comic/${comic.id}`} className="sp-card">
      <div className="sp-card-img-wrap">
        <img src={comic.cover_url} alt={comic.title} className="sp-card-img" loading="lazy" />
        <span className="sp-badge">{statusLabel}</span>
      </div>
      <div className="sp-card-info">
        <div className="sp-card-title">{comic.title}</div>
        <div className="sp-card-meta">
          <span className="sp-card-views"><FiEye size={11} /> Lượt xem: {fmtViews(comic.views)}</span>
          <span className="sp-card-chapter">
            {comic.latestChapter ? `Chương ${comic.latestChapter}: đã cập nhật` : '— chương'}
          </span>
        </div>
      </div>
    </Link>
  );
}
