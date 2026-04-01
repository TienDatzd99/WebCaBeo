import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSun, FiType, FiHeart, FiStar, FiBookmark } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import { getFavorites, rateComic, toggleFavorite } from '../api/auth.js';
import { getChapter } from '../api/chapters.js';
import './ReadingHeader.css';

const MIN_FONT_PERCENT = 85;
const MAX_FONT_PERCENT = 150;
const DEFAULT_FONT_PERCENT = 100;

const ReadingHeader = ({ chapterLabel, comicId, chapterId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLightMode, setIsLightMode] = useState(false);
  const [fontPercent, setFontPercent] = useState(DEFAULT_FONT_PERCENT);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [showFontSlider, setShowFontSlider] = useState(false);
  const [displayChapterLabel, setDisplayChapterLabel] = useState(chapterLabel || 'Đang tải...');

  const bookmarkKey = useMemo(() => `reading_bookmark_${comicId || 'unknown'}`, [comicId]);

  useEffect(() => {
    const savedMode = localStorage.getItem('reading_mode') === 'light';
    setIsLightMode(savedMode);
    document.body.classList.toggle('reading-light', savedMode);

    const savedScale = Number(localStorage.getItem('reading_font_scale') || 1);
    const safeScale = Number.isFinite(savedScale) && savedScale > 0 ? savedScale : 1;
    const percent = Math.round(safeScale * 100);
    const safePercent = Math.min(MAX_FONT_PERCENT, Math.max(MIN_FONT_PERCENT, percent));
    const normalizedScale = safePercent / 100;

    setFontPercent(safePercent);
    document.documentElement.style.setProperty('--reading-font-scale', String(normalizedScale));

    return () => {
      document.body.classList.remove('reading-light');
      document.documentElement.style.setProperty('--reading-font-scale', '1');
    };
  }, []);

  useEffect(() => {
    if (!chapterId) {
      setDisplayChapterLabel(chapterLabel || 'Đọc truyện');
      return;
    }

    setDisplayChapterLabel('Đang tải chương...');
    getChapter(chapterId)
      .then((res) => {
        const chapterNumber = res?.data?.number;
        if (chapterNumber !== undefined && chapterNumber !== null) {
          setDisplayChapterLabel(`Chương ${chapterNumber}`);
        } else {
          setDisplayChapterLabel(chapterLabel || `Chương ${chapterId}`);
        }
      })
      .catch(() => {
        setDisplayChapterLabel(chapterLabel || `Chương ${chapterId}`);
      });
  }, [chapterId, chapterLabel]);

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

  const handleFontChange = (e) => {
    const nextPercent = Number(e.target.value);
    const safePercent = Math.min(MAX_FONT_PERCENT, Math.max(MIN_FONT_PERCENT, nextPercent));
    const nextScale = safePercent / 100;

    setFontPercent(safePercent);
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
          <span>{displayChapterLabel}</span>
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
            className={`reading-header-icon-btn hide-mobile ${showFontSlider ? 'active' : ''}`}
            aria-label="Tùy chỉnh kiểu chữ"
            onClick={() => setShowFontSlider((prev) => !prev)}
            title={`Cỡ chữ: ${fontPercent}%`}
          >
            <FiType />
          </button>
          {showFontSlider && (
            <div className="reading-font-slider-panel">
              <div className="reading-font-slider-head">
                <span>Cỡ chữ</span>
                <span>{fontPercent}%</span>
              </div>
              <input
                type="range"
                min={MIN_FONT_PERCENT}
                max={MAX_FONT_PERCENT}
                step={5}
                value={fontPercent}
                onChange={handleFontChange}
                className="reading-font-slider"
                aria-label="Điều chỉnh cỡ chữ"
              />
            </div>
          )}
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
