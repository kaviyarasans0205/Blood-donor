import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard, StatCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';

export default function AdminReengagement() {
  const { toast } = useToast();
  const [inactiveMonths, setInactiveMonths] = useState(6);
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => adminApi.reengagement({ inactiveMonths }),
    [inactiveMonths]
  );

  const inactive = data?.inactive || [];
  const stats = data?.stats;

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === inactive.length) setSelected(new Set());
    else setSelected(new Set(inactive.map((d) => d.donorId)));
  };

  const send = async (body) => {
    setSending(true);
    try {
      const res = await adminApi.sendReengagement(body);
      toast.success(res.data.message || `Reminders queued for ${res.data.data.sent} donor(s)`);
      setSelected(new Set());
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingScreen label="Finding inactive donors…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Donor Re-engagement"
        subtitle="Reach out to donors who have not donated recently — reminders are sent via email + in-app (SMS mocked unless configured)"
        actions={
          <button
            onClick={() => send({ all: true })}
            disabled={sending || inactive.length === 0}
            className="btn-primary"
          >
            {sending ? 'Sending…' : `✉ Remind all ${inactive.length}`}
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Inactive for
          <select className="input mt-1 !w-48" value={inactiveMonths} onChange={(e) => setInactiveMonths(Number(e.target.value))}>
            {[3, 6, 9, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
          </select>
        </label>
        <div className="flex-1" />
        <button
          onClick={() => send({ donorIds: [...selected] })}
          disabled={sending || selected.size === 0}
          className="btn-medical"
        >
          {sending ? 'Sending…' : `✉ Send to selected (${selected.size})`}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Inactive Donors" value={inactive.length} sub={`no donation in ${inactiveMonths} months`} icon="😴" tone="warning" />
        <StatCard label="Active Donors" value={stats?.breakdown?.find((b) => b._id === 'active')?.count ?? 0} sub="donated recently" icon="💪" tone="success" />
        <StatCard label="Selected" value={selected.size} sub="ready to remind" icon="✉️" tone="medical" />
      </div>

      <div className="mt-6">
        <SectionCard title="Inactive donors" subtitle="Select donors to remind, or use 'Remind all'">
          {inactive.length === 0 ? (
            <EmptyState icon="🎉" title="No inactive donors" description="Everyone has donated within the selected window." />
          ) : (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={selected.size === inactive.length && inactive.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded"
                />
                Select all ({inactive.length})
              </label>
              {inactive.map((d) => (
                <label
                  key={d.donorId}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selected.has(d.donorId) ? 'border-medical-400 bg-medical-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(d.donorId)}
                      onChange={() => toggle(d.donorId)}
                      className="h-4 w-4 rounded"
                    />
                    <BloodGroupTag group={d.bloodGroup} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.email} · {d.city || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600">
                      {d.lastDonationDate ? `Last: ${formatDate(d.lastDonationDate)}` : 'Never donated'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {d.daysSinceDonation != null ? `${d.daysSinceDonation} days ago` : 'no history'} · {d.rewardPoints} pts
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}