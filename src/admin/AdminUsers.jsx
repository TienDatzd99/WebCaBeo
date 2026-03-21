import { useState, useEffect, useCallback } from 'react';
import { FiTrash2, FiKey, FiShield, FiX } from 'react-icons/fi';
import { getAdminUsers, updateUserRole, updateUserPwd, deleteUser } from '../api/admin.js';

export default function AdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  /* Modal: change password */
  const [pwdModal, setPwdModal] = useState(null);
  const [pwdVal,   setPwdVal]   = useState('');
  const [saving,   setSaving]   = useState(false);

  const LIMIT = 20;

  const load = useCallback(() => {
    setLoading(true);
    getAdminUsers({ page, limit: LIMIT, search })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const toggleRole = async (u) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Đặt role "${newRole}" cho ${u.username}?`)) return;
    await updateUserRole(u.id, newRole);
    load();
  };

  const savePwd = async () => {
    if (!pwdVal || pwdVal.length < 6) return alert('Mật khẩu tối thiểu 6 ký tự');
    setSaving(true);
    try {
      await updateUserPwd(pwdModal.id, pwdVal);
      setPwdModal(null);
      setPwdVal('');
    } finally { setSaving(false); }
  };

  const delUsr = async (u) => {
    if (!confirm(`Xóa tài khoản "${u.username}"? Hành động không thể hoàn tác!`)) return;
    await deleteUser(u.id);
    load();
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <h1 className="admin-page-title">👥 Quản lý Người dùng</h1>

      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="🔍 Tìm theo tên, email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <span style={{ fontSize:'0.82rem', color:'#6b7280' }}>Tổng: <b style={{ color:'#e5e7eb' }}>{total}</b></span>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Tên</th><th>Email</th>
                <th>Role</th><th>Yêu thích</th><th>Đánh giá</th>
                <th>Ngày đăng ký</th><th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#6b7280', padding:'2rem' }}>Đang tải...</td></tr>
                : users.map(u => (
                  <tr key={u.id}>
                    <td style={{ color:'#6b7280', fontSize:'0.78rem' }}>#{u.id}</td>
                    <td style={{ fontWeight:600 }}>{u.username}</td>
                    <td style={{ color:'#9ca3af', fontSize:'0.82rem' }}>{u.email}</td>
                    <td>
                      <span className={`status-badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ textAlign:'center', color:'#f87171' }}>{u.fav_count}</td>
                    <td style={{ textAlign:'center', color:'#fcd34d' }}>{u.rating_count}</td>
                    <td style={{ color:'#6b7280', fontSize:'0.78rem' }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        <button className="btn-sm btn-edit"   title="Đổi role" onClick={() => toggleRole(u)}><FiShield /></button>
                        <button className="btn-sm btn-view"   title="Đổi mật khẩu" onClick={() => { setPwdModal(u); setPwdVal(''); }}><FiKey /></button>
                        <button className="btn-sm btn-delete" title="Xóa" onClick={() => delUsr(u)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>‹</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = page <= 4 ? i + 1 : page - 3 + i;
              if (pg < 1 || pg > totalPages) return null;
              return <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>;
            })}
            <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
          </div>
        )}
      </div>

      {/* Password modal */}
      {pwdModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPwdModal(null)}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <h3>🔑 Đổi mật khẩu — {pwdModal.username}</h3>
              <button className="modal-close" onClick={() => setPwdModal(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Mật khẩu mới (tối thiểu 6 ký tự)</label>
                <input
                  className="form-input"
                  type="password"
                  value={pwdVal}
                  onChange={e => setPwdVal(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  onKeyDown={e => e.key === 'Enter' && savePwd()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-edit" onClick={() => setPwdModal(null)}>Hủy</button>
              <button className="btn-primary" onClick={savePwd} disabled={saving}>
                {saving ? '...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
