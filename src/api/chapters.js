import api from './index.js';

export const getChapter = (id) => api.get(`/chapters/${id}`);
export const markChapterRead = (id) => api.post(`/chapters/${id}/history`).catch(() => {});
