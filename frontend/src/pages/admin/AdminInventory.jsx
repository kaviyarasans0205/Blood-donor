import { useState } from 'react';
import { useApi, get } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { inventoryApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, StatCard } from '../../components/ui/Cards';
import StatusBadge, { BloodGroupTag } from '../../components/ui/StatusBadge';
import DataTable from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';
import { BLOOD_GROUPS } from '../../services/bloodGroups';

const emptyForm = { bloodGroup: 'O+', units: 1, batchNumber: '', collectionDate: new Date().toISOString().slice(0, 10), expiryDate: new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10), location: '', notes: '' };

export default function AdminInventory() {
  const { toast } = useToast();
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [threshOpen, setThreshOpen] = useState(false);
  const [thresholds, setThresholds] = useState({});
  const [threshSaving, setThreshSaving] = useState(false);

  const list = useApi(() => get('/inventory', { params: { limit: 200, bloodGroup: group || undefined, status: status || undefined } }), [group, status]);
  const alerts = useApi(() => get('/inventory/alerts'));

  const refreshAll = () => { list.refetch(); alerts.refetch(); };

  const stock = list.data?.meta?.stockSummary || alerts.data?.stock || {};
  const total = list.data?.meta?.totalUnits ?? Object.values(stock).reduce((a, b) => a + b, 0);
  const lowStock = alerts.data?.lowStock || [];
  const expiring = alerts.data?.expiring || [];

  const submitAdd = async () => {
    setSaving(true);
    try {
      await inventoryApi.create(form);
      toast.success('Stock added');
      setAddOpen(false);
      setForm(emptyForm);
      refreshAll();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (mode) => {
    try {
      await inventoryApi.remove(deleteTarget._id, mode);
      toast.success(mode === 'consume' ? 'Stock consumed' : 'Stock discarded');
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const openThresholds = async () => {
    setThreshOpen(true);
    try {
      const res = await inventoryApi.getThresholds();
      setThresholds(res.data.data || {});
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const saveThresholds = async () => {
    setThreshSaving(true);
    try {
      await inventoryApi.setThresholds(thresholds);
      toast.success('Thresholds saved');
      setThreshOpen(false);
      refreshAll();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setThreshSaving(false);
    }
  };

  const columns = [
    { key: 'bloodGroup', label: 'Group', render: (r) => <BloodGroupTag group={r.bloodGroup} size="sm" /> },
    { key: 'units', label: 'Units' },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'location', label: 'Location' },
    { key: 'collectionDate', label: 'Collected', render: (r) => formatDate(r.collectionDate) },
    { key: 'expiryDate', label: 'Expiry', render: (r) => {
      const days = Math.ceil((new Date(r.expiryDate) - Date.now()) / 86400000);
      return (
        <div>
          <p>{formatDate(r.expiryDate)}</p>
          <p className={`text-xs ${days < 0 ? 'text-red-600 font-semibold' : days <= 7 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
            {days < 0 ? `expired ${Math.abs(days)}d ago` : `${days}d left`}
          </p>
        </div>
      );
    } },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { key: 'actions', label: '', sortable: false, render: (r) => (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setDeleteTarget(r)} className="btn-danger !px-2.5 !py-1 text-xs">Remove</button>
      </div>
    ) },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Blood Inventory"
        subtitle="Batch-level stock with expiry tracking and low-stock thresholds"
        actions={
          <>
            <button onClick={openThresholds} className="btn-secondary">⚙️ Thresholds</button>
            <button onClick={() => setAddOpen(true)} className="btn-primary">＋ Add stock</button>
          </>
        }
      />

      {/* Summary cards for all 8 groups */}
      <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {BLOOD_GROUPS.map((g) => {
          const units = stock[g] ?? 0;
          const thr = alerts.data?.thresholds?.[g];
          const isLow = thr != null && units < thr;
          return (
            <button
              key={g}
              onClick={() => setGroup(group === g ? '' : g)}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${group === g ? 'border-brand-500 bg-brand-50' : isLow ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-medical-300'}`}
            >
              <div className="flex items-center justify-between">
                <BloodGroupTag group={g} size="sm" />
                <span className={`text-xl font-extrabold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>{units}</span>
              </div>
              {isLow && <p className="mt-1 text-[10px] font-bold text-red-600">BELOW MIN {thr}</p>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <StatCard label="Total Units" value={total} sub="available, non-expired" icon="🩸" tone="danger" />
        <StatCard label="Expiring ≤ 7 days" value={expiring.reduce((s, b) => s + b.units, 0)} sub={`${expiring.length} batch(es)`} icon="⏳" tone={expiring.length ? 'warning' : 'success'} />
        <StatCard label="Low Stock Groups" value={lowStock.length} sub={lowStock.map((l) => l.bloodGroup).join(', ') || 'all healthy'} icon="📉" tone={lowStock.length ? 'danger' : 'success'} />
      </div>

      {(lowStock.length > 0 || expiring.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {lowStock.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">Critical: low stock</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lowStock.map((l) => (
                  <span key={l.bloodGroup} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                    {l.bloodGroup} — {l.units}/{l.threshold}
                  </span>
                ))}
              </div>
            </div>
          )}
          {expiring.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-800">Expiry warnings</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {expiring.slice(0, 8).map((b) => (
                  <span key={b.batchNumber} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                    {b.bloodGroup} {b.batchNumber} — {b.daysRemaining}d
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <select className="input !w-44" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All blood groups</option>
          {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="input !w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['available', 'reserved', 'expired', 'consumed', 'discarded'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={refreshAll} className="btn-secondary">↻ Refresh</button>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={list.data?.data || []}
          loading={list.loading}
          error={list.error}
          onRetry={list.refetch}
          searchKeys={['batchNumber', 'location', 'bloodGroup']}
          pageSize={12}
          emptyMessage="No inventory records"
        />
      </div>

      {/* Add stock modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add blood stock"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submitAdd} disabled={saving}>{saving ? 'Adding…' : 'Add stock'}</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Blood group *</label>
            <select className="input" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Units *</label>
            <input type="number" min="1" className="input" value={form.units} onChange={(e) => setForm({ ...form, units: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Batch number *</label>
            <input className="input" placeholder="e.g. BAT-2026-001" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">Location *</label>
            <input className="input" placeholder="Blood bank name" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Collection date *</label>
            <input type="date" className="input" value={form.collectionDate} onChange={(e) => setForm({ ...form, collectionDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Expiry date *</label>
            <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Thresholds modal */}
      <Modal
        open={threshOpen}
        onClose={() => setThreshOpen(false)}
        title="Low-stock thresholds"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setThreshOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveThresholds} disabled={threshSaving}>{threshSaving ? 'Saving…' : 'Save thresholds'}</button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-500">Alerts are raised automatically when available units fall below these values.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {BLOOD_GROUPS.map((g) => (
            <div key={g}>
              <label className="label">{g}</label>
              <input
                type="number"
                min="0"
                className="input"
                value={thresholds[g] ?? ''}
                onChange={(e) => setThresholds({ ...thresholds, [g]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove stock"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn-medical" onClick={() => doDelete('consume')}>Mark consumed</button>
            <button className="btn-secondary" onClick={() => doDelete('discard')}>Mark discarded</button>
            <button className="btn-danger" onClick={() => doDelete('hard')}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Batch <strong>{deleteTarget?.batchNumber}</strong> ({deleteTarget?.bloodGroup}, {deleteTarget?.units} units).
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
          <li><strong>Consumed</strong> — units were used for transfusion.</li>
          <li><strong>Discarded</strong> — units were wasted/expired.</li>
          <li><strong>Delete</strong> — removes the record entirely (audited).</li>
        </ul>
      </Modal>
    </div>
  );
}