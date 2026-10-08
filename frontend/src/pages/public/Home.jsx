import { Link } from 'react-router-dom';

const steps = [
  { icon: '📝', title: 'Register & profile', text: 'Create an account as a donor or hospital. Donors set blood group, location and availability.' },
  { icon: '✅', title: 'Eligibility screening', text: 'Rule-based checks on age, weight, donation interval and health answers — with a clear disclaimer.' },
  { icon: '🚨', title: 'Emergency request', text: 'Hospitals post urgent needs; the system auto-classifies priority (CRITICAL / URGENT / NORMAL).' },
  { icon: '🎯', title: 'Smart matching', text: 'Compatible, eligible donors are ranked by real distance (Haversine) and availability.' },
  { icon: '🔔', title: 'Notify & respond', text: 'Nearby donors are alerted via in-app, email and SMS; hospitals track request status live.' },
  { icon: '🔮', title: 'Predict demand', text: 'Historical demand feeds a forecasting service so stock shortfalls are anticipated.' },
];

const features = [
  ['🩸', 'Blood inventory', 'Batch-level tracking with collection/expiry dates, FEFO consumption and low-stock thresholds.'],
  ['⏳', 'Expiry tracking', 'Scheduled jobs flag expiring batches; expired units are never offered as available.'],
  ['🗺️', 'Location matching', 'Haversine distance ranks the closest eligible donors within a radius.'],
  ['🏅', 'Donor rewards', 'Configurable points for completed donations and milestones.'],
  ['📅', 'Appointments', 'Book, reschedule and cancel; conflict detection prevents double-booking.'],
  ['📑', 'Reports & analytics', 'CSV exports and dashboards across donors, stock, requests and demand.'],
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/20">
              🩸 Digital Blood Bank Platform
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Every drop counts.<br />Find a match in seconds.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-50">
              Smart Blood Donor Management &amp; Emergency Response — connecting donors, hospitals and blood banks with
              real-time inventory, compatibility matching and emergency coordination.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn bg-white text-brand-700 hover:bg-brand-50">
                Become a Donor →
              </Link>
              <Link to="/emergency" className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20">
                🚨 Emergency Blood Request
              </Link>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-6">
              {[
                ['8', 'Blood groups'],
                ['24×7', 'Emergency response'],
                ['AI', 'Demand prediction'],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold">{v}</p>
                  <p className="text-xs text-brand-100">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl bg-white/10 p-8 backdrop-blur ring-1 ring-white/20">
              <div className="grid grid-cols-2 gap-4">
                {['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map((g) => (
                  <div key={g} className="flex items-center gap-3 rounded-xl bg-white/90 p-4 text-slate-800">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">{g}</span>
                    <div>
                      <p className="text-xs text-slate-500">Blood group</p>
                      <p className="text-sm font-semibold">Available donors</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900">From request to transfusion, digitised</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-500">
            A single connected flow: frontend → API → database → matching algorithms → notifications → dashboards.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="card card-hover p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl">{s.icon}</span>
                <span className="text-xs font-bold text-slate-400">STEP {i + 1}</span>
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-medical-600">Platform features</p>
            <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Built for real blood-bank operations</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([icon, title, text]) => (
              <div key={title} className="card card-hover p-6">
                <span className="text-2xl">{icon}</span>
                <h3 className="mt-3 font-bold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-16 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6">
          <h2 className="text-3xl font-extrabold">One donation can save up to three lives.</h2>
          <p className="max-w-2xl text-slate-300">
            Register in minutes, check your eligibility, and get alerted when someone near you needs your blood group.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn-primary">Register as a Donor</Link>
            <Link to="/availability" className="btn border border-white/30 bg-white/10 text-white hover:bg-white/20">
              View Blood Availability
            </Link>
          </div>
          <p className="max-w-2xl text-xs text-slate-400">
            Disclaimer: eligibility, compatibility and demand forecasts produced here are decision-support aids and must
            be confirmed by authorized medical / blood-bank personnel.
          </p>
        </div>
      </section>
    </div>
  );
}