import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApi, get } from '../../hooks/useApi';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const navigate = useNavigate();
  const { user } = useAuth();

  const canSeeDonors = user && ['admin', 'requester'].includes(user.role);

  const { data, loading, error, refetch } = useApi(async () => {
    const [donors, requests, stock] = await Promise.all([
      canSeeDonors
        ? get('/donors', { params: { search: q, limit: 10 } }).catch(() => null)
        : Promise.resolve(null),
      get('/emergency-requests', { params: { search: q, limit: 10 } }).catch(() => null),
      get('/inventory', { params: { search: q, limit: 10 } }).catch(() => null),
    ]);
    return {
      donors: donors?.data?.data || [],
      requests: requests?.data?.data || [],
      stock: stock?.data?.data || [],
    };
  }, [q, canSeeDonors]);

  if (loading) return <LoadingScreen label={`Searching for “${q}”…`} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const donors = data?.donors || [];
  const requests = data?.requests || [];
  const stock = data?.stock || [];
  const total = donors.length + requests.length + stock.length;

  return (
    <div className="animate-fade-in">
      <PageHeader title={`Search: “${q}”`} subtitle={`${total} result${total === 1 ? '' : 's'} across available modules`} />

      {total === 0 ? (
        <EmptyState
          icon="🔍"
          title="No results found"
          description="Try a different term — hospital name, batch number, patient name or donor email."
          action={<button onClick={() => navigate(-1)} className="btn-secondary mt-3">Go back</button>}
        />
      ) : (
        <div className="space-y-6">
          {canSeeDonors && donors.length > 0 && (
            <SectionCard title={`Donors (${donors.length})`}>
              <div className="space-y-2">
                {donors.map((d) => (
                  <button
                    key={d._id}
                    onClick={() => navigate(`/admin/donors?q=${encodeURIComponent(q)}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-medical-300"
                  >
                    <div className="flex items-center gap-3">
                      <BloodGroupTag group={d.bloodGroup} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{d.userId?.name || 'Donor'}</p>
                        <p className="text-xs text-slate-500">{d.userId?.email} · {d.city || '—'}</p>
                      </div>
                    </div>
                    <StatusBadge value={d.eligibilityStatus} />
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {requests.length > 0 && (
            <SectionCard title={`Emergency Requests (${requests.length})`}>
              <div className="space-y-2">
                {requests.map((r) => (
                  <button
                    key={r._id}
                    onClick={() => navigate(user?.role === 'admin' ? '/admin/emergencies' : '/requests')}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-medical-300"
                  >
                    <div className="flex items-center gap-3">
                      <BloodGroupTag group={r.bloodGroup} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.hospital}</p>
                        <p className="text-xs text-slate-500">{r.patientName} · {r.requiredUnits} units · {formatDate(r.requiredAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={r.priority} />
                      <StatusBadge value={r.status} />
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {stock.length > 0 && (
            <SectionCard title={`Blood Stock (${stock.length})`}>
              <div className="space-y-2">
                {stock.map((s) => (
                  <div key={s._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <BloodGroupTag group={s.bloodGroup} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Batch {s.batchNumber}</p>
                        <p className="text-xs text-slate-500">{s.units} units · {s.location} · expires {formatDate(s.expiryDate)}</p>
                      </div>
                    </div>
                    <StatusBadge value={s.status} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}