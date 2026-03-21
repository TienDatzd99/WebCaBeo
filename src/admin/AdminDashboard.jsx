import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBook, FiUsers, FiEye, FiStar, FiHeart, FiTrendingUp, FiList } from 'react-icons/fi';
import { getAdminStats } from '../api/admin.js';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats().then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#9ca3af', padding:'2rem' }}>Đang tải...</div>;

  const cards = [
    { label: 'Tổng truyện',   val: stats.totalComics,   icon: FiBook,      color: '#6366f1', link: '/admin/comics' },
    { label: 'Tổng chương',   val: stats.totalChapters, icon: FiList,      color: '#8b5cf6' },
    { label: 'Người dùng',    val: stats.totalUsers,    icon: FiUsers,     color: '#06b6d4', link: '/admin/users' },
    { label: 'Lượt xem',      val: fmtNum(stats.totalViews),  icon: FiEye,  color: '#10b981' },
    { label: 'Đánh giá',      val: stats.totalRatings,  icon: FiStar,      color: '#f59e0b' },
    { label: 'Yêu thích',     val: stats.totalFavs,     icon: FiHeart,     color: '#ef4444' },
  ];

  return (
    <div>
      <h1 className="admin-page-title">📊 Dashboard</h1>

      {/* Stat cards */}
      <div className="admin-stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="stat-label">{c.label}</div>
                <div className="stat-val">{c.val}</div>
              </div>
              <div style={{ width:42,height:42,borderRadius:10,background:`${c.color}22`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                <c.icon style={{ color:c.color, fontSize:'1.2rem' }} />
              </div>
            </div>
            {c.link && (
              <Link to={c.link} style={{ fontSize:'0.72rem', color:c.color, marginTop:'0.75rem', display:'block' }}>
                Xem chi tiết →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Two-col: top comics + recent */}
      <div className="admin-two-col">
        {/* Top Comics */}
        <div className="admin-card">
          <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'#e5e7eb', marginBottom:'1rem', display:'flex', alignItems:'center', gap:6 }}>
            <FiTrendingUp /> Top truyện nhiều lượt xem
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>#</th><th>Tiêu đề</th><th>Lượt xem</th></tr></thead>
              <tbody>
                {stats.topComics.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color:'#6366f1', fontWeight:700 }}>{i + 1}</td>
                    <td>
                      <Link to={`/comic/${c.id}`} style={{ color:'#e5e7eb' }} target="_blank">
                        {c.title}
                      </Link>
                    </td>
                    <td style={{ color:'#10b981' }}>{fmtNum(c.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Users */}
        <div className="admin-card">
          <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'#e5e7eb', marginBottom:'1rem', display:'flex', alignItems:'center', gap:6 }}>
            <FiUsers /> Người dùng mới nhất
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Tên</th><th>Email</th><th>Role</th></tr></thead>
              <tbody>
                {stats.recentUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight:600 }}>{u.username}</td>
                    <td style={{ color:'#9ca3af', fontSize:'0.8rem' }}>{u.email}</td>
                    <td>
                      <span className={`status-badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Comics */}
      <div className="admin-card" style={{ marginTop:'1.25rem' }}>
        <h3 style={{ fontSize:'0.9rem', fontWeight:700, color:'#e5e7eb', marginBottom:'1rem' }}>📚 Truyện mới thêm gần đây</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Tiêu đề</th><th>Tác giả</th><th>Trạng thái</th><th>Lượt xem</th><th>Ngày thêm</th></tr></thead>
            <tbody>
              {stats.recentComics.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight:600 }}>
                    <Link to={`/comic/${c.id}`} style={{ color:'#a5b4fc' }} target="_blank">{c.title}</Link>
                  </td>
                  <td style={{ color:'#9ca3af' }}>{c.author}</td>
                  <td>
                    <span className={`status-badge ${c.status === 'completed' ? 'badge-completed' : 'badge-ongoing'}`}>
                      {c.status === 'completed' ? 'Hoàn thành' : 'Đang ra'}
                    </span>
                  </td>
                  <td style={{ color:'#10b981' }}>{fmtNum(c.views)}</td>
                  <td style={{ color:'#6b7280', fontSize:'0.78rem' }}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n/1_000).toFixed(0) + 'K';
  return String(n);
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('vi-VN') : '—';
}
