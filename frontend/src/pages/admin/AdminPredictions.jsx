import { useState } from 'react';
import { useApi, get } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { predictionApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard, StatCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, Legend,
} from 'recharts';


export default function AdminPredictions() {
  const { toast } = useToast();
  const [forecastDays, setForecastDays] = useState(14);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => predictionApi.demand({ forecastDays, forceRefresh: false });
  const { data: predictions, loading, error: loadError, refetch } = useApi(load, [forecastDays]);
  const trends = useApi(() => get('/prediction/trends'));

  const refresh = async () => {
    setRefreshing(true);
    try {
      await predictionApi.demand({ forecastDays, forceRefresh: true });
      toast.success('Predictions recomputed');
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading demand predictions…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={refetch} />;

  const preds = predictions || [];
  const atRisk = preds.filter((p) => ['HIGH', 'CRITICAL'].includes(p.riskLevel));
  const demandChart = preds.map((p) => ({ bloodGroup: p.bloodGroup, stock: p.currentStock, predicted: p.predictedDemand }));

  const t = trends.data;
  const requestTrend = (t?.monthlyRequests || []).map((m) => ({ month: m._id, units: m.units, requests: m.count }));
  const donationTrend = (t?.monthlyDonations || []).map((m) => ({ month: m._id, units: m.units }));
  const demandByGroup = (t?.demandByGroup || []).map((d) => ({ bloodGroup: d._id, units: d.units, requests: d.requests }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Blood Demand Prediction"
        subtitle="Forecasting service results — cached and refreshed by scheduled job, not per page load"
        actions={
          <>
            <select className="input !w-40" value={forecastDays} onChange={(e) => setForecastDays(Number(e.target.value))}>
              {[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d}-day forecast</option>)}
            </select>
            <button onClick={refresh} disabled={refreshing} className="btn-primary">
              {refreshing ? 'Recomputing…' : '↻ Recompute'}
            </button>
          </>
        }
      />

      <div className="mb-6 rounded-xl border border-medical-200 bg-medical-50 p-4 text-sm text-medical-800">
        <strong>Decision support only:</strong> forecasts are statistical estimates derived from historical request and
        donation data. They are not medically validated predictions and must not be used as autonomous medical
        decisions. Model metadata is shown for transparency.
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Groups at Risk" value={`${atRisk.length} / 8`} sub="HIGH or CRITICAL" icon="⚠️" tone={atRisk.length ? 'danger' : 'success'} />
        <StatCard label="Forecast Period" value={`${forecastDays}d`} sub="per blood group" icon="🔮" tone="medical" />
        <StatCard label="Model" value={preds[0]?.modelMeta?.model || '—'} sub={`${preds[0]?.modelMeta?.dataPoints ?? 0} data points`} icon="🤖" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Stock vs predicted demand" subtitle={`Next ${forecastDays} days`}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bloodGroup" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="stock" name="Current stock" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="predicted" name="Predicted demand" radius={[6, 6, 0, 0]}>
                  {demandChart.map((d, i) => (
                    <Cell key={i} fill={d.predicted > d.stock ? '#dc2626' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Historical demand trend" subtitle="Emergency request units per month">
          {requestTrend.length === 0 ? (
            <EmptyState icon="📊" title="No historical data yet" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={requestTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="units" name="Requested units" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="requests" name="Request count" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Risk assessment & recommendations" subtitle="Per blood group">
          <div className="space-y-3">
            {preds.map((p) => (
              <div key={p._id || p.bloodGroup} className={`rounded-xl border-2 p-4 ${['CRITICAL', 'HIGH'].includes(p.riskLevel) ? 'border-red-300 bg-red-50/60' : p.riskLevel === 'MEDIUM' ? 'border-amber-300 bg-amber-50/60' : 'border-emerald-200 bg-emerald-50/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BloodGroupTag group={p.bloodGroup} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Current stock: {p.currentStock} units · Predicted: {p.predictedDemand} units
                      </p>
                      <p className="text-xs text-slate-500">
                        {forecastDays}-day forecast · period ends {formatDate(p.periodEnd)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={p.riskLevel} />
                </div>
                <p className="mt-2 text-xs text-slate-600">{p.recommendation}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Model: {p.modelMeta?.model} · data points: {p.modelMeta?.dataPoints} · generated {p.modelMeta?.generatedAt ? new Date(p.modelMeta.generatedAt).toLocaleString() : '—'}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Donations collected trend" subtitle="Units per month">
            {donationTrend.length === 0 ? (
              <EmptyState icon="🩸" title="No donation data" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={donationTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="units" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Demand by group (180 days)" subtitle="Requested units from emergency requests">
            <div className="space-y-2">
              {demandByGroup.length === 0 ? (
                <EmptyState icon="📋" title="No request data yet" />
              ) : (
                demandByGroup.map((d) => (
                  <div key={d.bloodGroup} className="flex items-center gap-3">
                    <BloodGroupTag group={d.bloodGroup} size="sm" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{d.units} units · {d.requests} requests</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.min(100, (d.units / (demandByGroup[0]?.units || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}