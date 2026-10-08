import { useState, useEffect } from 'react';
import { useApi, get } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { emergencyApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard, StatCard } from '../../components/ui/Cards';
import { EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import DataTable from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { formatDateTime, formatDate } from '../../utils/helpers';

export default function AdminEmergencies() {
  const { toast } = useToast();
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('queue'); // queue | table
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fulfillUnits, setFulfillUnits] = useState('');
  const [overridePriority, setOverridePriority] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const queue = useApi(() => get('/emergency-requests/priority-queue', { params: { limit: 100, includeResolved: 'false' } }));
  const list = useApi(
    () => get('/emergency-requests', { params: { limit: 200, priority: priority || undefined, status: status || undefined } }),
    [priority, status]
  );

  const refreshAll = () => { queue.refetch(); list.refetch(); };

  useEffect(() => {
    const t = setInterval(() => { queue.refetch(); list.refetch(); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (row) => {
    setSelected(row);
    setMatches(null);
    setFulfillUnits('');
    setOverridePriority(row.priority);
    setOverrideReason('');
    try {
      const res = await emergencyApi.get(row._id);
      setSelected(res.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const runMatch = async (notify) => {
    setBusy(true);
    try {
      const res = await emergencyApi.match(selected._id, { notify: notify ? 'true' : 'false', radiusKm: 100 });
      setMatches(res.data.data.matches);
      toast.success(`${res.data.data.matches.length} matches found${notify ? `, ${res.data.data.notified} notified` : ''}`);
      refreshAll();
      const d = await emergencyApi.get(selected._id);
      setSelected(d.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const fulfill = async () => {
    setBusy(true);
    try {
      const res = await emergencyApi.fulfill(selected._id, { units: Number(fulfillUnits || selected.requiredUnits - selected.fulfilledUnits) });
      toast.success('Inventory allocated to request');
      setSelected(res.data.data);
      refreshAll();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const applyOverride = async () => {
    setBusy(true);
    try {
      await emergencyApi.update(selected._id, { priority: overridePriority, priorityOverrideReason: overrideReason });
      toast.success(`Priority overridden to ${overridePriority}`);
      refreshAll();
      const d = await emergencyApi.get(selected._id);
      setSelected(d.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setStatusReq = async (newStatus) => {
    setBusy(true);
    try {
      await emergencyApi.update(selected._id, { status: newStatus });
      toast.success(`Status → ${newStatus}`);
      refreshAll();
      setSelected({ ...selected, status: newStatus });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const q = queue.data?.data || [];
  const rows = list.data?.data || [];

  const columns = [
    { key: 'createdAt', label: 'Created', render: (r) => <span className="text-xs">{formatDateTime(r.createdAt)}</span> },
    { key: 'priority', label: 'Priority', render: (r) => <StatusBadge value={r.priority} dot /> },
    { key: 'bloodGroup', label: 'Group', render: (r) => <BloodGroupTag group={r.bloodGroup} size="sm" /> },
    { key: 'hospital', label: 'Hospital' },
    { key: 'patientName', label: 'Patient' },
    { key: 'requiredUnits', label: 'Units', render: (r) => `${r.fulfilledUnits}/${r.requiredUnits}` },
    { key: 'requiredAt', label: 'Required By', render: (r) => formatDate(r.requiredAt) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'actions', label: '', sortable: false, render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); open(r); }} className="btn-secondary !px-2.5 !py-1 text-xs">Open</button>
    ) },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Emergency Requests"
        subtitle="Live priority queue — auto-refreshes every 30 seconds"
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setView('queue')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'queue' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>Priority Queue</button>
            <button onClick={() => setView('table')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'table' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>Table</button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Critical (open)" value={(list.data?.data || []).filter((r) => r.priority === 'CRITICAL' && ['Pending', 'Matching'].includes(r.status)).length} sub="immediate" icon="🚨" tone="danger" />
        <StatCard label="Urgent (open)" value={(list.data?.data || []).filter((r) => r.priority === 'URGENT' && ['Pending', 'Matching'].includes(r.status)).length} sub="within hours" icon="⚠️" tone="warning" />
        <StatCard label="Normal (open)" value={(list.data?.data || []).filter((r) => r.priority === 'NORMAL' && ['Pending', 'Matching'].includes(r.status)).length} sub="planned" icon="📋" tone="medical" />
        <StatCard label="Total tracked" value={list.data?.meta?.total ?? rows.length} sub="all requests" icon="📊" />
      </div>

      {view === 'queue' ? (
        <div className="mt-6">
          <SectionCard title="🚨 Emergency priority queue" subtitle="CRITICAL → URGENT → NORMAL; ties broken by earliest request">
            {queue.loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}</div>
            ) : q.length === 0 ? (
              <EmptyState icon="✅" title="No active emergency requests" description="The queue is clear." />
            ) : (
              <div className="space-y-2">
                {q.map((r) => (
                  <button
                    key={r._id}
                    onClick={() => open(r)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      r.priority === 'CRITICAL' ? 'border-red-300 bg-red-50/60 hover:bg-red-50'
                        : r.priority === 'URGENT' ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-50'
                        : 'border-slate-200 bg-white hover:border-medical-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                        {r.queuePosition}
                      </span>
                      <StatusBadge value={r.priority} dot />
                      <BloodGroupTag group={r.bloodGroup} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{r.hospital}</p>
                        <p className="text-xs text-slate-500">
                          {r.patientName} · {r.requiredUnits} units · req. {formatDate(r.requiredAt)}
                          {r.distanceKm != null ? ` · ${r.distanceKm} km` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={r.status} />
                      <span className="text-xs text-slate-400">score {r.priorityScore}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <select className="input !w-44" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="URGENT">URGENT</option>
              <option value="NORMAL">NORMAL</option>
            </select>
            <select className="input !w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['Pending', 'Matching', 'Fulfilled', 'Partially Fulfilled', 'Cancelled', 'Expired'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={refreshAll} className="btn-secondary">↻ Refresh</button>
          </div>
          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={rows}
              loading={list.loading}
              error={list.error}
              onRetry={list.refetch}
              searchKeys={['hospital', 'patientName', 'bloodGroup']}
              pageSize={12}
              onRowClick={open}
              emptyMessage="No emergency requests match"
            />
          </div>
        </>
      )}

      {/* Detail modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => { setSelected(null); setMatches(null); }}
        title="Emergency request"
        size="lg"
        footer={
          selected && (
            <>
              <button className="btn-secondary" disabled={busy} onClick={() => setStatusReq('Cancelled')}>Cancel</button>
              <button className="btn-secondary" disabled={busy} onClick={() => runMatch(false)}>Find matches</button>
              <button className="btn-medical" disabled={busy} onClick={() => runMatch(true)}>Match &amp; notify</button>
              <button className="btn-primary" disabled={busy} onClick={fulfill}>Allocate stock</button>
            </>
          )
        }
      >
        {selected && (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Priority', <StatusBadge key="p" value={selected.priority} />],
                ['Status', <StatusBadge key="s" value={selected.status} />],
                ['Score', selected.priorityScore],
                ['Units', `${selected.fulfilledUnits}/${selected.requiredUnits}`],
                ['Blood', <BloodGroupTag key="b" group={selected.bloodGroup} size="sm" />],
                ['Available stock', selected.availableStock],
                ['Required by', formatDate(selected.requiredAt)],
                ['Created', formatDateTime(selected.createdAt)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{l}</p>
                  <div className="mt-1 text-sm font-medium text-slate-800">{v}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p><strong>Patient:</strong> {selected.patientName} · <strong>Hospital:</strong> {selected.hospital} · <strong>Contact:</strong> {selected.contactNumber}</p>
              {selected.address && <p className="mt-1"><strong>Address:</strong> {selected.address}</p>}
              {selected.notes && <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{selected.notes}</p>}
            </div>

            {/* Priority override (admin only, this page is admin-only) */}
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Priority override</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <select className="input !w-40" value={overridePriority} onChange={(e) => setOverridePriority(e.target.value)}>
                  {['CRITICAL', 'URGENT', 'NORMAL'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input className="input !flex-1" placeholder="Reason for override" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                <button className="btn-secondary" disabled={busy || overridePriority === selected.priority} onClick={applyOverride}>Apply</button>
              </div>
              {selected.priorityOverrideBy && (
                <p className="mt-2 text-xs text-amber-700">Previously overridden: {selected.priorityOverrideReason}</p>
              )}
            </div>

            {/* Allocate */}
            <div className="mt-4 rounded-lg border border-medical-200 bg-medical-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-medical-800">Allocate from inventory (FEFO)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="number" min="1" className="input !w-32" placeholder="Units" value={fulfillUnits} onChange={(e) => setFulfillUnits(e.target.value)} />
                <span className="text-xs text-slate-500">Available: {selected.availableStock} units of {selected.bloodGroup}</span>
              </div>
            </div>

            {/* Matches */}
            {(matches || selected.matchedDonors?.length > 0) && (
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-800">Matched donors</p>
                {matches && matches.length > 0 ? (
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto scrollbar-thin">
                    {matches.slice(0, 15).map((m, i) => (
                      <div key={m.donorId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{m.name}</p>
                            <p className="text-xs text-slate-500">{m.bloodGroup}{m.distanceKm != null ? ` · ${m.distanceKm} km` : ''} · last donation {m.lastDonationDate ? formatDate(m.lastDonationDate) : 'never'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={m.eligible ? 'eligible' : 'ineligible'} />
                          <span className="text-xs text-slate-400">{m.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {selected.matchedDonors.map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span>Donor #{i + 1}{m.distanceKm != null ? ` — ${m.distanceKm} km` : ''}</span>
                        <StatusBadge value={m.response || 'pending'} />
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">Contact details are shared only with authorized personnel for coordination.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}