import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

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

const RAW_AXIOS_MESSAGE = /^Request failed with status code \d+$/;

const SERVER_MESSAGES = {
  500: 'Something went wrong on the server. Please try again.',
  502: 'The server is temporarily unreachable. Please try again.',
  503: 'The service is temporarily unavailable. Please try again in a moment.',
  504: 'The server took too long to respond. Please try again.',
};

export const friendlyMessage = (status, backendMessage) => {
  if (backendMessage && !RAW_AXIOS_MESSAGE.test(backendMessage)) return backendMessage;
  if (!status) return 'Cannot reach the server. Please check your connection and try again.';
  if (SERVER_MESSAGES[status]) return SERVER_MESSAGES[status];
  if (status >= 500) return 'Something went wrong on the server. Please try again.';
  return 'Something went wrong. Please try again.';
};

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;
    const backendMessage = typeof payload?.message === 'string' ? payload.message : undefined;
    const isNetwork = !error.response;

    const err = new Error(friendlyMessage(status, backendMessage));
    err.status = status;
    err.code = payload?.errorCode || (isNetwork ? 'NETWORK_ERROR' : 'UNKNOWN');
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
