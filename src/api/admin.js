import api from './index.js';

const auth = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

/* Stats */
export const getAdminStats   = ()       => api.get('/admin/stats', auth());

/* Comics */
export const getAdminComics  = (p)      => api.get('/admin/comics', { ...auth(), params: p });
export const getAdminComic   = (id)     => api.get(`/admin/comics/${id}`, auth());
export const createComic     = (data)   => api.post('/admin/comics', data, auth());
export const updateComic     = (id, d)  => api.put(`/admin/comics/${id}`, d, auth());
export const deleteComic     = (id)     => api.delete(`/admin/comics/${id}`, auth());

/* Homepage sliders */
export const getAdminSliders = ()       => api.get('/admin/sliders', auth());
export const createSlider    = (data)   => api.post('/admin/sliders', data, auth());
export const updateSlider    = (id, d)  => api.put(`/admin/sliders/${id}`, d, auth());
export const deleteSlider    = (id)     => api.delete(`/admin/sliders/${id}`, auth());

/* Chapters */
export const getAdminChapters  = (cid)     => api.get(`/admin/comics/${cid}/chapters`, auth());
export const createChapter     = (cid, d)  => api.post(`/admin/comics/${cid}/chapters`, d, auth());
export const updateChapter     = (id, d)   => api.put(`/admin/chapters/${id}`, d, auth());
export const deleteChapter     = (id)      => api.delete(`/admin/chapters/${id}`, auth());

/* Pages */
export const getChapterPages   = (id)      => api.get(`/admin/chapters/${id}/pages`, auth());
export const addChapterPage    = (id, d)   => api.post(`/admin/chapters/${id}/pages`, d, auth());
export const deletePage        = (id)      => api.delete(`/admin/pages/${id}`, auth());

/* Users */
export const getAdminUsers    = (p)      => api.get('/admin/users', { ...auth(), params: p });
export const updateUserRole   = (id, r)  => api.put(`/admin/users/${id}/role`, { role: r }, auth());
export const updateUserPwd    = (id, pw) => api.put(`/admin/users/${id}/password`, { password: pw }, auth());
export const deleteUser       = (id)     => api.delete(`/admin/users/${id}`, auth());

/* Genres */
export const getAdminGenres   = ()       => api.get('/admin/genres', auth());
export const createGenre      = (name)   => api.post('/admin/genres', { name }, auth());
export const deleteGenre      = (id)     => api.delete(`/admin/genres/${id}`, auth());
