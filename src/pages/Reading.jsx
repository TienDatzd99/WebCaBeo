import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiList, FiHome } from 'react-icons/fi';
import { FiLoader } from 'react-icons/fi';
import { getChapter, markChapterRead } from '../api/chapters.js';
import { reportSecurityFlag } from '../api/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Reading.css';

const Reading = () => {
  const { id, chapterId } = useParams();
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNav, setShowNav] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const hasReportedRef = useRef(false);

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

  useEffect(() => {
    if (!blocked || hasReportedRef.current) return;
    hasReportedRef.current = true;

    const token = localStorage.getItem('token');
    if (token) {
      reportSecurityFlag('devtools-detected').catch(() => {});
    }

    logoutUser();
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    const timeoutId = window.setTimeout(() => {
      navigate('/', { replace: true });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [blocked, logoutUser, navigate]);

  useEffect(() => {
    const blockEvent = (e) => e.preventDefault();

    const onKeyDown = (e) => {
      const key = (e.key || '').toLowerCase();
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      if (e.key === 'F12') {
        e.preventDefault();
        setBlocked(true);
        return;
      }

      if (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) {
        e.preventDefault();
        setBlocked(true);
        return;
      }

      if (ctrlOrCmd && ['u', 's', 'p', 'c', 'x', 'a'].includes(key)) {
        e.preventDefault();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        setShowNav(false);
      }
    };

    // Heuristic detection to deter opening DevTools.
    const intervalId = window.setInterval(() => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      if (widthGap > 160 || heightGap > 160) {
        setBlocked(true);
      }
    }, 1200);

    document.body.classList.add('reading-guarded');
    document.addEventListener('contextmenu', blockEvent);
    document.addEventListener('copy', blockEvent);
    document.addEventListener('cut', blockEvent);
    document.addEventListener('dragstart', blockEvent);
    document.addEventListener('selectstart', blockEvent);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.body.classList.remove('reading-guarded');
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('selectstart', blockEvent);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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

  const textContent = (chapter.content || '').trim();
  const textParagraphs = textContent
    ? textContent.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean)
    : [];

  if (blocked) return (
    <div className="reading-page">
      <div className="reading-center reading-blocked">
        <h2>Nội dung đã bị khóa</h2>
        <p>Hệ thống phát hiện thao tác không hợp lệ (DevTools hoặc sao chép nội dung).</p>
        <button className="nav-chap-btn" onClick={() => navigate(`/comic/${id}`)}>Quay lại truyện</button>
      </div>
    </div>
  );

  return (
    <div className="reading-page fade-in">
      {/* Top nav */}
      <div className={`reading-nav top-nav ${showNav ? 'visible' : 'hidden'}`}>
        <div className="nav-row">
          <Link to={`/comic/${id}`} className="nav-back-btn"><FiChevronLeft /> {chapter.comic_title}</Link>
          <span className="nav-chap-title">
            Chapter {chapter.number}{chapter.title ? ` - ${chapter.title}` : ''}
          </span>
          <div className="nav-icons">
            <Link to="/" className="nav-icon-btn" title="Trang chủ"><FiHome /></Link>
            <Link to={`/comic/${id}`} className="nav-icon-btn" title="Danh sách chương"><FiList /></Link>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="reading-content" onClick={() => setShowNav(v => !v)}>
        <article className="chapter-text-wrap">
          <h1 className="chapter-text-title">Chương {chapter.number}{chapter.title ? ` - ${chapter.title}` : ''}</h1>
          {textParagraphs.length > 0 ? (
            textParagraphs.map((paragraph, idx) => (
              <p key={idx} className="chapter-text-paragraph">{paragraph}</p>
            ))
          ) : (
            <p className="chapter-text-empty">Nội dung chương đang được cập nhật.</p>
          )}
        </article>
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
