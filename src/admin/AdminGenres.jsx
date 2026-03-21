import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { getAdminGenres, createGenre, deleteGenre } from '../api/admin.js';

export default function AdminGenres() {
  const [genres,  setGenres]  = useState([]);
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const load = () => getAdminGenres().then(r => setGenres(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try { await createGenre(n); setName(''); load(); }
    finally { setSaving(false); }
  };

  const del = async (id, nm) => {
    if (!confirm(`Xóa thể loại "${nm}"?`)) return;
    await deleteGenre(id);
    load();
  };

  return (
    <div>
      <h1 className="admin-page-title">🏷️ Quản lý Thể loại</h1>

      {/* Add form */}
      <div className="admin-card" style={{ marginBottom:'1.25rem' }}>
        <div style={{ fontWeight:600, fontSize:'0.88rem', color:'#a5b4fc', marginBottom:'0.9rem' }}>Thêm thể loại mới</div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            className="admin-search"
            placeholder="Tên thể loại..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            style={{ maxWidth:320 }}
          />
          <button className="btn-primary" onClick={add} disabled={saving || !name.trim()}>
            <FiPlus /> Thêm
          </button>
        </div>
      </div>

      {/* Genre list */}
      <div className="admin-card">
        {loading ? (
          <p style={{ color:'#6b7280' }}>Đang tải...</p>
        ) : (
          <>
            <div style={{ fontSize:'0.78rem', color:'#6b7280', marginBottom:'0.9rem' }}>
              Tổng cộng <b style={{ color:'#e5e7eb' }}>{genres.length}</b> thể loại
            </div>
            <div className="genre-list">
              {genres.map(g => (
                <div key={g.id} className="genre-pill">
                  <span>{g.name}</span>
                  <button onClick={() => del(g.id, g.name)} title="Xóa"><FiX /></button>
                </div>
              ))}
              {genres.length === 0 && <p style={{ color:'#6b7280' }}>Chưa có thể loại nào</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
