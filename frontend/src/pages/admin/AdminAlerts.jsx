import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, StatCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/helpers';

export default function AdminAlerts() {
  const { toast } = useToast();
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);
  const [type, setType] = useState('');
  const [resolving, setResolving] = useState(null);

  const { data, loading, error, refetch } = useApi(
    () => adminApi.alerts({ unresolvedOnly: unresolvedOnly ? 'true' : 'false', type: type || undefined, limit: 100 }),
    [unresolvedOnly, type]
  );

  const alerts = data?.data || [];
  const open = alerts.filter((a) => !a.isResolved);

  const resolve = async (id) => {
    setResolving(id);
    try {
      await adminApi.resolveAlert(id);
      toast.success('Alert resolved');
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResolving(null);
    }
  };

  if (loading && !data) return <LoadingScreen label="Loading alerts…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const bySeverity = (s) => open.filter((a) => a.severity === s).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="System Alerts"
        subtitle="Inventory, expiry and operational alerts raised by scheduled jobs"
        actions={<button onClick={refetch} className="btn-secondary">↻ Refresh</button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Critical" value={bySeverity('critical')} icon="🚨" tone="danger" />
        <StatCard label="Warning" value={bySeverity('warning')} icon="⚠️" tone="warning" />
        <StatCard label="Info" value={bySeverity('info')} icon="ℹ️" tone="medical" />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={unresolvedOnly} onChange={(e) => setUnresolvedOnly(e.target.checked)} className="h-4 w-4 rounded" />
          Unresolved only
        </label>
        <select className="input !w-56" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All alert types</option>
          {['low_stock', 'expiry_warning', 'expired', 'system'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {alerts.length === 0 ? (
          <EmptyState icon="✅" title="No alerts" description="Everything looks healthy right now." />
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div
                key={a._id}
                className={`rounded-xl border-2 p-4 ${
                  a.isResolved ? 'border-slate-200 bg-slate-50 opacity-70'
                    : a.severity === 'critical' ? 'border-red-300 bg-red-50/60'
                    : a.severity === 'high' ? 'border-amber-300 bg-amber-50/60'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <StatusBadge value={a.severity} dot />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{a.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>{a.type}</span>
                        <span>{formatDateTime(a.createdAt)}</span>
                        {a.bloodGroup && <BloodGroupTag group={a.bloodGroup} size="sm" />}
                        {a.isResolved && <span className="text-emerald-600">resolved {a.resolvedAt ? formatDateTime(a.resolvedAt) : ''}</span>}
                      </div>
                    </div>
                  </div>
                  {!a.isResolved && (
                    <button
                      onClick={() => resolve(a._id)}
                      disabled={resolving === a._id}
                      className="btn-medical !px-3 !py-1.5 text-xs"
                    >
                      {resolving === a._id ? 'Resolving…' : '✓ Resolve'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}