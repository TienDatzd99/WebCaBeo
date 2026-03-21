import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiList, FiHome } from 'react-icons/fi';
import { FiLoader } from 'react-icons/fi';
import { getChapter, markChapterRead } from '../api/chapters.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Reading.css';

const Reading = () => {
  const { id, chapterId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNav, setShowNav] = useState(true);

  useEffect(() => {
    setLoading(true);
    setChapter(null);
    getChapter(chapterId)
      .then(r => {
        setChapter(r.data);
        if (user) markChapterRead(chapterId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [chapterId, user]);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const cur = window.scrollY;
      if (Math.abs(cur - last) < 10) return;
      setShowNav(cur < last || cur < 100);
      last = cur;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = useCallback((cId) => navigate(`/read/${id}/${cId}`), [id, navigate]);

  if (loading) return (
    <div className="reading-page">
      <div className="reading-center">
        <FiLoader className="spin" size={36} />
        <span>Đang tải chapter...</span>
      </div>
    </div>
  );

  if (!chapter) return (
    <div className="reading-page">
      <div className="reading-center"><p>Không tìm thấy chapter!</p></div>
    </div>
  );

  return (
    <div className="reading-page fade-in">
      {/* Top nav */}
      <div className={`reading-nav top-nav ${showNav ? 'visible' : 'hidden'}`}>
        <div className="nav-row">
          <Link to={`/comic/${id}`} className="nav-back-btn"><FiChevronLeft /> {chapter.comic_title}</Link>
          <span className="nav-chap-title">Chapter {chapter.number}</span>
          <div className="nav-icons">
            <Link to="/" className="nav-icon-btn" title="Trang chủ"><FiHome /></Link>
            <Link to={`/comic/${id}`} className="nav-icon-btn" title="Danh sách chương"><FiList /></Link>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="reading-content" onClick={() => setShowNav(v => !v)}>
        {chapter.pages.map(p => (
          <img key={p.id} src={p.image_url} alt={`Trang ${p.page_num}`} className="comic-page-img" loading="lazy" />
        ))}
      </div>

      {/* Bottom nav */}
      <div className={`reading-nav bottom-nav ${showNav ? 'visible' : 'hidden'}`}>
        <div className="nav-row center">
          <button
            className="nav-chap-btn"
            disabled={!chapter.prevChapter}
            onClick={() => chapter.prevChapter && goTo(chapter.prevChapter.id)}
          ><FiChevronLeft /> Chap trước</button>
          <span className="nav-chap-label">Chapter {chapter.number}</span>
          <button
            className="nav-chap-btn"
            disabled={!chapter.nextChapter}
            onClick={() => chapter.nextChapter && goTo(chapter.nextChapter.id)}
          >Chap sau <FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
};

export default Reading;
