import { Link } from 'react-router-dom';
import { useApi, get } from '../../hooks/useApi';
import { PageHeader, SectionCard, StatCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const PRIORITY_COLORS = { CRITICAL: '#dc2626', URGENT: '#f59e0b', NORMAL: '#0ea5e9' };

export default function AdminDashboard() {
  const { data, loading, error, refetch } = useApi(() => get('/admin/dashboard'));

  if (loading) return <LoadingScreen label="Loading admin dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return <EmptyState title="No data" />;

  const c = data.cards;
  const ch = data.charts;

  const priorityData = (ch.emergencyByPriority || []).map((r) => ({ name: r._id, value: r.count, fill: PRIORITY_COLORS[r._id] || '#94a3b8' }));
  const stockData = ch.stockByGroup || [];
  const donationsData = (ch.monthlyDonations || []).map((m) => ({ month: m._id, units: m.units, donations: m.count }));
  const apptData = (ch.appointmentStats || []).map((a) => ({ name: a._id, value: a.count }));
  const donorData = (ch.donorActivity || []).map((d) => ({ month: d._id, newDonors: d.count }));
  const demandData = c.predictedDemand || [];
  const expiringData = (ch.expiringTrend || []).map((e) => ({ name: e._id, units: e.units }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Live operational overview — every value comes from the API"
        actions={
          <>
            <Link to="/admin/reports" className="btn-secondary">📑 Reports</Link>
            <Link to="/admin/emergencies" className="btn-danger">🚨 Emergencies</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Total Donors" value={c.totalDonors.toLocaleString()} sub={`${c.eligibleDonors} eligible`} icon="👥" />
        <StatCard label="Available Blood" value={c.availableUnits} sub="units across all groups" icon="🩸" tone="danger" />
        <StatCard label="Emergency Requests" value={c.activeRequests} sub="active" icon="🚨" tone="warning" />
        <StatCard label="Critical Requests" value={c.criticalRequests} sub={`${c.urgentRequests} urgent`} icon="⚠️" tone="danger" />
        <StatCard label="Expiring Soon" value={c.expiringUnits} sub="units ≤ 7 days" icon="⏳" tone="warning" />
        <StatCard label="Low Stock Groups" value={c.lowStockGroups} sub="below threshold" icon="📉" tone={c.lowStockGroups > 0 ? 'danger' : 'success'} />
        <StatCard label="Appointments" value={c.appointments} sub="upcoming" icon="📅" tone="medical" />
        <StatCard label="Donations (month)" value={c.donationsThisMonth} sub="this month" icon="❤️" tone="success" />
        <StatCard label="Hospitals" value={c.totalRequesters} sub="registered" icon="🏥" />
        <StatCard label="Open Alerts" value={c.unresolvedAlerts} sub="needs attention" icon="🔔" tone={c.unresolvedAlerts > 0 ? 'warning' : 'success'} />
        <StatCard label="Blood Groups at Risk" value={demandData.filter((d) => ['HIGH', 'CRITICAL'].includes(d.riskLevel)).length} sub="of 8 groups" icon="🔮" tone="medical" />
        <StatCard label="Stock Groups OK" value={8 - c.lowStockGroups} sub="healthy" icon="✅" tone="success" />
      </div>

      {/* Low stock + alerts strip */}
      {(data.lowStock.length > 0 || data.expiring.length > 0) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.lowStock.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-bold text-red-800">📉 Low stock alerts</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.lowStock.map((l) => (
                  <span key={l.bloodGroup} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm ring-1 ring-red-200">
                    {l.bloodGroup}: {l.units} / min {l.threshold}
                  </span>
                ))}
              </div>
              <Link to="/admin/alerts" className="mt-3 inline-block text-xs font-semibold text-red-700 underline">Manage alerts →</Link>
            </div>
          )}
          {data.expiring.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-bold text-amber-800">⏳ Expiring within 7 days</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.expiring.slice(0, 6).map((b) => (
                  <span key={b.batchNumber} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm ring-1 ring-amber-200">
                    {b.bloodGroup} × {b.units} — {b.daysRemaining}d left
                  </span>
                ))}
              </div>
              <Link to="/admin/inventory" className="mt-3 inline-block text-xs font-semibold text-amber-700 underline">Open inventory →</Link>
            </div>
          )}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Blood stock by group" subtitle="Available units (non-expired)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bloodGroup" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                  {stockData.map((entry, i) => (
                    <Cell key={i} fill={entry.units < 10 ? '#dc2626' : entry.units < 25 ? '#f59e0b' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Emergency requests by priority" subtitle="All-time distribution">
          {priorityData.length === 0 ? (
            <EmptyState icon="🚨" title="No requests yet" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={4}>
                    {priorityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Charts row 2 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Monthly donations" subtitle="Units collected per month (12 months)">
          <div className="h-72">
            {donationsData.length === 0 ? (
              <EmptyState icon="📊" title="No donation data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={donationsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="units" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Predicted demand (14 days)" subtitle="Forecast vs current stock with risk levels">
          {demandData.length === 0 ? (
            <EmptyState icon="🔮" title="No predictions yet" description="Run predictions from the Demand Prediction page." action={<Link to="/admin/predictions" className="btn-primary">Open predictions</Link>} />
          ) : (
            <div className="space-y-2">
              {demandData.map((d) => {
                const shortfall = d.predictedDemand - d.currentStock;
                return (
                  <div key={d.bloodGroup} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                    <BloodGroupTag group={d.bloodGroup} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Stock {d.currentStock} → Predicted {d.predictedDemand}</span>
                        <StatusBadge value={d.riskLevel} />
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${shortfall > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (d.currentStock / Math.max(d.predictedDemand, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Charts row 3 */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Appointment statistics">
          <div className="h-60">
            {apptData.length === 0 ? <EmptyState icon="📅" title="No appointments" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={apptData} dataKey="value" nameKey="name" outerRadius={80}>
                    {apptData.map((_, i) => <Cell key={i} fill={['#3b82f6', '#10b981', '#f59e0b', '#94a3b8', '#dc2626'][i % 5]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Donor activity" subtitle="New donor registrations per month">
          <div className="h-60">
            {donorData.length === 0 ? <EmptyState icon="👥" title="No activity" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={donorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="newDonors" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Expiry trend" subtitle="Safe vs expiring stock units">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expiringData}
                  dataKey="units"
                  nameKey="name"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {expiringData.map((_, i) => <Cell key={i} fill={i === 0 ? '#f59e0b' : '#10b981'} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}