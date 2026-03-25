import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')
  : (import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Attach token automatically if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const method = err.config?.method?.toLowerCase();
    const canRetry = RETRYABLE_METHODS.has(method);
    const status = err.response?.status;
    const timeoutOrNetwork = err.code === 'ECONNABORTED' || !err.response;

    if (canRetry && (timeoutOrNetwork || RETRYABLE_STATUS.has(status))) {
      const retries = Number(err.config.__retries || 0);
      if (retries < 2) {
        err.config.__retries = retries + 1;
        const delay = 300 * (2 ** retries) + Math.floor(Math.random() * 120);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(err.config);
      }
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(err);
  }
);

export default api;
