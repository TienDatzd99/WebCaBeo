import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiList, FiX, FiSearch } from 'react-icons/fi';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  getAdminComics, createComic, updateComic, deleteComic,
  getAdminChapters, createChapter, updateChapter, deleteChapter,
  getAdminGenres
} from '../api/admin.js';

const EMPTY_COMIC = {
  title:'', author:'', translator:'', description:'', cover_url:'', audio_url:'', status:'ongoing', genre_ids:[],
  initial_chapters: []
};
const EMPTY_CHAP  = { number:'', title:'', content:'' };
const EMPTY_INITIAL_CHAP = { number:'', title:'', content:'' };
const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'Đang ra', badge: 'badge-ongoing' },
  { value: 'completed', label: 'Hoàn thành', badge: 'badge-completed' },
  { value: 'hiatus', label: 'Tạm ngưng', badge: 'badge-hiatus' },
];
const ASPECT_OPTIONS = [
  { id: '2:3', label: '2:3 (dọc)', width: 2, height: 3 },
  { id: '16:9', label: '16:9', width: 16, height: 9 },
  { id: '16:10', label: '16:10', width: 16, height: 10 },
  { id: '4:5', label: '4:5', width: 4, height: 5 },
  { id: '1:1', label: '1:1', width: 1, height: 1 },
];

