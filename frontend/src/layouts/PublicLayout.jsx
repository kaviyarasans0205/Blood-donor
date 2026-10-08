import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicLayout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About' },
    { to: '/availability', label: 'Blood Availability' },
    { to: '/emergency', label: 'Emergency Request' },
  ];

  const goDashboard = () => {
    if (!user) return navigate('/login');
    if (user.role === 'admin') return navigate('/admin/dashboard');
    if (user.role === 'requester') return navigate('/requester/dashboard');
    return navigate('/donor/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg text-white">🩸</span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-slate-900">LifeLine</p>
              <p className="text-[10px] font-medium text-slate-500">Smart Blood Management</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'text-brand-700 bg-brand-50' : 'text-slate-600 hover:bg-slate-100'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <button onClick={goDashboard} className="btn-medical">
                  Dashboard
                </button>
                <button onClick={() => { logout(); navigate('/'); }} className="btn-ghost">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Sign in</Link>
                <Link to="/register" className="btn-primary">Become a Donor</Link>
              </>
            )}
          </div>

          <button className="rounded-lg p-2 hover:bg-slate-100 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.to === '/'} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>
                  {l.label}
                </NavLink>
              ))}
              <hr className="my-2" />
              {user ? (
                <button onClick={goDashboard} className="btn-medical w-full">Dashboard</button>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary w-full" onClick={() => setOpen(false)}>Sign in</Link>
                  <Link to="/register" className="btn-primary w-full" onClick={() => setOpen(false)}>Become a Donor</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">🩸</span>
              <p className="font-bold text-white">LifeLine</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Smart Blood Donor Management and Emergency Response System. Digital donor registration, inventory
              tracking, emergency matching and demand forecasting.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Quick links</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/register" className="hover:text-white">Register as donor</Link></li>
              <li><Link to="/emergency" className="hover:text-white">Emergency request</Link></li>
              <li><Link to="/availability" className="hover:text-white">Blood availability</Link></li>
              <li><Link to="/about" className="hover:text-white">How it works</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>support@lifeline.example</li>
              <li>Emergency helpline: 108</li>
              <li>Available 24×7</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Disclaimer</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              This system provides decision-support only. Eligibility, compatibility and demand forecasts must be
              confirmed by authorized medical / blood-bank personnel. Not a substitute for professional medical advice.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} LifeLine — Smart Blood Donor Management System. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
