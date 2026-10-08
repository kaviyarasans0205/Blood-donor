import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { eligibilityApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState } from '../../components/ui/States';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';

export default function DonorEligibility() {
  const { toast } = useToast();
  const [rules, setRules] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { recentIllness: false, recentTattoo: false, recentSurgery: false, onMedication: false, isPregnant: false, chronicCondition: false, recentTravel: false },
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, histRes] = await Promise.all([eligibilityApi.rules(), eligibilityApi.history()]);
      setRules(rulesRes.data.data.rules);
      setHistory(histRes.data.data || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const answers = {};
      for (const [k, v] of Object.entries(values)) {
        if (['recentIllness', 'recentTattoo', 'recentSurgery', 'onMedication', 'isPregnant', 'chronicCondition', 'recentTravel'].includes(k)) {
          answers[k] = v === true || v === 'true';
        }
      }
      const res = await eligibilityApi.check({ answers, saveToProfile: true, weightKg: values.weightKg || undefined });
      setResult(res.data.data);
      toast.success('Eligibility check recorded');
      const histRes = await eligibilityApi.history();
      setHistory(histRes.data.data || []);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading eligibility rules…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const questions = rules?.questions || [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Donation Eligibility Screening"
        subtitle="Rule-based pre-screening using your profile and health answers"
      />

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>⚠️ Disclaimer:</strong> {rules?.disclaimer || 'This is an automated pre-screening aid only. Final eligibility must be confirmed by authorized medical/blood-bank personnel.'}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionCard title="Screening questions" subtitle="Answer honestly — results are logged for audit">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="age">Age</label>
                  <input id="age" type="number" className="input" placeholder="Auto from profile" {...register('age', { min: { value: 0, message: 'Invalid' }, max: { value: 120, message: 'Invalid' } })} />
                  <p className="mt-1 text-[11px] text-slate-400">Leave blank to use your profile date of birth</p>
                  {errors.age && <p className="field-error">{errors.age.message}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="weightKg">Weight (kg)</label>
                  <input id="weightKg" type="number" step="0.1" className="input" placeholder="Auto from profile" {...register('weightKg', { min: { value: 20, message: 'Invalid' }, max: { value: 250, message: 'Invalid' } })} />
                  <p className="mt-1 text-[11px] text-slate-400">Minimum {rules?.minWeightKg ?? 50} kg required</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {questions.map((q) => (
                  <label key={q.key} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 hover:border-medical-300 hover:bg-medical-50/40">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" value={true} {...register(q.key)} />
                    <div>
                      <span className="text-sm text-slate-700">{q.label}</span>
                      {q.deflectDaysKey && rules?.[q.deflectDaysKey] && (
                        <p className="text-xs text-slate-400">Deferral period: {rules[q.deflectDaysKey]} days</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <button type="submit" className="btn-primary mt-6 w-full" disabled={submitting}>
                {submitting ? 'Checking…' : 'Run eligibility check'}
              </button>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {result && (
            <div className={`animate-fade-in rounded-xl border-2 p-6 ${result.result === 'ELIGIBLE' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{result.result === 'ELIGIBLE' ? '✅' : '⛔'}</span>
                <div>
                  <p className={`text-lg font-extrabold ${result.result === 'ELIGIBLE' ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.result === 'ELIGIBLE' ? 'Eligible for Donation' : 'Not Eligible'}
                  </p>
                  <p className="text-xs text-slate-500">Rules version {result.rulesVersion}</p>
                </div>
              </div>
              {result.reasons.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Reason{result.reasons.length > 1 ? 's' : ''}</p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                    {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">{result.disclaimer}</p>
            </div>
          )}

          <SectionCard title="Configured rules">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Age: {rules?.minAge} – {rules?.maxAge} years</li>
              <li>Minimum weight: {rules?.minWeightKg} kg</li>
              <li>Donation interval: {rules?.deferralDaysAfterDonation} days</li>
              <li>Post-illness deferral: {rules?.deferralDaysAfterIllness} days</li>
              <li>Post-tattoo deferral: {rules?.deferralDaysAfterTattoo} days</li>
              <li>Post-surgery deferral: {rules?.deferralDaysAfterSurgery} days</li>
            </ul>
            <p className="mt-3 text-xs text-slate-400">Rules are configurable by administrators.</p>
          </SectionCard>

          <SectionCard title="Recent checks">
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No checks recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.slice(0, 6).map((h) => (
                  <li key={h._id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-xs text-slate-500">{formatDate(h.createdAt)}</p>
                      <p className="text-xs text-slate-400">{h.reasons?.[0]?.slice(0, 50)}{h.reasons?.[0]?.length > 50 ? '…' : ''}</p>
                    </div>
                    <StatusBadge value={h.result} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}