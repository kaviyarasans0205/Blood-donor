import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { emergencyApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { BLOOD_GROUPS } from '../../services/bloodGroups';
import { getGeoLocation } from '../../utils/helpers';

export default function EmergencyRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      emergencyLevel: 'urgent',
      requiredUnits: 1,
      requiredAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 16),
    },
  });

  const fillLocation = async () => {
    setGeoLoading(true);
    try {
      const { latitude, longitude } = await getGeoLocation();
      setValue('latitude', latitude, { shouldValidate: true });
      setValue('longitude', longitude, { shouldValidate: true });
      toast.success('Location captured');
    } catch {
      toast.error('Could not read location — enter coordinates manually');
    } finally {
      setGeoLoading(false);
    }
  };

  const onSubmit = async (values) => {
    if (!user) {
      toast.info('Please sign in to submit an emergency request');
      navigate('/login', { state: { from: '/emergency' } });
      return;
    }
    setSubmitting(true);
    try {
      const res = await emergencyApi.create(values);
      toast.success(`Request created — priority: ${res.data.data.priority}`);
      navigate(user.role === 'admin' ? '/admin/emergencies' : '/requester/requests');
    } catch (err) {
      if (err.status === 401) {
        toast.info('Please sign in to submit this request');
        navigate('/login', { state: { from: '/emergency' } });
      } else {
        toast.error(extractErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const level = watch('emergencyLevel');

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
          🚨 Emergency
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Request blood in an emergency</h1>
        <p className="mx-auto mt-2 max-w-2xl text-slate-500">
          Priority is classified automatically from urgency, required time and clinical notes. Compatible, eligible
          donors near the location are matched and notified.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="patientName">Patient name *</label>
            <input id="patientName" className="input" {...register('patientName', { required: 'Patient name is required', minLength: { value: 2, message: 'Too short' } })} />
            {errors.patientName && <p className="field-error">{errors.patientName.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="hospital">Hospital / facility *</label>
            <input id="hospital" className="input" {...register('hospital', { required: 'Hospital is required' })} />
            {errors.hospital && <p className="field-error">{errors.hospital.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="contactNumber">Contact number *</label>
            <input id="contactNumber" className="input" placeholder="+91 98765 43210" {...register('contactNumber', { required: 'Contact number is required', pattern: { value: /^[0-9+\-\s()]{7,20}$/, message: 'Invalid phone number' } })} />
            {errors.contactNumber && <p className="field-error">{errors.contactNumber.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="bloodGroup">Blood group *</label>
            <select id="bloodGroup" className="input" {...register('bloodGroup', { required: 'Blood group is required' })}>
              <option value="">Select blood group…</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {errors.bloodGroup && <p className="field-error">{errors.bloodGroup.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="requiredUnits">Units required *</label>
            <input id="requiredUnits" type="number" min="1" max="100" className="input" {...register('requiredUnits', { required: true, min: { value: 1, message: 'Min 1 unit' }, max: { value: 100, message: 'Max 100 units' } })} />
            {errors.requiredUnits && <p className="field-error">{errors.requiredUnits.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="requiredAt">Required by *</label>
            <input id="requiredAt" type="datetime-local" className="input" {...register('requiredAt', { required: 'Required time is needed' })} />
            {errors.requiredAt && <p className="field-error">{errors.requiredAt.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="emergencyLevel">Emergency level *</label>
            <select id="emergencyLevel" className="input" {...register('emergencyLevel')}>
              <option value="critical">CRITICAL — life-threatening, immediate</option>
              <option value="urgent">URGENT — required within hours</option>
              <option value="normal">NORMAL — planned requirement</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="address">Location / address</label>
            <input id="address" className="input" placeholder="Hospital address" {...register('address')} />
          </div>
          <div>
            <label className="label">Coordinates *</label>
            <div className="flex gap-2">
              <input id="latitude" type="number" step="any" className="input" placeholder="Latitude" {...register('latitude', { required: 'Required', min: -90, max: 90 })} />
              <input id="longitude" type="number" step="any" className="input" placeholder="Longitude" {...register('longitude', { required: 'Required', min: -180, max: 180 })} />
            </div>
            <button type="button" onClick={fillLocation} disabled={geoLoading} className="btn-ghost mt-2 !py-1.5 text-xs">
              {geoLoading ? 'Locating…' : '📍 Use my current location'}
            </button>
            {(errors.latitude || errors.longitude) && <p className="field-error">Valid coordinates are required</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Medical / emergency notes</label>
            <textarea id="notes" rows={3} className="input" placeholder="Describe the situation — e.g. road accident, severe bleeding, ICU transfusion…" {...register('notes')} />
          </div>
        </div>

        <div className={`mt-5 rounded-xl p-4 text-sm ${level === 'critical' ? 'bg-red-50 text-red-700' : level === 'urgent' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
          <strong>{level.toUpperCase()}</strong> selected — the system will compute a priority score from urgency
          indicators and required time. Authorized staff can override priority afterwards.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {!user && 'You will be asked to sign in before submitting.'} Donor phone numbers and exact addresses are
            never exposed publicly.
          </p>
          <button type="submit" className="btn-danger min-w-[180px]" disabled={submitting}>
            {submitting ? 'Submitting…' : '🚨 Submit Emergency Request'}
          </button>
        </div>
      </form>
    </div>
  );
}