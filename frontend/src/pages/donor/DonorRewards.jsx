import { useApi, get } from '../../hooks/useApi';
import { PageHeader, SectionCard, StatCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import { formatDate } from '../../utils/helpers';

const typeIcons = {
  donation: '🩸',
  streak_bonus: '🔥',
  appointment_kept: '📅',
  referral: '👥',
  redemption: '🎁',
  adjustment: '⚙️',
};

export default function DonorRewards() {
  const { data, loading, error, refetch } = useApi(() => get('/rewards'));

  if (loading) return <LoadingScreen label="Loading rewards…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const { points, totalDonations, config, history } = data || {};
  const items = history?.items || [];
  const earned = items.filter((i) => i.points > 0).reduce((s, i) => s + i.points, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Reward Points" subtitle="Earned through completed donations and milestones" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Current Points" value={points ?? 0} sub="available balance" icon="🏅" tone="warning" />
        <StatCard label="Total Donations" value={totalDonations ?? 0} sub="lifetime completed" icon="🩸" tone="danger" />
        <StatCard label="Points Earned" value={earned} sub="in recent history" icon="📈" tone="medical" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Points history" subtitle="Every transaction is recorded in an immutable ledger">
            {items.length === 0 ? (
              <EmptyState icon="🏅" title="No points yet" description="Complete a donation to start earning rewards." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((t) => (
                  <li key={t._id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">{typeIcons[t.transactionType] || '•'}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.description}</p>
                        <p className="text-xs text-slate-500">{formatDate(t.createdAt)} · {t.transactionType.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${t.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.points > 0 ? '+' : ''}{t.points}
                      </p>
                      <p className="text-[11px] text-slate-400">bal: {t.balanceAfter}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard title="How points work">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Completed donation: <strong>+{config?.pointsPerDonation ?? 100} points</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Kept appointment: <strong>+{config?.pointsPerAppointmentKept ?? 25} points</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-600">✓</span>
              <span>Every {config?.streakBonusThreshold ?? 4} donations: <strong>+{config?.streakBonusPoints ?? 50} bonus</strong></span>
            </li>
          </ul>
          <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Points are configurable by administrators. No monetary incentive is offered unless explicitly configured and
            legally appropriate in your jurisdiction.
          </div>
        </SectionCard>
      </div>
    </div>
  );
}