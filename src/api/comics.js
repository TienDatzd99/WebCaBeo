import api from './index.js';

export const getComics = (params) => api.get('/comics', { params });
export const getComic = (id) => api.get(`/comics/${id}`);
export const getComicChapters = (id) => api.get(`/comics/${id}/chapters`);
