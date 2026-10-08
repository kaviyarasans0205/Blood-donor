import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../api/client';
import { BLOOD_GROUPS } from '../../services/bloodGroups';
import { getGeoLocation } from '../../utils/helpers';

export default function Register() {
  const { register: signup } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { role: 'donor', gender: 'male' },
  });

  const role = watch('role');

  const fillLocation = async () => {
    setGeoLoading(true);
    try {
      const { latitude, longitude } = await getGeoLocation();
      setValue('latitude', latitude);
      setValue('longitude', longitude);
      toast.success('Location captured');
    } catch {
      toast.error('Could not read location — you can enter coordinates manually');
    } finally {
      setGeoLoading(false);
    }
  };

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const user = await signup(values);
      toast.success('Account created — welcome aboard!');
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'requester') navigate('/requester/dashboard');
      else navigate('/donor/dashboard');
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl text-white">🩸</span>
            <span className="text-xl font-extrabold text-white">LifeLine</span>
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Join as a blood donor or register your hospital</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl bg-white p-7 shadow-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="role">I am registering as *</label>
              <select id="role" className="input" {...register('role')}>
                <option value="donor">Blood donor</option>
                <option value="requester">Hospital / Requester</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full name *</label>
              <input id="name" className="input" {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="email">Email *</label>
              <input id="email" type="email" className="input" {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })} />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="phone">Phone *</label>
              <input id="phone" className="input" placeholder="+91 98765 43210" {...register('phone', { required: 'Phone is required', pattern: { value: /^[0-9+\-\s()]{7,20}$/, message: 'Invalid phone' } })} />
              {errors.phone && <p className="field-error">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="label" htmlFor="password">Password *</label>
              <input id="password" type="password" className="input" placeholder="Min 8 characters" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })} />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            {role === 'donor' && (
              <div>
                <label className="label" htmlFor="bloodGroup">Blood group *</label>
                <select id="bloodGroup" className="input" {...register('bloodGroup', { required: role === 'donor' ? 'Blood group is required' : false })}>
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {errors.bloodGroup && <p className="field-error">{errors.bloodGroup.message}</p>}
              </div>
            )}

            {role === 'donor' && (
              <>
                <div>
                  <label className="label" htmlFor="dateOfBirth">Date of birth *</label>
                  <input id="dateOfBirth" type="date" className="input" {...register('dateOfBirth', { required: 'Date of birth is required' })} />
                  {errors.dateOfBirth && <p className="field-error">{errors.dateOfBirth.message}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="gender">Gender *</label>
                  <select id="gender" className="input" {...register('gender')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="weight">Weight (kg)</label>
                  <input id="weight" type="number" className="input" placeholder="Minimum 50 kg for donation" {...register('weight', { min: { value: 20, message: 'Too low' }, max: { value: 250, message: 'Too high' } })} />
                  {errors.weight && <p className="field-error">{errors.weight.message}</p>}
                </div>
              </>
            )}

            {role === 'requester' && (
              <div className="sm:col-span-2">
                <label className="label" htmlFor="organizationName">Hospital / organization name *</label>
                <input id="organizationName" className="input" {...register('organizationName', { required: 'Organization name is required' })} />
                {errors.organizationName && <p className="field-error">{errors.organizationName.message}</p>}
              </div>
            )}

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
              <input id="pincode" className="input" placeholder="6 digits" {...register('pincode', { pattern: { value: /^[0-9]{6}$/, message: 'Must be 6 digits' } })} />
              {errors.pincode && <p className="field-error">{errors.pincode.message}</p>}
            </div>
            <div>
              <label className="label">Location</label>
              <div className="flex gap-2">
                <input type="number" step="any" className="input" placeholder="Lat" {...register('latitude')} />
                <input type="number" step="any" className="input" placeholder="Lng" {...register('longitude')} />
              </div>
              <button type="button" onClick={fillLocation} disabled={geoLoading} className="btn-ghost mt-1.5 !py-1 text-xs">
                {geoLoading ? 'Locating…' : '📍 Use my current location'}
              </button>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Your precise address and phone number are never shown to the public. They are only used for matching and
            notifications, visible to authorized roles.
          </p>

          <button type="submit" className="btn-primary mt-5 w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}