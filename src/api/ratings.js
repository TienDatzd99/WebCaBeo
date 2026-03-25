import api from './index.js';

export const getComicReviews = (comicId) => api.get(`/ratings/${comicId}/reviews`);

export const submitComicReview = (comicId, payload) =>
  api.post(`/ratings/${comicId}/reviews`, payload);
