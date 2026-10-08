import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { adminApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState } from '../../components/ui/States';

const DEFAULT_SETTINGS = {
  low_stock_thresholds: { 'A+': 10, 'A-': 6, 'B+': 10, 'B-': 6, 'AB+': 6, 'AB-': 4, 'O+': 12, 'O-': 8 },
  reward_config: { perDonation: 100, streakBonus: 50, referralBonus: 200, redemptionRate: 10 },
  reengagement_inactive_months: 6,
  expiry_warning_days: 7,
  appointment_reminder_hours: 24,
};

export default function AdminSettings() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi(() => adminApi.settings());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      const d = data.data || {};
      setForm({
        low_stock_thresholds: { ...DEFAULT_SETTINGS.low_stock_thresholds, ...(d.low_stock_thresholds?.value || {}) },
        reward_config: { ...DEFAULT_SETTINGS.reward_config, ...(d.reward_config?.value || {}) },
        reengagement_inactive_months: d.reengagement_inactive_months?.value ?? DEFAULT_SETTINGS.reengagement_inactive_months,
        expiry_warning_days: d.expiry_warning_days?.value ?? DEFAULT_SETTINGS.expiry_warning_days,
        appointment_reminder_hours: d.appointment_reminder_hours?.value ?? DEFAULT_SETTINGS.appointment_reminder_hours,
      });
    }
  }, [data]);

  if (loading && !form) return <LoadingScreen label="Loading settings…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!form) return null;

  const set = (patch) => setForm({ ...form, ...patch });
  const setThreshold = (g, v) => set({ low_stock_thresholds: { ...form.low_stock_thresholds, [g]: Number(v) } });
  const setReward = (k, v) => set({ reward_config: { ...form.reward_config, [k]: Number(v) } });

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(form);
      toast.success('Settings saved');
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="System Settings"
        subtitle="Thresholds, reward rules and operational windows — changes take effect for new alerts immediately"
        actions={<button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : '💾 Save settings'}</button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Low stock thresholds" subtitle="Alert raised when available units fall below">
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(form.low_stock_thresholds).map(([g, v]) => (
              <label key={g} className="text-xs font-semibold text-slate-500">
                {g}
                <input
                  type="number"
                  min="0"
                  className="input mt-1"
                  value={v}
                  onChange={(e) => setThreshold(g, e.target.value)}
                />
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Reward configuration" subtitle="Points issued per completed donation">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs font-semibold text-slate-500">
              Points per donation
              <input type="number" min="0" className="input mt-1" value={form.reward_config.perDonation} onChange={(e) => setReward('perDonation', e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Streak bonus
              <input type="number" min="0" className="input mt-1" value={form.reward_config.streakBonus} onChange={(e) => setReward('streakBonus', e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Referral bonus
              <input type="number" min="0" className="input mt-1" value={form.reward_config.referralBonus} onChange={(e) => setReward('referralBonus', e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Redemption rate (₹ / point)
              <input type="number" min="0" className="input mt-1" value={form.reward_config.redemptionRate} onChange={(e) => setReward('redemptionRate', e.target.value)} />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Operational windows">
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-500">
              Re-engagement: donors inactive for N months
              <input
                type="number"
                min="1"
                className="input mt-1"
                value={form.reengagement_inactive_months}
                onChange={(e) => set({ reengagement_inactive_months: Number(e.target.value) })}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Expiry warning: days before batch expiry
              <input
                type="number"
                min="1"
                className="input mt-1"
                value={form.expiry_warning_days}
                onChange={(e) => set({ expiry_warning_days: Number(e.target.value) })}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Appointment reminder: hours before appointment
              <input
                type="number"
                min="1"
                className="input mt-1"
                value={form.appointment_reminder_hours}
                onChange={(e) => set({ appointment_reminder_hours: Number(e.target.value) })}
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Notification channels" subtitle="Current mode (configured via environment)">
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span>In-app</span>
              <span className="font-medium text-emerald-600">Always enabled</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span>Email (SMTP)</span>
              <span className="font-medium text-slate-500">Set EMAIL_* env vars — mocked until configured</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span>SMS</span>
              <span className="font-medium text-slate-500">Set SMS_* env vars — mocked until configured</span>
            </div>
            <p className="pt-2 text-xs text-slate-400">
              Mocked channels log the message and return <code>mocked: true</code> so no code pretends delivery occurred.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}