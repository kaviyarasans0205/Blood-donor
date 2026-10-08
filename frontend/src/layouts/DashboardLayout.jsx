import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { limit: 8, unreadOnly: 'true' } });
      setItems(res.data.data || []);
      setUnread(res.data.meta?.unread || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnread(0);
      setItems([]);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 animate-fade-in rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <button onClick={markAll} className="text-xs font-medium text-medical-600 hover:underline">
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {loading ? (
                <p className="p-4 text-sm text-slate-400">Loading…</p>
              ) : items.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">You&apos;re all caught up.</p>
              ) : (
                items.map((n) => (
                  <div key={n._id} className="border-b border-slate-50 px-4 py-3 hover:bg-slate-50">
                    <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardLayout({ nav, roleLabel, accent = 'bg-brand-600' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`flex h-16 items-center gap-2.5 px-5 ${accent}`}>
          <span className="text-xl">🩸</span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold text-white">LifeLine</p>
            <p className="text-[10px] font-medium text-white/80">{roleLabel} Portal</p>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-medical-100 text-sm font-bold text-medical-700">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="relative hidden flex-1 sm:block sm:max-w-sm">
            <input
              className="input !py-2 pl-9"
              placeholder="Search donors, requests, stock…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`);
              }}
              aria-label="Global search"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-medical-600 text-sm font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium text-slate-700 sm:block">{user?.name?.split(' ')[0]}</span>
                <span className="text-xs text-slate-400">▾</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-48 animate-fade-in rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                    <Link to="/profile" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                      My Profile
                    </Link>
                    <Link to="/notifications" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setMenuOpen(false)}>
                      Notifications
                    </Link>
                    <hr className="my-1.5 border-slate-100" />
                    <button onClick={handleLogout} className="block w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
