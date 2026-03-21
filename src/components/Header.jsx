import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiLogOut, FiHeart, FiBook, FiSun, FiMoon, FiMenu, FiX, FiChevronDown } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext.jsx';
import './Header.css';

const GENRES = ['Hiện Đại', 'Ngôn Tình', 'Truyện Dịch', 'Xuyên Không', 'Hài Hước', 'Hệ Thống', 'Ngắn'];

const Header = () => {
  const { user, logoutUser } = useAuth();
  const [search,         setSearch]         = useState('');
  const [dropOpen,       setDropOpen]       = useState(false);
  const [genreOpen,      setGenreOpen]      = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme,          setTheme]          = useState('dark');
  const navigate  = useNavigate();
  const dropRef   = useRef(null);
  const genreRef  = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current  && !dropRef.current.contains(e.target))  setDropOpen(false);
      if (genreRef.current && !genreRef.current.contains(e.target)) setGenreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/tim-kiem?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header className="header">
      <div className="header-inner">
        {/* Logo */}
        <Link to="/" className="logo">
          <span className="logo-shark">🦈</span>
          <span className="logo-text">Cá Mập</span>
        </Link>

        {/* Desktop nav — matches camap.site header links */}
        <nav className="header-nav">
          {/* Thể Loại dropdown */}
          <div className="nav-drop-wrap" ref={genreRef}>
            <button className="nav-link nav-drop-btn" onClick={() => setGenreOpen(o => !o)}>
              Thể Loại <FiChevronDown className={`nav-chevron ${genreOpen ? 'open' : ''}`} />
            </button>
            {genreOpen && (
              <div className="nav-drop-menu">
                {GENRES.map(g => (
                  <Link key={g} to={`/the-loai/${g.toLowerCase().replace(/\s+/g, '-')}`}
                    className="nav-drop-item" onClick={() => setGenreOpen(false)}>
                    {g}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link to="/truyen-ngan"  className="nav-link">Truyện Ngắn</Link>
          <Link to="/truyen-dai"   className="nav-link">Truyện Dài</Link>
          <Link to="/team"         className="nav-link">Team</Link>
          <Link to="/fanpage"      className="nav-link">Fanpage</Link>
          <Link to="/youtube"      className="nav-link">Youtube</Link>
        </nav>

        {/* Right cluster */}
        <div className="header-right">
          {/* Search */}
          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm theo tên, tác giả..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="search-submit"><FiSearch /></button>
          </form>

          {/* Theme toggle */}
          <button className="theme-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Đổi giao diện">
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>

          {user ? (
            <>
              {/* Library link — "Thư viện của tôi" */}
              <Link to="/thu-vien" className="library-link">
                <FiBook className="lib-icon" /> Thư viện của tôi
              </Link>

              {/* Avatar dropdown */}
              <div className="user-drop" ref={dropRef}>
                <button className="user-trigger" onClick={() => setDropOpen(o => !o)}>
                  <div className="avatar-circle">{user.username[0].toUpperCase()}</div>
                </button>
                {dropOpen && (
                  <div className="drop-menu">
                    <Link to="/yeu-thich"  className="drop-link" onClick={() => setDropOpen(false)}><FiHeart /> Yêu thích</Link>
                    <Link to="/lich-su"    className="drop-link" onClick={() => setDropOpen(false)}><FiUser /> Lịch sử đọc</Link>
                    <div className="drop-sep" />
                    <button className="drop-link danger" onClick={() => { logoutUser(); setDropOpen(false); }}><FiLogOut /> Đăng xuất</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" className="btn-login">Đăng nhập</Link>
          )}

          {/* Hamburger */}
          <button className="hamburger" onClick={() => setMobileMenuOpen(o => !o)}>
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="mobile-nav">
          <form onSubmit={handleSearch} className="mobile-search">
            <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit"><FiSearch /></button>
          </form>
          <Link to="/"            className="mob-link" onClick={() => setMobileMenuOpen(false)}>Trang Chủ</Link>
          <Link to="/the-loai"    className="mob-link" onClick={() => setMobileMenuOpen(false)}>Thể Loại</Link>
          <Link to="/truyen-ngan" className="mob-link" onClick={() => setMobileMenuOpen(false)}>Truyện Ngắn</Link>
          <Link to="/truyen-dai"  className="mob-link" onClick={() => setMobileMenuOpen(false)}>Truyện Dài</Link>
          {!user ? (
            <Link to="/login" className="mob-link accent" onClick={() => setMobileMenuOpen(false)}>Đăng nhập</Link>
          ) : (
            <button className="mob-link danger" onClick={() => { logoutUser(); setMobileMenuOpen(false); }}>Đăng xuất</button>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
