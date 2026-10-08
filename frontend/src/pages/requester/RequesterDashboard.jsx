import { Link } from 'react-router-dom';
import { useApi, get } from '../../hooks/useApi';
import { PageHeader, SectionCard, StatCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../utils/helpers';

export default function RequesterDashboard() {
  const { data, loading, error, refetch } = useApi(() => get('/emergency-requests', { params: { limit: 100 } }));
  const queue = useApi(() => get('/emergency-requests/priority-queue', { params: { limit: 20 } }));
  const inv = useApi(() => get('/inventory', { params: { limit: 1 } }));

  if (loading) return <LoadingScreen label="Loading dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const requests = data?.data || [];
  const counts = {
    total: data?.meta?.total ?? requests.length,
    critical: requests.filter((r) => r.priority === 'CRITICAL' && !['Fulfilled', 'Cancelled', 'Expired'].includes(r.status)).length,
    urgent: requests.filter((r) => r.priority === 'URGENT' && !['Fulfilled', 'Cancelled', 'Expired'].includes(r.status)).length,
    open: requests.filter((r) => ['Pending', 'Matching', 'Partially Fulfilled'].includes(r.status)).length,
    fulfilled: requests.filter((r) => r.status === 'Fulfilled').length,
  };

  const stock = inv.data?.meta?.stockSummary || {};
  const q = queue.data?.data || [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Hospital / Requester Dashboard"
        subtitle="Create emergency requests and track their matching progress"
        actions={<Link to="/requester/new-request" className="btn-danger">🚨 New Emergency Request</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My Requests" value={counts.total} sub="all time" icon="📋" />
        <StatCard label="Open Requests" value={counts.open} sub="awaiting fulfilment" icon="⏳" tone="medical" />
        <StatCard label="Critical Open" value={counts.critical} sub="immediate attention" icon="🚨" tone="danger" />
        <StatCard label="Fulfilled" value={counts.fulfilled} sub="completed" icon="✅" tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Emergency priority queue"
            subtitle="CRITICAL → URGENT → NORMAL, earliest request first"
            actions={<Link to="/requester/requests" className="text-xs font-semibold text-medical-600 hover:underline">View all →</Link>}
          >
            {queue.loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
            ) : q.length === 0 ? (
              <EmptyState icon="✅" title="Queue is clear" description="No active emergency requests." />
            ) : (
              <div className="space-y-2">
                {q.slice(0, 8).map((r) => (
                  <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{r.queuePosition}</span>
                      <StatusBadge value={r.priority} dot />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.hospital}</p>
                        <p className="text-xs text-slate-500">{r.bloodGroup} · {r.requiredUnits} units{r.distanceKm != null ? ` · ${r.distanceKm} km` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={r.status} />
                      <Link to={`/requester/requests/${r._id}`} className="btn-secondary !py-1 text-xs">Open</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="mt-6">
            <SectionCard title="My recent requests">
              {requests.length === 0 ? (
                <EmptyState icon="🚨" title="No requests yet" description="Create your first emergency blood request." action={<Link to="/requester/new-request" className="btn-primary">Create request</Link>} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr><th>Created</th><th>Patient</th><th>Blood</th><th>Units</th><th>Priority</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {requests.slice(0, 8).map((r) => (
                        <tr key={r._id} className="cursor-pointer" onClick={() => (window.location.href = `/requester/requests/${r._id}`)}>
                          <td className="text-xs">{formatDateTime(r.createdAt)}</td>
                          <td>{r.patientName}</td>
                          <td><BloodGroupTag group={r.bloodGroup} size="sm" /></td>
                          <td>{r.fulfilledUnits}/{r.requiredUnits}</td>
                          <td><StatusBadge value={r.priority} /></td>
                          <td><StatusBadge value={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <div>
          <SectionCard title="Available blood stock" subtitle="Live from inventory" actions={<Link to="/availability" className="text-xs font-semibold text-medical-600 hover:underline">Details →</Link>}>
            <div className="grid grid-cols-2 gap-3">
              {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((g) => (
                <div key={g} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <BloodGroupTag group={g} size="sm" />
                  <span className={`text-lg font-bold ${(stock[g] ?? 0) < 10 ? 'text-red-600' : 'text-slate-800'}`}>
                    {stock[g] ?? 0}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">Only non-expired available batches are counted.</p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}