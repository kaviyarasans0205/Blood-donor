import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../api/client';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const dashboardFor = (role) => {
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'requester') return '/requester/dashboard';
    return '/donor/dashboard';
  };

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name}`);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : dashboardFor(user.role), { replace: true });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = (email, password) => {
    onSubmit({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl text-white">🩸</span>
            <span className="text-xl font-extrabold text-white">LifeLine</span>
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-white">Sign in to your account</h1>
          <p className="mt-1 text-sm text-slate-400">Donor, hospital and admin portals in one place</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl bg-white p-7 shadow-2xl">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className="input" placeholder="you@example.com" {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })} />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" className="input" placeholder="••••••••" {...register('password', { required: 'Password is required' })} />
            {errors.password && <p className="field-error">{errors.password.message}</p>}
          </div>

          <button id="login-form-hidden-btn" type="submit" className="hidden" disabled={submitting} />

          <button type="submit" className="btn-primary mt-6 w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create one</Link>
          </p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Development test accounts</p>
            <div className="mt-2 space-y-1.5">
              {[
                ['Admin', 'admin@lifeline.test', 'Admin@12345'],
                ['Hospital / Requester', 'hospital@lifeline.test', 'Hospital@12345'],
                ['Donor', 'donor@lifeline.test', 'Donor@12345'],
              ].map(([label, email, pw]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => quickLogin(email, pw)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs hover:border-medical-300 hover:bg-medical-50"
                >
                  <span className="font-semibold text-slate-700">{label}</span>
                  <span className="text-slate-400">{email} →</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}