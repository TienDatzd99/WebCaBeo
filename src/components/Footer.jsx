import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="footer">
    <div className="footer-inner">
      <div className="footer-brand">
        <Link to="/" className="footer-logo">🦈 Cá Mập</Link>
        <p className="footer-tagline">Kho truyện cập nhật liên tục, đọc truyện hoàn toàn miễn phí.</p>
      </div>
      <div className="footer-cols">
        <div className="footer-col">
          <h4>Hỗ trợ</h4>
          <Link to="#">Báo lỗi</Link>
          <Link to="#">FAQ</Link>
        </div>
        <div className="footer-col">
          <h4>Liên hệ</h4>
          <a href="https://www.facebook.com/profile.php?id=61586729744459" target="_blank" rel="noreferrer">Fanpage</a>
          <a href="https://www.youtube.com/@CaBeoAudio" target="_blank" rel="noreferrer">Youtube</a>
          <a href="https://www.tiktok.com/@cabeoaudio" target="_blank" rel="noreferrer">TikTok</a>
        </div>
        <div className="footer-col">
          <h4>Chính sách</h4>
          <Link to="#">Bản quyền</Link>
          <Link to="#">Điều khoản</Link>
        </div>
      </div>
    </div>
    <div className="footer-bar">
      <p>&copy; {new Date().getFullYear()} Cá Mập. Mọi quyền được bảo lưu.</p>
    </div>
  </footer>
);

export default Footer;
