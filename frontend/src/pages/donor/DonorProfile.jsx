import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { donorApi } from '../../services/api';
import { extractErrorMessage } from '../../api/client';
import { BLOOD_GROUPS } from '../../services/bloodGroups';
import { PageHeader, SectionCard } from '../../components/ui/Cards';
import { LoadingScreen, ErrorState } from '../../components/ui/States';
import { getGeoLocation } from '../../utils/helpers';
import api from '../../api/client';

export default function DonorProfile() {
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [donorId, setDonorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/auth/me');
      const p = res.data.data.profile;
      if (!p) {
        setError('No donor profile found for this account.');
        return;
      }
      setDonorId(p._id);
      reset({
        name: res.data.data.user.name,
        phone: res.data.data.user.phone,
        email: res.data.data.user.email,
        dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().slice(0, 10) : '',
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        weight: p.weight ?? '',
        address: p.address || '',
        city: p.city || '',
        state: p.state || '',
        pincode: p.pincode || '',
        latitude: p.latitude ?? '',
        longitude: p.longitude ?? '',
        notificationConsent: p.notificationConsent,
        availability: p.availability,
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const fillLocation = async () => {
    setGeoLoading(true);
    try {
      const { latitude, longitude } = await getGeoLocation();
      setValue('latitude', latitude, { shouldDirty: true });
      setValue('longitude', longitude, { shouldDirty: true });
      toast.success('Location captured');
    } catch {
      toast.error('Could not read location');
    } finally {
      setGeoLoading(false);
    }
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      await donorApi.update(donorId, values);
      toast.success('Profile updated');
      await refreshProfile();
      await load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen label="Loading profile…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Profile" subtitle="Keep your details, location and availability up to date for accurate matching" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" className="input" {...register('name', { required: 'Name is required' })} />
                {errors.name && <p className="field-error">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })} />
                {errors.email && <p className="field-error">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="phone">Phone</label>
                <input id="phone" className="input" {...register('phone', { required: 'Phone is required', pattern: { value: /^[0-9+\-\s()]{7,20}$/, message: 'Invalid phone' } })} />
                {errors.phone && <p className="field-error">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="dateOfBirth">Date of birth</label>
                <input id="dateOfBirth" type="date" className="input" {...register('dateOfBirth', { required: 'Date of birth required' })} />
                {errors.dateOfBirth && <p className="field-error">{errors.dateOfBirth.message}</p>}
              </div>
              <div>
                <label className="label" htmlFor="gender">Gender</label>
                <select id="gender" className="input" {...register('gender')}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="bloodGroup">Blood group</label>
                <select id="bloodGroup" className="input" {...register('bloodGroup', { required: 'Blood group required' })}>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="weight">Weight (kg)</label>
                <input id="weight" type="number" className="input" {...register('weight', { min: { value: 20, message: 'Too low' }, max: { value: 250, message: 'Too high' } })} />
                {errors.weight && <p className="field-error">{errors.weight.message}</p>}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Location" subtitle="Used to calculate distance to emergency requests">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="address">Address</label>
                <input id="address" className="input" {...register('address')} />
              </div>
              <div>
                <label className="label" htmlFor="city">City</label>
                <input id="city" className="input" {...register('city')} />
              </div>
              <div>
                <label className="label" htmlFor="state">State</label>
                <input id="state" className="input" {...register('state')} />
              </div>
              <div>
                <label className="label" htmlFor="pincode">Pincode</label>
                <input id="pincode" className="input" {...register('pincode', { pattern: { value: /^[0-9]{6}$/, message: '6 digits' } })} />
                {errors.pincode && <p className="field-error">{errors.pincode.message}</p>}
              </div>
              <div>
                <label className="label">Coordinates</label>
                <div className="flex gap-2">
                  <input type="number" step="any" className="input" placeholder="Lat" {...register('latitude', { min: -90, max: 90 })} />
                  <input type="number" step="any" className="input" placeholder="Lng" {...register('longitude', { min: -180, max: 180 })} />
                </div>
                <button type="button" onClick={fillLocation} disabled={geoLoading} className="btn-ghost mt-1.5 !py-1 text-xs">
                  {geoLoading ? 'Locating…' : '📍 Use my current location'}
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" {...register('notificationConsent')} />
                <span className="text-sm text-slate-700">I consent to receive emergency &amp; appointment notifications</span>
              </label>
              <div>
                <label className="label" htmlFor="availability">Donation availability</label>
                <select id="availability" className="input" {...register('availability')}>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Your exact address and phone number are never shown publicly — only authorized roles see them for
              coordination purposes.
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => load()} className="btn-secondary">Reset</button>
          <button type="submit" className="btn-primary min-w-[140px]" disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}