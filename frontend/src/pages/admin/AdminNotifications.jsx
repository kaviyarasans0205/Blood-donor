import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { notificationApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard } from '../../components/ui/Cards';

const TYPES = [
  'emergency_request', 'donor_match', 'appointment_confirmation', 'appointment_reminder',
  'low_stock', 'expiry_warning', 'reengagement_reminder', 'reward_earned', 'general',
];

export default function AdminNotifications() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    userId: '',
    type: 'custom',
    title: '',
    message: '',
    channels: ['inapp'],
  });
  const [sending, setSending] = useState(false);

  const toggleChannel = (c) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c],
    }));
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const send = async (e) => {
    e.preventDefault();
    if (!form.userId.trim() || !form.title.trim() || !form.message.trim()) {
      toast.error('User ID, title and message are required');
      return;
    }
    setSending(true);
    try {
      const res = await notificationApi.send({
        userId: form.userId.trim(),
        type: form.type,
        title: form.title,
        message: form.message,
        channels: form.channels.length ? form.channels : ['inapp'],
      });
      const r = res.data?.data;
      const mocked = Array.isArray(r) ? r.some((x) => x.mocked) : r?.mocked;
      toast.success(mocked ? 'Sent (mocked — configure EMAIL_*/SMS_* for real delivery)' : 'Notification sent');
      set({ title: '', message: '' });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Send Notification" subtitle="Deliver an in-app (and optionally email/SMS) notification to a single user" />

      <div className="max-w-2xl">
        <SectionCard title="Compose">
          <form onSubmit={send} className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              User ID
              <input
                className="input mt-1"
                placeholder="MongoDB user ID of the recipient"
                value={form.userId}
                onChange={(e) => set({ userId: e.target.value })}
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notification type
                <select className="input mt-1" value={form.type} onChange={(e) => set({ type: e.target.value })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Channels
                <div className="mt-2 flex gap-3">
                  {['inapp', 'email', 'sms'].map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal">
                      <input
                        type="checkbox"
                        checked={form.channels.includes(c)}
                        onChange={() => toggleChannel(c)}
                        className="h-4 w-4 rounded"
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
              <input
                className="input mt-1"
                placeholder="Notification title"
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                required
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Message
              <textarea
                className="input mt-1 min-h-28"
                placeholder="Notification body"
                value={form.message}
                onChange={(e) => set({ message: e.target.value })}
                required
              />
            </label>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Email/SMS report <code>mocked: true</code> until SMTP/SMS env vars are configured.
              </p>
              <button type="submit" disabled={sending} className="btn-primary">
                {sending ? 'Sending…' : 'Send notification'}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}