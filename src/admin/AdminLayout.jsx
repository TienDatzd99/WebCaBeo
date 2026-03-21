import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  FiGrid, FiBook, FiUsers, FiTag, FiLogOut,
  FiHome, FiChevronRight
} from 'react-icons/fi';
import './Admin.css';

const NAV = [
  { to: '/admin',          icon: FiGrid,  label: 'Dashboard', end: true },
  { to: '/admin/comics',   icon: FiBook,  label: 'Truyện' },
  { to: '/admin/users',    icon: FiUsers, label: 'Người dùng' },
  { to: '/admin/genres',   icon: FiTag,   label: 'Thể loại' },
];

export default function AdminLayout() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-denied">
        <h2>⛔ Bạn không có quyền truy cập trang này</h2>
        <button onClick={() => navigate('/')}>Về trang chủ</button>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-shark">🦈</span>
          <span>Admin Panel</span>
        </div>

        <nav className="admin-nav">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="anl-icon" />
              <span>{label}</span>
              <FiChevronRight className="anl-arrow" />
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <NavLink to="/" className="admin-nav-link">
            <FiHome className="anl-icon" />
            <span>Trang chủ</span>
          </NavLink>
          <button className="admin-nav-link danger" onClick={() => { logoutUser(); navigate('/login'); }}>
            <FiLogOut className="anl-icon" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="admin-content">
        <div className="admin-topbar">
          <div className="admin-breadcrumb" id="admin-breadcrumb" />
          <div className="admin-user-info">
            <div className="admin-avatar">{user.username[0].toUpperCase()}</div>
            <span>{user.username}</span>
            <span className="admin-role-badge">Admin</span>
          </div>
        </div>
        <div className="admin-page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
