import api from '../api/client';

export const authApi = {
  me: () => api.get('/auth/me'),
};

export const donorApi = {
  list: (params) => api.get('/donors', { params }),
  get: (id) => api.get(`/donors/${id}`),
  update: (id, body) => api.put(`/donors/${id}`, body),
  eligible: (params) => api.get('/donors/eligible', { params }),
  compatible: (bloodGroup, params) => api.get(`/donors/compatible/${encodeURIComponent(bloodGroup)}`, { params }),
  nearby: (params) => api.get('/donors/nearby', { params }),
  dashboard: () => api.get('/donors/dashboard/me'),
};

export const eligibilityApi = {
  rules: () => api.get('/eligibility/rules'),
  updateRules: (body) => api.put('/eligibility/rules', body),
  check: (body) => api.post('/eligibility/check', body),
  history: () => api.get('/eligibility/history'),
};

export const inventoryApi = {
  list: (params) => api.get('/inventory', { params }),
  create: (body) => api.post('/inventory', body),
  update: (id, body) => api.put(`/inventory/${id}`, body),
  remove: (id, mode) => api.delete(`/inventory/${id}`, { params: { mode } }),
  alerts: () => api.get('/inventory/alerts'),
  expiring: (params) => api.get('/inventory/expiring', { params }),
  getThresholds: () => api.get('/inventory/thresholds'),
  setThresholds: (body) => api.put('/inventory/thresholds', body),
};

export const emergencyApi = {
  create: (body) => api.post('/emergency-requests', body),
  list: (params) => api.get('/emergency-requests', { params }),
  get: (id) => api.get(`/emergency-requests/${id}`),
  update: (id, body) => api.put(`/emergency-requests/${id}`, body),
  priorityQueue: (params) => api.get('/emergency-requests/priority-queue', { params }),
  match: (id, params) => api.post(`/emergency-requests/${id}/match`, null, { params }),
  fulfill: (id, body) => api.post(`/emergency-requests/${id}/fulfill`, body),
};

export const appointmentApi = {
  create: (body) => api.post('/appointments', body),
  list: (params) => api.get('/appointments', { params }),
  update: (id, body) => api.put(`/appointments/${id}`, body),
  cancel: (id) => api.delete(`/appointments/${id}`),
};

export const notificationApi = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  send: (body) => api.post('/notifications/send', body),
};

export const rewardApi = {
  summary: (params) => api.get('/rewards', { params }),
  history: (params) => api.get('/rewards/history', { params }),
  config: () => api.get('/rewards/config'),
  setConfig: (body) => api.put('/rewards/config', body),
  adjust: (body) => api.post('/rewards/adjust', body),
};

export const predictionApi = {
  demand: (body) => api.post('/prediction/demand', body),
  trends: () => api.get('/prediction/trends'),
  history: () => api.get('/prediction/history'),
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  analytics: () => api.get('/admin/analytics'),
  donorMap: (params) => api.get('/admin/donor-map', { params }),
  alerts: (params) => api.get('/admin/alerts', { params }),
  resolveAlert: (id) => api.put(`/admin/alerts/${id}/resolve`),
  reengagement: (params) => api.get('/admin/reengagement', { params }),
  sendReengagement: (body) => api.post('/admin/reengagement/send', body),
  settings: () => api.get('/admin/settings'),
  updateSettings: (body) => api.put('/admin/settings', body),
  reports: (params) => api.get('/admin/reports', { params }),
  reportTypes: () => api.get('/admin/reports/types'),
};