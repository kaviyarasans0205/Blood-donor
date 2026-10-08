import { useState } from 'react';
import { useApi, get } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { appointmentApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, StatCard } from '../../components/ui/Cards';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import DataTable from '../../components/ui/DataTable';
import { formatDate } from '../../utils/helpers';

const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-show'];

export default function AdminAppointments() {
  const { toast } = useToast();
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, loading, error, refetch } = useApi(
    () => get('/appointments', {
      params: {
        limit: 200,
        all: 'true',
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    }),
    [status, from, to]
  );

  const changeStatus = async (row, newStatus) => {
    try {
      await appointmentApi.update(row._id, { status: newStatus });
      toast.success(`Status → ${newStatus}${newStatus === 'Completed' ? ' · donation & rewards recorded' : ''}`);
      await refetch();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const rows = data?.data || [];
  const counts = STATUSES.map((s) => ({ status: s, count: rows.filter((r) => r.status === s).length }));

  const columns = [
    { key: 'appointmentDate', label: 'Date', render: (r) => formatDate(r.appointmentDate) },
    { key: 'appointmentTime', label: 'Time' },
    { key: 'location', label: 'Location' },
    { key: 'bloodGroup', label: 'Donor Group', render: (r) => r.donorId?.bloodGroup ? <BloodGroupTag group={r.donorId.bloodGroup} size="sm" /> : '—' },
    { key: 'city', label: 'City', render: (r) => r.donorId?.city || '—' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'actions', label: 'Actions', sortable: false, render: (r) => (
      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {r.status === 'Pending' && <button onClick={() => changeStatus(r, 'Confirmed')} className="btn-secondary !px-2 !py-1 text-[11px]">Confirm</button>}
        {['Pending', 'Confirmed'].includes(r.status) && <button onClick={() => changeStatus(r, 'Completed')} className="btn-medical !px-2 !py-1 text-[11px]">Complete</button>}
        {['Pending', 'Confirmed'].includes(r.status) && <button onClick={() => changeStatus(r, 'No-show')} className="btn-secondary !px-2 !py-1 text-[11px]">No-show</button>}
        {!['Cancelled', 'Completed'].includes(r.status) && <button onClick={() => changeStatus(r, 'Cancelled')} className="btn-danger !px-2 !py-1 text-[11px]">Cancel</button>}
      </div>
    ) },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Appointments"
        subtitle="Confirm, complete or cancel donation visits — completing records a donation + rewards"
        actions={<button onClick={refetch} className="btn-secondary">↻ Refresh</button>}
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map((c) => (
          <StatCard key={c.status} label={c.status} value={c.count} icon="📅" tone={c.status === 'Cancelled' ? 'danger' : c.status === 'Completed' ? 'success' : 'default'} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <select className="input !w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="input !w-44" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className="input !w-44" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={refetch}
          searchKeys={['location', 'bloodGroup', 'city']}
          pageSize={12}
          emptyMessage="No appointments match"
        />
      </div>
    </div>
  );
}