const createCenteredCrop = (mediaWidth, mediaHeight, aspect) =>
  centerCrop(
    makeAspectCrop(
      { unit: '%', width: 80 },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );

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
  const [newInitChap, setNewInitChap] = useState(EMPTY_INITIAL_CHAP);
  const [saving,     setSaving]     = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [cropImageLabel, setCropImageLabel] = useState('');
  const [cropRect, setCropRect] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [cropAspect, setCropAspect] = useState(ASPECT_OPTIONS[0].id);
  const [cropLoading, setCropLoading] = useState(false);
  const [cropError, setCropError] = useState('');
  const visibleCoverInputRef = useRef(null);
  const cropImageRef = useRef(null);

  const LIMIT = 15;
  const selectedAspect = useMemo(
    () => ASPECT_OPTIONS.find((option) => option.id === cropAspect) || ASPECT_OPTIONS[0],
    [cropAspect]
  );

  const selectedAspectRatio = useMemo(
    () => selectedAspect.width / selectedAspect.height,
    [selectedAspect]
  );

  const load = useCallback(() => {
    setLoading(true);
    getAdminComics({ page, limit: LIMIT, search })
      .then(r => { setComics(r.data.comics); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAdminGenres().then(r => setGenres(r.data)); }, []);

  /* Comic form */
  const openCreate = () => {
    setForm(EMPTY_COMIC);
    setNewInitChap(EMPTY_INITIAL_CHAP);
    setComicModal('create');
  };
  const openEdit   = (c) => {
    setForm({
      ...c,
      genre_ids: (c.genre_names || '').split(',').map(g => genres.find(x => x.name === g.trim())?.id).filter(Boolean),
      initial_chapters: []
    });
    setComicModal(c);
  };
  const saveComic = async () => {
    setSaving(true);
    try {
      if (comicModal === 'create') {
        const normalizedAuthor = (form.author || '').trim();
        const normalizedTranslator = (form.translator || '').trim();
        const fallbackAuthor = normalizedAuthor || normalizedTranslator || ' ';
        const payload = {
          ...form,
          author: fallbackAuthor,
          translator: normalizedTranslator,
          chapters: (form.initial_chapters || [])
            .map((ch) => ({
              number: Number(ch.number),
              title: (ch.title || '').trim(),
              content: (ch.content || '').trim(),
            }))
            .filter((ch) => Number.isFinite(ch.number)),
        };
        try {
          await createComic(payload);
        } catch (error) {
          // Backward-compat: old backend may still require author.
          const apiError = error?.response?.data?.error || '';
          if (typeof apiError === 'string' && apiError.toLowerCase().includes('title and author required')) {
            await createComic({
              ...payload,
              author: normalizedAuthor || normalizedTranslator || ' ',
            });
          } else {
            throw error;
          }
        }
      }
      else {
        const normalizedAuthor = (form.author || '').trim();
        const normalizedTranslator = (form.translator || '').trim();
        await updateComic(comicModal.id, {
          ...form,
          author: normalizedAuthor || normalizedTranslator || ' ',
          translator: normalizedTranslator,
        });
      }
      setComicModal(null);
      load();
    } catch (error) {
      const message = error?.response?.data?.error || 'Không thể lưu truyện. Vui lòng thử lại.';
      alert(message);
    } finally { setSaving(false); }
  };

  const addInitialChapter = () => {
    const number = Number(newInitChap.number);
    if (!Number.isFinite(number)) return;

    setForm((f) => ({
      ...f,
      initial_chapters: [
        ...(f.initial_chapters || []).filter((ch) => Number(ch.number) !== number),
        {
          number,
          title: (newInitChap.title || '').trim(),
          content: (newInitChap.content || '').trim(),
        }
      ].sort((a, b) => Number(a.number) - Number(b.number))
    }));
    setNewInitChap(EMPTY_INITIAL_CHAP);
  };

  const removeInitialChapter = (number) => {
    setForm((f) => ({
      ...f,
      initial_chapters: (f.initial_chapters || []).filter((ch) => Number(ch.number) !== Number(number))
    }));
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

  const resetCropperState = useCallback(() => {
    setCropImageSrc('');
    setCropImageLabel('');
    setCropRect(undefined);
    setCompletedCrop(null);
    setCropAspect(ASPECT_OPTIONS[0].id);
    setCropLoading(false);
    setCropError('');
  }, []);

  const openCropper = async () => {
    setCropModalOpen(true);
    setCropError('');

    const currentCover = (form.cover_url || '').trim();
    if (!currentCover) {
      resetCropperState();
      return;
    }

    await loadCropImage(currentCover, 'Ảnh bìa hiện tại');
  };

  const loadCropImage = useCallback(async (source, label) => {
    setCropLoading(true);
    setCropError('');
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        if (typeof source === 'string' && /^https?:\/\//i.test(source)) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Không tải được ảnh'));
        img.src = source;
      });
      setCropImageSrc(source);
      setCropImageLabel(label || 'Ảnh mới');
      setCropRect(undefined);
      setCompletedCrop(null);
    } catch {
      setCropError('Không thể tải ảnh để cắt. Hãy thử tải ảnh từ máy để ổn định hơn.');
    } finally {
      setCropLoading(false);
    }
  }, []);

  const onPickCoverFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCropModalOpen(true);
    setCropError('');
    const reader = new FileReader();
    reader.onload = async () => {
      const source = String(reader.result || '');
      if (!source) return;
      // Show selected image on form immediately, then allow optional crop refinement.
      setForm((f) => ({ ...f, cover_url: source }));
      await loadCropImage(source, file.name);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const onLoadCoverFromUrl = async () => {
    const url = (form.cover_url || '').trim();
    if (!url) {
      setCropError('Bạn chưa nhập URL ảnh bìa.');
      return;
    }
    await loadCropImage(url, 'Ảnh từ URL');
  };

  const applyCroppedCover = () => {
    if (!completedCrop || !cropImageRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const image = cropImageRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const sourceX = Math.max(0, Math.floor(completedCrop.x * scaleX));
      const sourceY = Math.max(0, Math.floor(completedCrop.y * scaleY));
      const sourceWidth = Math.max(1, Math.floor(completedCrop.width * scaleX));
      const sourceHeight = Math.max(1, Math.floor(completedCrop.height * scaleY));

      const MAX_OUTPUT_SIDE = 1600;
      const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(sourceWidth, sourceHeight));
      const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
      const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight
      );

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.86);
      setForm((f) => ({ ...f, cover_url: croppedDataUrl }));
      setCropModalOpen(false);
      resetCropperState();
    } catch {
      setCropError('Không thể xuất ảnh từ URL này do chặn CORS. Hãy dùng nút tải ảnh từ máy.');
    }
  };

  useEffect(() => {
    const image = cropImageRef.current;
    if (!cropImageSrc || !image) return;
    setCropRect(createCenteredCrop(image.naturalWidth || image.width, image.naturalHeight || image.height, selectedAspectRatio));
    setCompletedCrop(null);
  }, [cropAspect, cropImageSrc, selectedAspectRatio]);

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
                  <label className="form-label">Dịch giả</label>
                  <input className="form-input" value={form.translator || ''} onChange={e => setForm(f => ({...f,translator:e.target.value}))} placeholder="Tên dịch giả"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tác giả (tuỳ chọn)</label>
                <input className="form-input" value={form.author || ''} onChange={e => setForm(f => ({...f,author:e.target.value}))} placeholder="Tên tác giả (có thể để trống)"/>
              </div>
              <div className="form-group">
                <label className="form-label">URL ảnh bìa</label>
                <input className="form-input" value={form.cover_url} onChange={e => setForm(f => ({...f,cover_url:e.target.value}))} placeholder="https://..."/>
                <div className="cover-upload-row">
                  <label className="cover-upload-btn" htmlFor="cover-upload-input">
                    Upload ảnh từ máy
                  </label>
                  <input
                    ref={visibleCoverInputRef}
                    id="cover-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={onPickCoverFile}
                  />
                </div>
                {!!form.cover_url && (
                  <div className="cover-form-preview">
                    <img src={form.cover_url} alt="Preview ảnh bìa" className="cover-form-preview-img" />
                    <span className="cover-tools-help">Preview ảnh bìa hiện tại trong form.</span>
                  </div>
                )}
                <div className="cover-tools">
                  <button
                    type="button"
                    className="btn-sm btn-view"
                    onClick={openCropper}
                  >
                    Mở khung cắt ảnh
                  </button>
                  <button
                    type="button"
                    className="btn-sm btn-edit"
                    onClick={() => {
                      openCropper();
                      onLoadCoverFromUrl();
                    }}
                    disabled={cropLoading}
                  >
                    Lấy vùng từ URL hiện tại
                  </button>
                  <span className="cover-tools-help">Ảnh sẽ cắt theo khung bìa dọc 2:3.</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Link audio</label>
                <input className="form-input" value={form.audio_url || ''} onChange={e => setForm(f => ({...f,audio_url:e.target.value}))} placeholder="https://..."/>
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
                    <button type="button" key={g.id} onClick={() => toggleGenre(g.id)}
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

              {comicModal === 'create' && (
                <div className="form-group">
                  <label className="form-label">Nội dung theo chương (tuỳ chọn)</label>
                  <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'0.8rem' }}>
                    <div className="form-row">
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Số chương *</label>
                        <input
                          className="form-input"
                          type="number"
                          value={newInitChap.number}
                          onChange={e => setNewInitChap((v) => ({ ...v, number: e.target.value }))}
                          placeholder="1"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom:0 }}>
                        <label className="form-label">Tiêu đề chương</label>
                        <input
                          className="form-input"
                          value={newInitChap.title}
                          onChange={e => setNewInitChap((v) => ({ ...v, title: e.target.value }))}
                          placeholder="Mở đầu"
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginTop:'0.75rem', marginBottom:'0.75rem' }}>
                      <label className="form-label">Nội dung chương</label>
                      <textarea
                        className="form-textarea"
                        value={newInitChap.content}
                        onChange={e => setNewInitChap((v) => ({ ...v, content: e.target.value }))}
                        placeholder="Nhập nội dung truyện ngắn cho chương này..."
                        style={{ minHeight: 130 }}
                      />
                    </div>
                    <button type="button" className="btn-primary" onClick={addInitialChapter}>
                      <FiPlus /> Thêm vào danh sách chương
                    </button>

                    <div style={{ marginTop:'0.8rem', display:'grid', gap:'0.45rem' }}>
                      {(form.initial_chapters || []).length === 0 && (
                        <div style={{ color:'#6b7280', fontSize:'0.78rem' }}>Chưa thêm chương nào. Bạn vẫn có thể tạo truyện trước rồi thêm chương sau.</div>
                      )}
                      {(form.initial_chapters || []).map((ch) => (
                        <div key={ch.number} style={{ display:'flex', justifyContent:'space-between', gap:'0.6rem', alignItems:'center', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'0.5rem 0.65rem' }}>
                          <div>
                            <div style={{ fontSize:'0.82rem', color:'#a5b4fc', fontWeight:600 }}>Ch.{ch.number} {ch.title ? `- ${ch.title}` : ''}</div>
                            <div style={{ fontSize:'0.75rem', color:'#9ca3af' }}>{ch.content ? `${ch.content.length} ký tự nội dung` : 'Chưa có nội dung text'}</div>
                          </div>
                          <button type="button" className="btn-sm btn-delete" onClick={() => removeInitialChapter(ch.number)}>
                            <FiTrash2 /> Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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

      {cropModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && setCropModalOpen(false)}>
          <div className="modal-box cover-crop-modal">
            <div className="modal-header">
              <h3>🖼️ Lấy vùng ảnh bìa</h3>
              <button className="modal-close" onClick={() => setCropModalOpen(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="cover-crop-grid">
                <div className="cover-crop-preview-wrap">
                    {cropImageSrc ? (
                      <ReactCrop
                        crop={cropRect}
                        onChange={(pixelCrop, percentCrop) => setCropRect(percentCrop)}
                        onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                        aspect={selectedAspectRatio}
                        minWidth={90}
                        ruleOfThirds
                      >
                        <img
                          ref={cropImageRef}
                          src={cropImageSrc}
                          alt="Crop"
                          className="cover-crop-image"
                          onLoad={(event) => {
                            const { naturalWidth, naturalHeight } = event.currentTarget;
                            setCropRect(createCenteredCrop(naturalWidth, naturalHeight, selectedAspectRatio));
                          }}
                        />
                      </ReactCrop>
                    ) : (
                      <div className="cover-crop-empty">Chọn ảnh để bắt đầu kéo khung cắt.</div>
                    )}
                </div>

                <div className="cover-crop-controls">
                  <div className="cover-crop-source">Nguồn: {cropImageLabel || 'Chưa chọn ảnh'}</div>

                  <button type="button" className="btn-sm btn-view" onClick={() => visibleCoverInputRef.current?.click()}>
                    Chọn ảnh khác từ máy
                  </button>

                  <div className="cover-crop-control">
                    <label className="form-label">Tỉ lệ khung</label>
                    <div className="aspect-buttons">
                      {ASPECT_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`aspect-btn ${cropAspect === option.id ? 'active' : ''}`}
                          onClick={() => setCropAspect(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cover-crop-note">Kéo cả khung để di chuyển và kéo các góc để đổi vùng cắt.</div>

                  {cropLoading && <div className="cover-crop-note">Đang tải ảnh...</div>}
                  {cropError && <div className="cover-crop-error">{cropError}</div>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-edit" onClick={() => setCropModalOpen(false)}>Hủy</button>
              <button className="btn-primary" onClick={applyCroppedCover} disabled={!completedCrop || cropLoading}>
                Dùng ảnh đã cắt
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
                <div className="form-group" style={{ marginTop:'0.75rem', marginBottom:0 }}>
                  <label className="form-label">Nội dung chương (truyện chữ)</label>
                  <textarea
                    className="form-textarea"
                    value={chapForm.content}
                    onChange={e => setChapForm(f => ({...f,content:e.target.value}))}
                    placeholder="Nhập nội dung text cho chương này..."
                    style={{ minHeight: 140 }}
                  />
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
                  <thead><tr><th>Số</th><th>Tiêu đề</th><th>Nội dung</th><th>Lượt xem</th><th>Ngày thêm</th><th></th></tr></thead>
                  <tbody>
                    {chapters.map(ch => (
                      <tr key={ch.id}>
                        <td style={{ color:'#a5b4fc', fontWeight:700 }}>Ch.{ch.number}</td>
                        <td>{ch.title}</td>
                        <td style={{ color: ch.content ? '#34d399' : '#6b7280', fontSize:'0.78rem' }}>
                          {ch.content ? `Có text (${ch.content.length} ký tự)` : 'Không có'}
                        </td>
                        <td style={{ color:'#10b981' }}>{ch.views?.toLocaleString()}</td>
                        <td style={{ color:'#6b7280', fontSize:'0.75rem' }}>{new Date(ch.created_at).toLocaleDateString('vi-VN')}</td>
                        <td>
                          <div style={{ display:'flex', gap:4 }}>
                            <button className="btn-sm btn-edit" onClick={() => { setEditChap(ch); setChapForm({ number: ch.number, title: ch.title, content: ch.content || '' }); }}><FiEdit2 /></button>
                            <button className="btn-sm btn-delete" onClick={() => delChap(ch.id)}><FiTrash2 /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {chapters.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign:'center', color:'#6b7280', padding:'1.5rem' }}>Chưa có chương nào</td></tr>
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
