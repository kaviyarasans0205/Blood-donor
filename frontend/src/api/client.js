import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;
    const err = new Error(payload?.message || error.message || 'Network error');
    err.status = status;
    err.code = payload?.errorCode || (error.code === 'ERR_NETWORK' ? 'NETWORK_ERROR' : 'UNKNOWN');
    err.details = payload?.details;
    if (status === 401 && onUnauthorized) onUnauthorized(err);
    return Promise.reject(err);
  }
);

export const extractErrorMessage = (err) => {
  if (err?.details && Array.isArray(err.details)) {
    return err.details.map((d) => `${d.field}: ${d.message}`).join(', ');
  }
  return err?.message || 'Something went wrong';
};

export default api;
