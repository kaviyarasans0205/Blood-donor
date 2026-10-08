import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useToast } from '../../context/ToastContext';
import { emergencyApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { BLOOD_GROUPS } from '../../services/bloodGroups';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { getGeoLocation } from '../../utils/helpers';

export default function NewEmergencyRequest() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [classification, setClassification] = useState(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      emergencyLevel: 'urgent',
      requiredUnits: 2,
      requiredAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 16),
    },
  });

  const level = watch('emergencyLevel');
  const group = watch('bloodGroup');

  const fillLocation = async () => {
    setGeoLoading(true);
    try {
      const { latitude, longitude } = await getGeoLocation();
      setValue('latitude', latitude, { shouldValidate: true });
      setValue('longitude', longitude, { shouldValidate: true });
      toast.success('Location captured');
    } catch {
      toast.error('Could not read location');
    } finally {
      setGeoLoading(false);
    }
  };

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const res = await emergencyApi.create(values);
      const created = res.data.data;
      setClassification({ priority: created.priority, score: created.priorityScore });
      toast.success(`Request created with priority ${created.priority}`);
      navigate('/requester/requests');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="New Emergency Blood Request" subtitle="Priority is classified automatically — authorized staff can override later" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Request details">
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="patientName">Patient name *</label>
                <input id="patientName" className="input" {...register('patientName', { required: 'Required', minLength: { value: 2, message: 'Too short' } })} />
                {errors.patientName && <p className="field-error">{errors.patientName.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="hospital">Hospital *</label>
                <input id="hospital" className="input" {...register('hospital', { required: 'Required' })} />
                {errors.hospital && <p className="field-error">{errors.hospital.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="contactNumber">Contact number *</label>
                <input id="contactNumber" className="input" {...register('contactNumber', { required: 'Required', pattern: { value: /^[0-9+\-\s()]{7,20}$/, message: 'Invalid phone' } })} />
                {errors.contactNumber && <p className="field-error">{errors.contactNumber.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="bloodGroup">Blood group *</label>
                <select id="bloodGroup" className="input" {...register('bloodGroup', { required: 'Required' })}>
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {errors.bloodGroup && <p className="field-error">{errors.bloodGroup.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="requiredUnits">Units required *</label>
                <input id="requiredUnits" type="number" min="1" max="100" className="input" {...register('requiredUnits', { required: true, min: { value: 1, message: 'Min 1' }, max: { value: 100, message: 'Max 100' } })} />
                {errors.requiredUnits && <p className="field-error">{errors.requiredUnits.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="requiredAt">Required by *</label>
                <input id="requiredAt" type="datetime-local" className="input" {...register('requiredAt', { required: 'Required' })} />
                {errors.requiredAt && <p className="field-error">{errors.requiredAt.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="emergencyLevel">Emergency level *</label>
                <select id="emergencyLevel" className="input" {...register('emergencyLevel')}>
                  <option value="critical">CRITICAL — life-threatening</option>
                  <option value="urgent">URGENT — within hours</option>
                  <option value="normal">NORMAL — planned</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="address">Address</label>
                <input id="address" className="input" {...register('address')} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Coordinates *</label>
                <div className="flex gap-2">
                  <input type="number" step="any" className="input" placeholder="Latitude" {...register('latitude', { required: 'Required', min: -90, max: 90 })} />
                  <input type="number" step="any" className="input" placeholder="Longitude" {...register('longitude', { required: 'Required', min: -180, max: 180 })} />
                </div>
                <button type="button" onClick={fillLocation} disabled={geoLoading} className="btn-ghost mt-1.5 !py-1 text-xs">
                  {geoLoading ? 'Locating…' : '📍 Use my current location'}
                </button>
                {(errors.latitude || errors.longitude) && <p className="field-error">Valid coordinates required</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="notes">Medical / emergency notes</label>
                <textarea id="notes" rows={3} className="input" placeholder="e.g. trauma case, severe haemorrhage, surgery scheduled…" {...register('notes')} />
                <p className="mt-1 text-xs text-slate-400">Clinical keywords raise the priority score automatically.</p>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-danger min-w-[200px]" disabled={submitting}>
                  {submitting ? 'Submitting…' : '🚨 Submit Request'}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Priority preview">
            <div className={`rounded-xl p-4 text-sm ${level === 'critical' ? 'bg-red-50 text-red-700' : level === 'urgent' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
              <p className="font-bold">{level.toUpperCase()}</p>
              <p className="mt-1 text-xs leading-relaxed">
                {level === 'critical'
                  ? 'Immediate / life-threatening requirement. Served first in the queue.'
                  : level === 'urgent'
                    ? 'Required within a short period. Served after CRITICAL items.'
                    : 'Planned / non-immediate requirement. Served last in the queue.'}
              </p>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-slate-500">
              <li>• Time until required adds 0–60 points</li>
              <li>• Selected level adds 0–50 points</li>
              <li>• Clinical keywords in notes add up to 30 points</li>
              <li>• Score ≥ 80 or level = critical → <strong>CRITICAL</strong></li>
            </ul>
          </SectionCard>

          <SectionCard title="What happens next">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Inventory for {group || 'the selected group'} is checked</li>
              <li>Compatible, eligible donors are found &amp; ranked by distance</li>
              <li>Nearby donors are notified (in-app / email / SMS)</li>
              <li>You can track progress and matched donors on the request page</li>
            </ol>
          </SectionCard>

          {classification && (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
              Created with priority <strong>{classification.priority}</strong> (score {classification.score})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}