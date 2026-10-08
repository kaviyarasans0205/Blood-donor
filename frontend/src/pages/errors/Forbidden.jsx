import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Forbidden() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const home = user?.role === 'admin' ? '/admin/dashboard'
    : user?.role === 'donor' ? '/donor/dashboard'
    : user?.role === 'requester' ? '/requester/dashboard'
    : '/login';

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-black text-red-100">403</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-800">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Your account doesn&apos;t have permission to view this page.
        {user ? ` You are signed in as ${user.role}.` : ''}
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary">Go back</button>
        <Link to={home} className="btn-primary">Go to my dashboard</Link>
      </div>
    </div>
  );
}