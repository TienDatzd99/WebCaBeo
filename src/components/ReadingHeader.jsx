import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSun, FiType, FiHeart, FiStar, FiBookmark } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { getFavorites, rateComic, toggleFavorite } from '../api/auth.js';
import './ReadingHeader.css';

const FONT_SCALES = [1, 1.1, 1.2, 1.3];

const ReadingHeader = ({ chapterLabel, comicId, chapterId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLightMode, setIsLightMode] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const bookmarkKey = useMemo(() => `reading_bookmark_${comicId || 'unknown'}`, [comicId]);

  useEffect(() => {
    const savedMode = localStorage.getItem('reading_mode') === 'light';
    setIsLightMode(savedMode);
    document.body.classList.toggle('reading-light', savedMode);

    const savedScale = Number(localStorage.getItem('reading_font_scale') || 1);
    const safeScale = FONT_SCALES.includes(savedScale) ? savedScale : 1;
    setFontScale(safeScale);
    document.documentElement.style.setProperty('--reading-font-scale', String(safeScale));

    return () => {
      document.body.classList.remove('reading-light');
      document.documentElement.style.setProperty('--reading-font-scale', '1');
    };
  }, []);

  useEffect(() => {
    if (!user || !comicId) {
      setIsFavorited(false);
      return;
    }

    getFavorites()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        const hasFavorite = list.some((item) => String(item?.id) === String(comicId));
        setIsFavorited(hasFavorite);
      })
      .catch(() => {
        setIsFavorited(false);
      });
  }, [user, comicId]);

  const handleThemeToggle = () => {
    const nextMode = !isLightMode;
    setIsLightMode(nextMode);
    document.body.classList.toggle('reading-light', nextMode);
    localStorage.setItem('reading_mode', nextMode ? 'light' : 'dark');
  };

  const handleFontToggle = () => {
    const currentIndex = FONT_SCALES.indexOf(fontScale);
    const nextScale = FONT_SCALES[(currentIndex + 1) % FONT_SCALES.length];
    setFontScale(nextScale);
    document.documentElement.style.setProperty('--reading-font-scale', String(nextScale));
    localStorage.setItem('reading_font_scale', String(nextScale));
  };

  const requireAuth = () => {
    if (user) return true;
    navigate('/login');
    return false;
  };

  const handleFavoriteToggle = async () => {
    if (!requireAuth() || !comicId || isBusy) return;

    setIsBusy(true);
    try {
      await toggleFavorite(comicId);
      setIsFavorited((prev) => !prev);
    } catch {
      // Ignore transient failures to avoid interrupting reading flow.
    } finally {
      setIsBusy(false);
    }
  };

  const handleRateClick = async () => {
    if (!requireAuth() || !comicId || isBusy) return;

    const raw = window.prompt('Nhập điểm đánh giá (1 đến 5):', '5');
    if (raw === null) return;

    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      window.alert('Điểm không hợp lệ. Vui lòng nhập số nguyên từ 1 đến 5.');
      return;
    }

    setIsBusy(true);
    try {
      await rateComic(comicId, score);
      window.alert(`Đã gửi đánh giá ${score} sao.`);
    } catch {
      window.alert('Không thể gửi đánh giá lúc này. Vui lòng thử lại.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleBookmarkClick = () => {
    if (!comicId || !chapterId) return;
    localStorage.setItem(bookmarkKey, String(chapterId));
    window.alert('Đã lưu bookmark chương hiện tại.');
  };

  return (
    <header className="reading-header">
      <div className="reading-header-inner">
        <div className="reading-header-left">
          <Link to="/" className="reading-header-logo-link" aria-label="Trang chủ">
            <img
              src="/favicon.svg"
              alt="Logo"
              className="reading-header-logo"
            />
            <span className="reading-header-brand">Cá Mập</span>
          </Link>
        </div>

        <div className="reading-header-center">
          <span>{chapterLabel}</span>
        </div>

        <div className="reading-header-actions" aria-label="Công cụ đọc truyện">
          <button
            type="button"
            className={`reading-header-icon-btn ${isLightMode ? 'active' : ''}`}
            aria-label="Chế độ sáng/tối"
            onClick={handleThemeToggle}
          >
            <FiSun className="icon-sun" />
          </button>
          <button
            type="button"
            className="reading-header-icon-btn hide-mobile"
            aria-label="Tùy chỉnh kiểu chữ"
            onClick={handleFontToggle}
            title={`Cỡ chữ: ${Math.round(fontScale * 100)}%`}
          >
            <FiType />
          </button>
          <button
            type="button"
            className={`reading-header-icon-btn hide-mobile ${isFavorited ? 'active' : ''}`}
            aria-label="Yêu thích"
            onClick={handleFavoriteToggle}
            disabled={isBusy}
          >
            <FiHeart />
          </button>
          <button
            type="button"
            className="reading-header-icon-btn hide-mobile"
            aria-label="Đánh giá"
            onClick={handleRateClick}
            disabled={isBusy}
          >
            <FiStar />
          </button>
          <button
            type="button"
            className="reading-header-icon-btn hide-mobile"
            aria-label="Đánh dấu"
            onClick={handleBookmarkClick}
          >
            <FiBookmark />
          </button>
        </div>
      </div>
    </header>
  );
};

export default ReadingHeader;
