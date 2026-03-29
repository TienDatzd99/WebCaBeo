import { useState, useEffect } from 'react';
import { getRandomAd } from '../api/ads.js';
import './AdGate.css';

const AdGate = ({ chapterNumber, onUnlock }) => {
  const [ad, setAd] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we should show ad for this chapter
    if (chapterNumber < 2) {
      // Chapter 1 is free
      setLoading(false);
      return;
    }

    // Check if user already viewed ad today
    const adGateKey = `adGate_${chapterNumber}_${getDateKey()}`;
    const alreadyViewed = localStorage.getItem(adGateKey);

    if (alreadyViewed) {
      // User already clicked ad today, don't show again
      setLoading(false);
      onUnlock?.();
      return;
    }

    // Fetch ad from backend
    fetchAd();
  }, [chapterNumber, onUnlock]);

  const fetchAd = async () => {
    try {
      const response = await getRandomAd();
      const data = response.data;
      
      if (data?.id) {
        setAd(data);
        setIsVisible(true);
      } else {
        // No ad available, allow access
        onUnlock?.();
      }
    } catch (err) {
      console.error('Failed to fetch ad:', err);
      // On error, allow access
      onUnlock?.();
    } finally {
      setLoading(false);
    }
  };

  const handleAdClick = () => {
    // Mark as clicked for today
    const adGateKey = `adGate_${chapterNumber}_${getDateKey()}`;
    localStorage.setItem(adGateKey, 'true');

    // Open affiliate link in new tab
    if (ad?.link_url) {
      window.open(ad.link_url, '_blank');
    }

    // Close modal and unlock content
    setIsVisible(false);
    onUnlock?.();
  };

  const handleClose = () => {
    // Optionally allow closing without clicking
    // For strict monetization, remove this and force click
    setIsVisible(false);
    onUnlock?.();
  };

  // Get today's date key for localStorage (YYYY-MM-DD)
  const getDateKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  // Don't render anything if loading or for chapter 1
  if (loading || !isVisible || !ad) {
    return null;
  }

  return (
    <div className="ad-gate-overlay">
      <div className="ad-gate-modal">
        <div className="ad-gate-content">
          <h3 className="ad-gate-title">{ad.title}</h3>
          
          <div className="ad-gate-image-container">
            <img 
              src={ad.image_url} 
              alt="Advertisement"
              className="ad-gate-image"
            />
          </div>

          <p className="ad-gate-message">
            Nhấp vào liên kết bên dưới để mở khóa chương này. Cảm ơn bạn đã hỗ trợ chúng tôi!
          </p>

          <p className="ad-gate-notice">
            ⏬ Lưu ý: Liên kết này chỉ xuất hiện 1 lần trong ngày, mong bạn thông cảm.
          </p>

          <button 
            className="ad-gate-btn-unlock"
            onClick={handleAdClick}
          >
            ✓ CLICK ĐỂ MỞ KHÓA CHƯƠNG
          </button>

          <button 
            className="ad-gate-btn-close"
            onClick={handleClose}
            title="Đóng (nội dung có thể vẫn hiển thị)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdGate;
