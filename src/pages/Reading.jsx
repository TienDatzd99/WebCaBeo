import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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

    return () => {
      window.clearInterval(intervalId);
      document.body.classList.remove('reading-guarded');
      document.removeEventListener('contextmenu', blockEvent);
      document.removeEventListener('copy', blockEvent);
      document.removeEventListener('cut', blockEvent);
      document.removeEventListener('dragstart', blockEvent);
      document.removeEventListener('selectstart', blockEvent);
      window.removeEventListener('keydown', onKeyDown);
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
  const hasText = Boolean(textContent);

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
      <section className="novel-shell">
        <h1 className="novel-title">Chương {chapter.number}</h1>

        <div className="novel-toolbar">
          <button
            className="novel-nav-btn"
            disabled={!chapter.prevChapter}
            onClick={() => chapter.prevChapter && goTo(chapter.prevChapter.id)}
          >
            <FiChevronLeft /> Chương trước
          </button>

          <Link to={`/comic/${id}`} className="novel-back-link">Trở về tiểu thuyết</Link>

          <button
            className="novel-nav-btn"
            disabled={!chapter.nextChapter}
            onClick={() => chapter.nextChapter && goTo(chapter.nextChapter.id)}
          >
            Chương sau <FiChevronRight />
          </button>
        </div>

        <article className="chapter-text-wrap">
          <h2 className="chapter-subtitle">{chapter.title || `Chương ${chapter.number}`}</h2>
          {hasText ? (
            <pre className="chapter-text-block">{textContent}</pre>
          ) : (
            <p className="chapter-text-empty">Nội dung chương đang được cập nhật.</p>
          )}
        </article>
      </section>
    </div>
  );
};

export default Reading;
