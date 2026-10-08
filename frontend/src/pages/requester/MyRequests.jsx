import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { emergencyApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { Modal } from '../../components/ui/Modal';

export default function MyRequests() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState(null);
  const [matching, setMatching] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await emergencyApi.list({ limit: 100 });
      setList(res.data.data || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (id) openDetail(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openDetail = async (reqId) => {
    setDetailLoading(true);
    try {
      const res = await emergencyApi.get(reqId);
      setSelected(res.data.data);
      navigate(`/requester/requests/${reqId}`, { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const runMatch = async () => {
    setMatching(true);
    try {
      const res = await emergencyApi.match(selected._id, { notify: 'true' });
      setMatches(res.data.data.matches);
      toast.success(`Found ${res.data.data.matches.length} matches — ${res.data.data.notified} notified`);
      const d = await emergencyApi.get(selected._id);
      setSelected(d.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setMatching(false);
    }
  };

  const cancelRequest = async () => {
    try {
      await emergencyApi.update(selected._id, { status: 'Cancelled' });
      toast.success('Request cancelled');
      setSelected(null);
      navigate('/requester/requests');
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  if (loading) return <LoadingScreen label="Loading requests…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const open = list.filter((r) => ['Pending', 'Matching', 'Partially Fulfilled'].includes(r.status));
  const closed = list.filter((r) => !open.includes(r));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Emergency Requests"
        subtitle="Track status, run donor matching and manage open requests"
        actions={<button onClick={() => navigate('/requester/new-request')} className="btn-danger">🚨 New Request</button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={`Open (${open.length})`}>
          {open.length === 0 ? (
            <EmptyState icon="✅" title="No open requests" description="Create one when your facility needs blood." />
          ) : (
            <div className="space-y-3">
              {open.map((r) => (
                <button
                  key={r._id}
                  onClick={() => openDetail(r._id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${selected?._id === r._id ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge value={r.priority} dot />
                      <BloodGroupTag group={r.bloodGroup} size="sm" />
                      <span className="text-sm font-semibold text-slate-800">{r.hospital}</span>
                    </div>
                    <StatusBadge value={r.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {r.patientName} · {r.fulfilledUnits}/{r.requiredUnits} units · required by {formatDate(r.requiredAt)} · created {formatDateTime(r.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title={`History (${closed.length})`}>
          {closed.length === 0 ? (
            <EmptyState icon="🗂️" title="No completed requests" />
          ) : (
            <div className="space-y-2">
              {closed.slice(0, 12).map((r) => (
                <button key={r._id} onClick={() => openDetail(r._id)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={r.priority} />
                    <span className="text-sm text-slate-700">{r.hospital} — {r.bloodGroup}</span>
                  </div>
                  <StatusBadge value={r.status} />
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Detail modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => { setSelected(null); setMatches(null); navigate('/requester/requests'); }}
        title="Emergency request details"
        size="lg"
        footer={
          selected && (
            <>
              {!['Fulfilled', 'Cancelled', 'Expired'].includes(selected.status) && (
                <button onClick={cancelRequest} className="btn-secondary">Cancel request</button>
              )}
              <button onClick={runMatch} disabled={matching} className="btn-medical">
                {matching ? 'Matching…' : '🎯 Find & notify donors'}
              </button>
            </>
          )
        }
      >
        {detailLoading || !selected ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />)}</div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                ['Priority', <StatusBadge key="p" value={selected.priority} />],
                ['Status', <StatusBadge key="s" value={selected.status} />],
                ['Blood group', <BloodGroupTag key="b" group={selected.bloodGroup} size="sm" />],
                ['Units', `${selected.fulfilledUnits} / ${selected.requiredUnits}`],
                ['Patient', selected.patientName],
                ['Hospital', selected.hospital],
                ['Contact', selected.contactNumber],
                ['Required by', formatDate(selected.requiredAt)],
                ['Created', formatDateTime(selected.createdAt)],
                ['Priority score', selected.priorityScore],
                ['Stock available', selected.availableStock],
                ['Matched donors', selected.matchedDonors?.length || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
                </div>
              ))}
            </div>

            {selected.notes && (
              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{selected.notes}</p>
              </div>
            )}

            {matches && (
              <div className="mt-5">
                <p className="text-sm font-bold text-slate-800">Matching donors ({matches.length})</p>
                {matches.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No compatible donors found in the search radius.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {matches.slice(0, 10).map((m, i) => (
                      <div key={m.donorId} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{i + 1}</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                            <p className="text-xs text-slate-500">{m.bloodGroup}{m.distanceKm != null ? ` · ${m.distanceKm} km` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={m.eligible ? 'eligible' : 'ineligible'} />
                          <span className="text-xs text-slate-400">score {m.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-slate-400">
                  Donor contact details are only shared with authorized staff after a request is accepted. Exact addresses
                  are never displayed.
                </p>
              </div>
            )}

            {selected.matchedDonors?.length > 0 && !matches && (
              <div className="mt-4 rounded-lg bg-medical-50 p-3 text-xs text-medical-700">
                {selected.matchedDonors.length} donor(s) already matched. Click “Find & notify donors” to re-run matching.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}