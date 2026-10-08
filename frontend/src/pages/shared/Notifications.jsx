import { useState } from 'react';
import { useApi, get } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { notificationApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import { formatDateTime } from '../../utils/helpers';

const TYPE_ICONS = {
  emergency_request: '🚨', donor_match: '🩸',
  appointment_confirmation: '📅', appointment_reminder: '⏰',
  low_stock: '📉', expiry_warning: '⏳',
  reengagement_reminder: '📮', reward_earned: '⭐', general: '🔔',
};

export default function Notifications() {
  const { toast } = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => get('/notifications', { params: { limit: 100, unreadOnly: unreadOnly ? 'true' : 'false' } }),
    [unreadOnly]
  );

  const items = data?.data || [];
  const unread = data?.meta?.unread ?? 0;

  const markRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      toast.success('All notifications marked as read');
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  if (loading && !data) return <LoadingScreen label="Loading notifications…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread`}
        actions={
          <>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="h-4 w-4 rounded" />
              Unread only
            </label>
            <button onClick={markAll} disabled={unread === 0} className="btn-secondary">✓ Mark all read</button>
          </>
        }
      />

      <SectionCard>
        {items.length === 0 ? (
          <EmptyState icon="🔔" title="No notifications" description="You're all caught up." />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => !n.readAt && markRead(n._id)}
                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${
                  n.readAt ? 'opacity-60' : 'bg-medical-50/40'
                }`}
              >
                <span className="mt-0.5 text-lg">{TYPE_ICONS[n.type] || '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm ${n.readAt ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{n.title}</p>
                    {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-medical-500" />}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{n.message}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                    <span>{formatDateTime(n.createdAt)}</span>
                    <span>{n.channel}</span>
                    {n.mocked && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">mocked</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}