import { Link } from 'react-router-dom';
import { useApi, get } from '../../hooks/useApi';
import { StatCard, SectionCard, PageHeader } from '../../components/ui/Cards';
import { ErrorState, EmptyState, LoadingScreen } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function DonorDashboard() {
  const { data, loading, error, refetch } = useApi(() => get('/donors/dashboard/me'));

  if (loading) return <LoadingScreen label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="No data" />;

  const { stats, upcomingAppointment, donationHistory, monthlyActivity, nearbyEmergencyRequests } = data;
  const eligible = stats.eligibility === 'eligible';

  const chartData = monthlyActivity.map((m) => ({
    month: m._id,
    donations: m.count,
    units: m.units,
  }));

  const historyData = donationHistory.slice(0, 10).reverse().map((d) => ({
    date: new Date(d.donationDate).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    units: d.units,
  }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome back, 👋`}
        subtitle="Your donation activity, eligibility and nearby emergencies at a glance"
        actions={
          <>
            <Link to="/donor/eligibility" className={eligible ? 'btn-secondary' : 'btn-primary'}>
              {eligible ? '✅ Eligible' : 'Check eligibility'}
            </Link>
            <Link to="/donor/appointments" className="btn-primary">📅 Book appointment</Link>
          </>
        }
      />

      {/* Eligibility banner */}
      <div className={`mb-6 rounded-xl border p-5 ${eligible ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BloodGroupTag group={stats.bloodGroup} size="lg" />
            <div>
              <p className={`text-sm font-bold ${eligible ? 'text-emerald-800' : 'text-amber-800'}`}>
                {eligible ? 'You are eligible to donate' : 'Eligibility needs attention'}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Last donation: {stats.lastDonationDate ? formatDate(stats.lastDonationDate) : 'Never'} ·{' '}
                {stats.nextEligibleDate ? `Next eligible: ${formatDate(stats.nextEligibleDate)}` : 'No waiting period'}
              </p>
            </div>
          </div>
          <Link to="/donor/eligibility" className="btn-secondary text-xs">Run full screening →</Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Donations" value={stats.totalDonations} sub="completed donations" icon="🩸" tone="danger" />
        <StatCard label="Reward Points" value={stats.rewardPoints} sub="redeemable ledger" icon="🏅" tone="warning" />
        <StatCard label="Eligibility" value={eligible ? 'ELIGIBLE' : 'INELIGIBLE'} sub={`Blood group ${stats.bloodGroup}`} icon="✅" tone={eligible ? 'success' : 'danger'} />
        <StatCard
          label="Next Appointment"
          value={upcomingAppointment ? upcomingAppointment.appointmentTime : '—'}
          sub={upcomingAppointment ? formatDate(upcomingAppointment.appointmentDate) : 'None scheduled'}
          icon="📅"
          tone="medical"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Monthly donation activity" subtitle="Completed donations per month">
          {chartData.length === 0 ? (
            <EmptyState icon="📊" title="No activity yet" description="Your monthly donation chart will appear after your first donation." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="donations" name="Donations" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? '#dc2626' : '#93c5fd'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Donation history" subtitle="Last 10 records" actions={<Link to="/donor/rewards" className="text-xs font-semibold text-medical-600 hover:underline">View rewards →</Link>}>
          {donationHistory.length === 0 ? (
            <EmptyState icon="🩸" title="No donations yet" description="Book your first appointment to get started." action={<Link to="/donor/appointments" className="btn-primary">Book appointment</Link>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {donationHistory.slice(0, 6).map((d) => (
                <li key={d._id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <BloodGroupTag group={d.bloodGroup} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.location}</p>
                      <p className="text-xs text-slate-500">{formatDate(d.donationDate)}</p>
                    </div>
                  </div>
                  <StatusBadge value={d.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Nearby emergencies */}
      <div className="mt-6">
        <SectionCard
          title="🚨 Nearby emergency requests"
          subtitle={`Matching your blood group (${stats.bloodGroup}) in the last 7 days`}
        >
          {nearbyEmergencyRequests.length === 0 ? (
            <EmptyState icon="✅" title="No active emergencies for your blood group" description="You'll be notified the moment someone nearby needs your blood group." />
          ) : (
            <div className="space-y-3">
              {nearbyEmergencyRequests.map((r) => (
                <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 hover:border-brand-300">
                  <div className="flex items-center gap-3">
                    <StatusBadge value={r.priority} dot />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.hospital}</p>
                      <p className="text-xs text-slate-500">
                        {r.requiredUnits} unit(s) of {r.bloodGroup}
                        {r.distanceKm != null && ` · ${r.distanceKm} km away`}
                        {` · ${formatDateTime(r.createdAt)}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={r.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {historyData.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Units donated (recent)" subtitle="Per donation record">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="units" name="Units" fill="#dc2626" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}