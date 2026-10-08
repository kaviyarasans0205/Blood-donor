import { useState } from 'react';
import { useApi, get } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/Cards';
import { EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import DataTable from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';
import { donorApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../api/client';

export default function AdminDonors() {
  const { toast } = useToast();
  const [group, setGroup] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [matches, setMatches] = useState(null);

  const { data, loading, error, refetch } = useApi(
    () => get('/donors', { params: { limit: 200, bloodGroup: group || undefined, city: city || undefined } }),
    [group, city]
  );

  const open = async (row) => {
    setSelected(row);
    setLoadingDetail(true);
    setMatches(null);
    try {
      const res = await donorApi.get(row._id);
      setDetail(res.data.data);
      if (res.data.data.bloodGroup) {
        try {
          const m = await donorApi.compatible(res.data.data.bloodGroup, { limit: 5 });
          setMatches(m.data.data);
        } catch { /* optional */ }
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  const toggleAvailability = async (row) => {
    try {
      await donorApi.update(row._id, { availability: row.availability === 'unavailable' ? 'available' : 'unavailable' });
      toast.success('Availability updated');
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const columns = [
    { key: 'name', label: 'Donor', render: (r) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-medical-100 text-xs font-bold text-medical-700">
          {(r.userId?.name || '?').charAt(0)}
        </span>
        <div>
          <p className="font-medium text-slate-800">{r.userId?.name || '—'}</p>
          <p className="text-xs text-slate-400">{r.userId?.email}</p>
        </div>
      </div>
    ) },
    { key: 'bloodGroup', label: 'Group', render: (r) => <BloodGroupTag group={r.bloodGroup} size="sm" /> },
    { key: 'city', label: 'City' },
    { key: 'eligibilityStatus', label: 'Eligibility', render: (r) => <StatusBadge value={r.dateEligible ? 'eligible' : r.eligibilityStatus} /> },
    { key: 'availability', label: 'Availability', render: (r) => <StatusBadge value={r.availability === 'available' ? 'available' : r.availability} /> },
    { key: 'totalDonations', label: 'Donations' },
    { key: 'rewardPoints', label: 'Points' },
    { key: 'lastDonationDate', label: 'Last Donation', render: (r) => r.lastDonationDate ? formatDate(r.lastDonationDate) : 'Never' },
    { key: 'actions', label: '', sortable: false, render: (r) => (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => open(r)} className="btn-secondary !px-2.5 !py-1 text-xs">View</button>
        <button onClick={() => toggleAvailability(r)} className="btn-ghost !px-2.5 !py-1 text-xs">
          {r.availability === 'unavailable' ? 'Enable' : 'Disable'}
        </button>
      </div>
    ) },
  ];

  const rows = (data?.data || []).map((d) => ({
    ...d,
    name: d.userId?.name,
    email: d.userId?.email,
  }));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Donor Management"
        subtitle={`${rows.length} donors · privacy-safe views with role-based access`}
        actions={<button onClick={refetch} className="btn-secondary">↻ Refresh</button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input !w-40" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All blood groups</option>
          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <input className="input !w-44" placeholder="Filter by city" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchKeys={['name', 'email', 'city', 'bloodGroup']}
        pageSize={12}
        onRowClick={open}
        emptyMessage="No donors match these filters"
      />

      <Modal
        open={Boolean(selected)}
        onClose={() => { setSelected(null); setDetail(null); }}
        title="Donor details"
        size="lg"
      >
        {loadingDetail ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />)}</div>
        ) : detail ? (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Name', detail.userId?.name],
                ['Email', detail.userId?.email],
                ['Phone', detail.userId?.phone],
                ['Blood group', detail.bloodGroup],
                ['City', detail.city],
                ['State', detail.state],
                ['Gender', detail.gender],
                ['Weight', detail.weight ? `${detail.weight} kg` : '—'],
                ['Total donations', detail.totalDonations],
                ['Reward points', detail.rewardPoints],
                ['Last donation', detail.lastDonationDate ? formatDate(detail.lastDonationDate) : 'Never'],
                ['Next eligible', detail.nextEligibleDate ? formatDate(detail.nextEligibleDate) : '—'],
                ['Eligibility', detail.eligibilityStatus],
                ['Availability', detail.availability],
                ['Notification consent', detail.notificationConsent ? 'Yes' : 'No'],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{v ?? '—'}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-medical-50 p-3 text-xs text-medical-700">
              📍 Location: {detail.latitude != null ? `${detail.latitude}, ${detail.longitude}` : 'not set'} — {detail.address || 'no address'}
            </div>

            {matches && matches.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-800">Also compatible with other {detail.bloodGroup} requests</p>
                <p className="text-xs text-slate-500">Top ranked matches for this donor&apos;s group:</p>
                <div className="mt-2 space-y-1.5">
                  {matches.slice(0, 3).map((m) => (
                    <div key={m.donorId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span>{m.name} — {m.bloodGroup}{m.distanceKm != null ? ` · ${m.distanceKm} km` : ''}</span>
                      <StatusBadge value={m.eligible ? 'eligible' : 'ineligible'} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="Could not load donor" />
        )}
      </Modal>
    </div>
  );
}