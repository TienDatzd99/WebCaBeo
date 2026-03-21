import { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiSave, FiSearch } from 'react-icons/fi';
import { createSlider, deleteSlider, getAdminComics, getAdminSliders, updateSlider } from '../api/admin.js';

export default function AdminSliders() {
  const [sliders, setSliders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const sliderComicIds = useMemo(() => new Set(sliders.map((s) => s.comic_id)), [sliders]);

  const loadSliders = () => {
    setLoading(true);
    getAdminSliders()
      .then((r) => setSliders(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSliders();
  }, []);

  const runSearch = () => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    getAdminComics({ page: 1, limit: 8, search: search.trim() })
      .then((r) => setResults(r.data.comics || []))
      .finally(() => setSearching(false));
  };

  const addToSlider = async (comicId) => {
    const nextOrder = sliders.length ? Math.max(...sliders.map((s) => s.sort_order)) + 1 : 1;
    await createSlider({ comic_id: comicId, sort_order: nextOrder, is_active: 1 });
    loadSliders();
  };

  const saveRow = async (row) => {
    await updateSlider(row.id, {
      sort_order: Number(row.sort_order) || 0,
      is_active: !!row.is_active,
    });
    loadSliders();
  };

  const removeRow = async (id) => {
    if (!confirm('Xóa truyện này khỏi slider?')) return;
    await deleteSlider(id);
    loadSliders();
  };

  return (
    <div>
      <h1 className="admin-page-title">🖼️ Quản lý Slider Trang Chủ</h1>

      <div className="admin-card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: '0.7rem' }}>
          Tìm truyện để thêm vào slider
        </div>
        <div className="admin-toolbar" style={{ marginBottom: '0.6rem' }}>
          <input
            className="admin-search"
            placeholder="Tìm theo tên truyện hoặc tác giả..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <button className="btn-primary" onClick={runSearch}><FiSearch /> Tìm</button>
        </div>

        {searching && <div style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Đang tìm...</div>}

        {!searching && results.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Tiêu đề</th><th>Tác giả</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.title}</td>
                    <td style={{ color: '#9ca3af' }}>{c.author}</td>
                    <td>
                      <button
                        className="btn-sm btn-view"
                        onClick={() => addToSlider(c.id)}
                        disabled={sliderComicIds.has(c.id)}
                      >
                        <FiPlus /> {sliderComicIds.has(c.id) ? 'Đã có' : 'Thêm vào slider'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: '0.7rem' }}>
          Danh sách slider hiện tại (số nhỏ hiển thị trước)
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bìa</th>
                <th>Tiêu đề</th>
                <th>Thứ tự</th>
                <th>Hiển thị</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '1.5rem' }}>Đang tải...</td></tr>
              ) : sliders.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '1.5rem' }}>Chưa có truyện nào trong slider</td></tr>
              ) : (
                sliders.map((s) => (
                  <tr key={s.id}>
                    <td>{s.cover_url ? <img src={s.cover_url} alt="" className="cover-thumb" /> : <div className="cover-thumb" />}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.author}</div>
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        value={s.sort_order}
                        onChange={(e) => setSliders((old) => old.map((x) => x.id === s.id ? { ...x, sort_order: e.target.value } : x))}
                        style={{ width: 88 }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!s.is_active}
                        onChange={(e) => setSliders((old) => old.map((x) => x.id === s.id ? { ...x, is_active: e.target.checked ? 1 : 0 } : x))}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-sm btn-edit" onClick={() => saveRow(s)}><FiSave /> Lưu</button>
                        <button className="btn-sm btn-delete" onClick={() => removeRow(s.id)}><FiTrash2 /> Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
