import { useApi, get } from '../../hooks/useApi';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import { BloodGroupTag } from '../../components/ui/StatusBadge';

export default function BloodAvailability() {
  const { data, loading, error, refetch } = useApi(() => get('/inventory', { params: { limit: 1 } }));

  const stock = data?.meta?.stockSummary || {};
  const total = data?.meta?.totalUnits ?? Object.values(stock).reduce((a, b) => a + b, 0);
  const groups = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  if (loading) return <LoadingScreen label="Loading blood availability…" />;
  if (error) return <div className="mx-auto max-w-4xl px-4 py-10"><ErrorState message={error} onRetry={refetch} /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Live availability</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-900">Blood stock right now</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-500">
          Figures are computed from the database — only non-expired, available-status batches are counted.
        </p>
      </div>

      <div className="mt-8 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-100">Total available units</p>
            <p className="text-5xl font-extrabold">{total}</p>
          </div>
          <div className="text-right text-sm text-brand-50">
            <p>Across {groups.filter((g) => (stock[g] ?? 0) > 0).length} of 8 blood groups</p>
            <p className="text-xs">Updated live from inventory records</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => {
          const units = stock[g] ?? 0;
          const level = units === 0 ? 'None on hand' : units < 10 ? 'Limited' : units < 25 ? 'Moderate' : 'Good';
          return (
            <div key={g} className="card card-hover p-5">
              <div className="flex items-center gap-3">
                <BloodGroupTag group={g} size="lg" />
                <div>
                  <p className="text-3xl font-extrabold text-slate-900">{units}</p>
                  <p className="text-xs font-medium text-slate-500">units available</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${units === 0 ? 'bg-red-500' : units < 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (units / 40) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">{level}</p>
            </div>
          );
        })}
      </div>

      {total === 0 && (
        <div className="mt-8">
          <EmptyState icon="🩸" title="No stock recorded yet" description="Blood inventory will appear here once blood banks add batches." />
        </div>
      )}

      <div className="card mt-8 border-medical-200 bg-medical-50 p-5 text-sm text-medical-800">
        <strong>Looking for blood?</strong> If this is an emergency, submit an emergency request — the system will match
        compatible, eligible donors near you and notify them immediately. Availability shown here is indicative;
        final allocation is confirmed by the blood bank.
      </div>
    </div>
  );
}