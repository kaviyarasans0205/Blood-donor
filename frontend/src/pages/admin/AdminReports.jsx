import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../../services/api';
import api, { extractErrorMessage } from '../../api/client';
import { PageHeader } from '../../components/ui/Cards';
import { ErrorState } from '../../components/ui/States';
import DataTable from '../../components/ui/DataTable';
import { formatDateTime } from '../../utils/helpers';

const REPORT_META = {
  donors: ['Donors', 'Registered donors with contact and last donation details', '👥'],
  blood_stock: ['Blood Stock', 'Inventory batches with collection and expiry dates', '🩸'],
  emergency_requests: ['Emergency Requests', 'All emergency requests with priority and outcome', '🚨'],
  donations: ['Donations', 'Completed donations with units and reward points', '🎁'],
  expiry: ['Expiring Stock', 'Batches expiring soonest (FEFO order)', '⏳'],
  appointments: ['Appointments', 'Donation appointments with status', '📅'],
  demand_prediction: ['Demand Predictions', 'Forecasted demand and risk level per blood group', '🔮'],
  rewards: ['Reward Transactions', 'Points issued and redeemed per donor', '⭐'],
};

const fmt = (v) => {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export default function AdminReports() {
  const { toast } = useToast();
  const [type, setType] = useState('donors');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const types = useApi(() => adminApi.reportTypes());

  const loadPreview = async (t = type) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.reports({ type: t, format: 'json', from: from || undefined, to: to || undefined });
      setPreview(res.data);
    } catch (err) {
      setError(extractErrorMessage(err));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPreview(); }, [type, from, to]);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/admin/reports', {
        params: { type, format: 'csv', from: from || undefined, to: to || undefined },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const allTypes = types.data || Object.keys(REPORT_META);
  const rows = preview?.data || [];
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const columns = keys.map((k) => ({
    key: k,
    label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
    render: (r) => <span className="whitespace-nowrap">{fmt(r[k])}</span>,
  }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Generate CSV exports of operational data"
        actions={
          <button onClick={downloadCsv} disabled={downloading || loading || rows.length === 0} className="btn-primary">
            {downloading ? 'Downloading…' : '⬇ Download CSV'}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {allTypes.map((t) => {
          const meta = REPORT_META[t] || [t, '', '📄'];
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`card text-left transition-all ${type === t ? 'border-medical-500 ring-2 ring-medical-200' : 'hover:border-medical-300'}`}
            >
              <p className="text-2xl">{meta[2]}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{meta[0]}</p>
              <p className="mt-0.5 text-xs text-slate-500">{meta[1]}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          From
          <input type="date" className="input mt-1 !w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          To
          <input type="date" className="input mt-1 !w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn-secondary" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</button>
        <span className="text-xs text-slate-400">Generated {preview?.meta ? formatDateTime(new Date()) : '—'}</span>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="card space-y-3 py-14">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-medical-500 border-t-transparent" />
            <p className="text-center text-sm text-slate-500">Generating {REPORT_META[type]?.[0]} report…</p>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadPreview()} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            pageSize={15}
            searchKeys={keys}
            emptyMessage={`No data for ${REPORT_META[type]?.[0]} in this period`}
          />
        )}
      </div>
    </div>
  );
}
