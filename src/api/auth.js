import api from './index.js';

export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getMe = () => api.get('/auth/me');
export const reportSecurityFlag = (reason) => api.post('/auth/security-flag', { reason });
export const toggleFavorite = (comicId) => api.post(`/favorites/${comicId}`);
export const toggleRecommend = (comicId) => api.post(`/comics/${comicId}/recommend`);
export const getFavorites = () => api.get('/favorites');
export const getHistory = () => api.get('/history');
export const rateComic = (comicId, score) => api.post(`/ratings/${comicId}`, { score });
