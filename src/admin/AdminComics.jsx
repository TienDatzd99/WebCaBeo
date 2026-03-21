import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiList, FiX, FiSearch } from 'react-icons/fi';
import {
  getAdminComics, createComic, updateComic, deleteComic,
  getAdminChapters, createChapter, updateChapter, deleteChapter,
  getAdminGenres
} from '../api/admin.js';

const EMPTY_COMIC = { title:'', author:'', description:'', cover_url:'', status:'ongoing', genre_ids:[] };
const EMPTY_CHAP  = { number:'', title:'' };
const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Đang ra', badge: 'badge-ongoing' },
  { value: 'completed', label: 'Hoàn thành', badge: 'badge-completed' },
  { value: 'hiatus', label: 'Tạm ngưng', badge: 'badge-hiatus' },
];

const getStatusMeta = (status) =>
  STATUS_OPTIONS.find((opt) => opt.value === status) || STATUS_OPTIONS[0];

export default function AdminComics() {
  const [comics,   setComics]   = useState([]);
  const [genres,   setGenres]   = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);

  /* Modals */
  const [comicModal, setComicModal] = useState(null); // null | 'create' | comic-obj
  const [chapModal,  setChapModal]  = useState(null); // null | comic-obj
  const [chapters,   setChapters]   = useState([]);
  const [editChap,   setEditChap]   = useState(null);
  const [form,       setForm]       = useState(EMPTY_COMIC);
  const [chapForm,   setChapForm]   = useState(EMPTY_CHAP);
  const [saving,     setSaving]     = useState(false);

  const LIMIT = 15;

  const load = useCallback(() => {
    setLoading(true);
    getAdminComics({ page, limit: LIMIT, search })
      .then(r => { setComics(r.data.comics); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAdminGenres().then(r => setGenres(r.data)); }, []);

  /* Comic form */
  const openCreate = () => { setForm(EMPTY_COMIC); setComicModal('create'); };
  const openEdit   = (c) => {
    setForm({ ...c, genre_ids: (c.genre_names || '').split(',').map(g => genres.find(x => x.name === g.trim())?.id).filter(Boolean) });
    setComicModal(c);
  };
  const saveComic = async () => {
    setSaving(true);
    try {
      if (comicModal === 'create') await createComic(form);
      else await updateComic(comicModal.id, form);
      setComicModal(null);
      load();
    } finally { setSaving(false); }
  };
  const delComic = async (id) => {
    if (!confirm('Xóa truyện này?')) return;
    await deleteComic(id);
    load();
  };

  const toggleGenre = (id) => setForm(f => ({
    ...f,
    genre_ids: f.genre_ids.includes(id) ? f.genre_ids.filter(x => x !== id) : [...f.genre_ids, id]
  }));

  /* Chapter modal */
  const openChaps = async (comic) => {
    setChapModal(comic);
    setChapForm(EMPTY_CHAP);
    setEditChap(null);
    const r = await getAdminChapters(comic.id);
    setChapters(r.data);
  };
  const saveChap = async () => {
    setSaving(true);
    try {
      if (editChap) await updateChapter(editChap.id, chapForm);
      else await createChapter(chapModal.id, chapForm);
      setChapForm(EMPTY_CHAP); setEditChap(null);
      const r = await getAdminChapters(chapModal.id);
      setChapters(r.data);
    } finally { setSaving(false); }
  };
  const delChap = async (id) => {
    if (!confirm('Xóa chương này?')) return;
    await deleteChapter(id);
    const r = await getAdminChapters(chapModal.id);
    setChapters(r.data);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <h1 className="admin-page-title">📚 Quản lý Truyện</h1>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <input
          className="admin-search"
          placeholder="🔍 Tìm theo tên, tác giả..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <button className="btn-primary" onClick={openCreate}><FiPlus /> Thêm truyện</button>
      </div>

      {/* Table */}
      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bìa</th><th>Tiêu đề</th><th>Tác giả</th>
                <th>Thể loại</th><th>Chương</th><th>Trạng thái</th>
                <th>Lượt xem</th><th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#6b7280', padding:'2rem' }}>Đang tải...</td></tr>
                : comics.map(c => (
                  <tr key={c.id}>
                    <td>
                      {c.cover_url
                        ? <img src={c.cover_url} alt="" className="cover-thumb" />
                        : <div className="cover-thumb" />}
                    </td>
                    <td style={{ fontWeight:600, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {c.title}
                    </td>
                    <td style={{ color:'#9ca3af' }}>{c.author}</td>
                    <td style={{ fontSize:'0.75rem', color:'#6b7280', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {c.genre_names || '—'}
                    </td>
                    <td style={{ textAlign:'center', color:'#a5b4fc' }}>{c.chapter_count}</td>
                    <td>
                      <span className={`status-badge ${getStatusMeta(c.status).badge}`}>
                        {getStatusMeta(c.status).label}
                      </span>
                    </td>
                    <td style={{ color:'#10b981' }}>{c.views?.toLocaleString()}</td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn-sm btn-view" onClick={() => openChaps(c)}><FiList /></button>
                        <button className="btn-sm btn-edit" onClick={() => openEdit(c)}><FiEdit2 /></button>
                        <button className="btn-sm btn-delete" onClick={() => delComic(c.id)}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button className="page-btn" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>‹</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = page <= 4 ? i + 1 : page - 3 + i;
              if (pg < 1 || pg > totalPages) return null;
              return <button key={pg} className={`page-btn ${pg === page ? 'active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>;
            })}
            <button className="page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
            <span style={{ fontSize:'0.78rem', color:'#6b7280', marginLeft:'0.5rem' }}>/ {total} truyện</span>
          </div>
        )}
      </div>

      {/* ── Comic Modal ── */}
      {comicModal !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setComicModal(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <h3>{comicModal === 'create' ? '➕ Thêm truyện mới' : '✏️ Sửa truyện'}</h3>
              <button className="modal-close" onClick={() => setComicModal(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tiêu đề *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} placeholder="Tên truyện"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Tác giả *</label>
                  <input className="form-input" value={form.author} onChange={e => setForm(f => ({...f,author:e.target.value}))} placeholder="Tên tác giả"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">URL ảnh bìa</label>
                <input className="form-input" value={form.cover_url} onChange={e => setForm(f => ({...f,cover_url:e.target.value}))} placeholder="https://..."/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trạng thái</label>
                  <select className="form-select" value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value}))}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Thể loại</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                  {genres.map(g => (
                    <button key={g.id} onClick={() => toggleGenre(g.id)}
                      style={{
                        padding:'0.25rem 0.65rem', borderRadius:20, fontSize:'0.78rem',
                        cursor:'pointer', border:'1px solid',
                        background: form.genre_ids.includes(g.id) ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                        color:       form.genre_ids.includes(g.id) ? '#a5b4fc' : '#6b7280',
                        borderColor: form.genre_ids.includes(g.id) ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                      }}>
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="Tóm tắt nội dung..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-edit" onClick={() => setComicModal(null)}>Hủy</button>
              <button className="btn-primary" onClick={saveComic} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chapter Modal ── */}
      {chapModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setChapModal(null)}>
          <div className="modal-box" style={{ maxWidth:700 }}>
            <div className="modal-header">
              <h3>📋 Chương — {chapModal.title}</h3>
              <button className="modal-close" onClick={() => setChapModal(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              {/* Add/Edit chapter form */}
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'0.9rem', marginBottom:'1rem' }}>
                <div style={{ fontWeight:600, fontSize:'0.82rem', color:'#a5b4fc', marginBottom:'0.6rem' }}>
                  {editChap ? '✏️ Sửa chương' : '➕ Thêm chương mới'}
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Số chương *</label>
                    <input className="form-input" type="number" value={chapForm.number}
                      onChange={e => setChapForm(f => ({...f,number:e.target.value}))} placeholder="1" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label className="form-label">Tiêu đề</label>
                    <input className="form-input" value={chapForm.title}
                      onChange={e => setChapForm(f => ({...f,title:e.target.value}))} placeholder="Tuỳ chọn" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, marginTop:'0.75rem' }}>
                  <button className="btn-primary" onClick={saveChap} disabled={saving} style={{ fontSize:'0.8rem', padding:'0.4rem 0.9rem' }}>
                    {saving ? '...' : editChap ? 'Cập nhật' : 'Thêm'}
                  </button>
                  {editChap && <button className="btn-sm btn-edit" onClick={() => { setEditChap(null); setChapForm(EMPTY_CHAP); }}>Hủy</button>}
                </div>
              </div>

              {/* Chapter list */}
              <div className="admin-table-wrap" style={{ maxHeight:340, overflowY:'auto' }}>
                <table className="admin-table">
                  <thead><tr><th>Số</th><th>Tiêu đề</th><th>Lượt xem</th><th>Ngày thêm</th><th></th></tr></thead>
                  <tbody>
                    {chapters.map(ch => (
                      <tr key={ch.id}>
                        <td style={{ color:'#a5b4fc', fontWeight:700 }}>Ch.{ch.number}</td>
                        <td>{ch.title}</td>
                        <td style={{ color:'#10b981' }}>{ch.views?.toLocaleString()}</td>
                        <td style={{ color:'#6b7280', fontSize:'0.75rem' }}>{new Date(ch.created_at).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn-sm btn-edit" onClick={() => { setEditChap(ch); setChapForm({ number: ch.number, title: ch.title }); }}><FiEdit2 /></button>
                            <button className="btn-sm btn-delete" onClick={() => delChap(ch.id)}><FiTrash2 /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {chapters.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign:'center', color:'#6b7280', padding:'1.5rem' }}>Chưa có chương nào</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
