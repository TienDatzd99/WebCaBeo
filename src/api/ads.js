import api from './index.js';

export const getRandomAd = async () => {
  const response = await api.get('/ads/random');
  return response;
};

export const getAllAds = async () => {
  const response = await api.get('/ads');
  return response;
};
