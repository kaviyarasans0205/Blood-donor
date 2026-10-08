import { BLOOD_GROUPS } from '../services/bloodGroups';

export const formatDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');
export const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
export const formatTime = (t) => t || '—';

export const daysBetween = (a, b = new Date()) =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export const priorityTone = (p) =>
  p === 'CRITICAL' ? 'danger' : p === 'URGENT' ? 'warning' : 'medical';

export const riskTone = (r) =>
  r === 'CRITICAL' || r === 'HIGH' ? 'danger' : r === 'MEDIUM' ? 'warning' : 'success';

export { BLOOD_GROUPS };

export const bloodGroupOptions = BLOOD_GROUPS.map((g) => ({ value: g, label: g }));

export const downloadCsv = async (api, type, params = {}) => {
  const res = await api.get('/admin/reports', { params: { ...params, type, format: 'csv' }, responseType: 'text' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const getGeoLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
