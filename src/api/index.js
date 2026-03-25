import axios from 'axios';

const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:3001/api')
  : (import.meta.env.VITE_API_URL || '/api');

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 1;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
});

const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Attach token automatically if present
api.interceptors.request.use((config) => {
  if (typeof config.timeout !== 'number') {
    config.timeout = DEFAULT_TIMEOUT_MS;
  }

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
    const noRetry = Boolean(err.config?._noRetry);
    const status = err.response?.status;
    const timeoutOrNetwork = err.code === 'ECONNABORTED' || !err.response;

    if (!noRetry && canRetry && (timeoutOrNetwork || RETRYABLE_STATUS.has(status))) {
      const retries = Number(err.config.__retries || 0);
      if (retries < MAX_RETRIES) {
        err.config.__retries = retries + 1;
        const delay = 180 * (2 ** retries) + Math.floor(Math.random() * 80);
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
