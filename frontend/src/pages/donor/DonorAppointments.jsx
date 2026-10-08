import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { appointmentApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState, EmptyState } from '../../components/ui/States';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/helpers';
import { ConfirmDialog } from '../../components/ui/Modal';

const LOCATIONS = [
  'City Blood Bank — Central',
  'Regional Blood Centre — North',
  'Mobile Collection Van — Downtown',
  'Hospital Blood Bank — General',
];

export default function DonorAppointments() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { appointmentDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), appointmentTime: '10:00' },
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await appointmentApi.list({ limit: 50 });
      setItems(res.data.data || []);
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
      await appointmentApi.create(values);
      toast.success('Appointment booked — confirmation sent');
      reset({ ...values, appointmentDate: values.appointmentDate });
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const doCancel = async () => {
    try {
      await appointmentApi.cancel(cancelTarget._id);
      toast.success('Appointment cancelled');
      setCancelTarget(null);
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const reschedule = async (appt) => {
    const date = window.prompt('New date (YYYY-MM-DD):', new Date(appt.appointmentDate).toISOString().slice(0, 10));
    if (!date) return;
    const time = window.prompt('New time (HH:MM):', appt.appointmentTime);
    if (!time) return;
    try {
      await appointmentApi.update(appt._id, { appointmentDate: date, appointmentTime: time });
      toast.success('Appointment rescheduled');
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  if (loading) return <LoadingScreen label="Loading appointments…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const upcoming = items.filter((a) => ['Pending', 'Confirmed'].includes(a.status) && new Date(a.appointmentDate) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const past = items.filter((a) => !upcoming.includes(a));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Donation Appointments" subtitle="Book, reschedule or cancel your donation visits" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SectionCard title="Book new appointment">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label" htmlFor="location">Blood bank / location *</label>
                <select id="location" className="input" {...register('location', { required: 'Location is required' })}>
                  <option value="">Select location…</option>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                {errors.location && <p className="field-error">{errors.location.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="appointmentDate">Date *</label>
                <input id="appointmentDate" type="date" min={new Date().toISOString().slice(0, 10)} className="input" {...register('appointmentDate', { required: 'Date is required' })} />
                {errors.appointmentDate && <p className="field-error">{errors.appointmentDate.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="appointmentTime">Time *</label>
                <input id="appointmentTime" type="time" className="input" {...register('appointmentTime', { required: 'Time is required' })} />
                {errors.appointmentTime && <p className="field-error">{errors.appointmentTime.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="notes">Notes</label>
                <textarea id="notes" rows={2} className="input" {...register('notes')} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? 'Booking…' : 'Book appointment'}
              </button>
              <p className="text-xs text-slate-400">Duplicate/conflicting slots are rejected by the server.</p>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title={`Upcoming (${upcoming.length})`}>
            {upcoming.length === 0 ? (
              <EmptyState icon="📅" title="No upcoming appointments" description="Book one using the form." />
            ) : (
              <div className="space-y-3">
                {upcoming.map((a) => (
                  <div key={a._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-medical-200 bg-medical-50/50 p-4">
                    <div>
                      <p className="font-semibold text-slate-800">{a.location}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(a.appointmentDate)} at {a.appointmentTime}
                      </p>
                      {a.notes && <p className="mt-1 text-xs text-slate-400">{a.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={a.status} />
                      <button onClick={() => reschedule(a)} className="btn-secondary !py-1.5 text-xs">Reschedule</button>
                      <button onClick={() => setCancelTarget(a)} className="btn-danger !py-1.5 text-xs">Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={`History (${past.length})`}>
            {past.length === 0 ? (
              <EmptyState icon="🗂️" title="No past appointments" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Date</th><th>Time</th><th>Location</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {past.map((a) => (
                      <tr key={a._id}>
                        <td>{formatDate(a.appointmentDate)}</td>
                        <td>{a.appointmentTime}</td>
                        <td>{a.location}</td>
                        <td><StatusBadge value={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={doCancel}
        title="Cancel appointment?"
        message={`This will cancel your appointment at ${cancelTarget?.location} on ${cancelTarget ? formatDate(cancelTarget.appointmentDate) : ''}.`}
        confirmLabel="Cancel appointment"
        danger
      />
    </div>
  );
}