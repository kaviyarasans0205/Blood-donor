const sections = [
  {
    icon: '🩸',
    title: 'Smart blood management',
    text: 'Batch-level inventory records store blood group, units, collection date, expiry date and blood-bank location. Available stock is always computed from non-expired, available-status batches — expired units are never offered.',
  },
  {
    icon: '🚨',
    title: 'Emergency response',
    text: 'Hospital requests are automatically classified into CRITICAL, URGENT or NORMAL using required time, clinical notes and severity hints. A priority queue serves CRITICAL first, then URGENT, then NORMAL, with earliest request time breaking ties.',
  },
  {
    icon: '🎯',
    title: 'Donor matching',
    text: 'Compatibility rules live in one configurable service. Candidates are filtered by compatibility, eligibility and availability, then ranked by Haversine distance from the request location, so the closest usable donor is notified first.',
  },
  {
    icon: '📦',
    title: 'Inventory management',
    text: 'Low-stock thresholds are configurable per blood group; expiry sweeps run on a schedule and raise alerts. Stock is consumed first-expiry-first-out to reduce wastage.',
  },
  {
    icon: '🔮',
    title: 'AI / ML demand prediction',
    text: 'A Python FastAPI service forecasts future blood requirements from historical request and donation data, with a local statistical fallback. Results are cached in the database — predictions are refreshed by a scheduled job, not on every page load.',
  },
  {
    icon: '📩',
    title: 'Re-engagement & rewards',
    text: 'Donors inactive beyond a configurable window are surfaced for re-engagement reminders, and completed donations earn configurable reward points with a full transaction ledger.',
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">About the platform</p>
        <h1 className="mt-2 text-4xl font-extrabold text-slate-900">
          Smart Blood Donor Management &amp; Emergency Response System
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          A full-stack application that digitally manages blood donors, blood inventory and emergency blood
          requirements — connecting registration, eligibility screening, appointments, matching, notifications,
          forecasting and analytics in one system.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.title} className="card card-hover p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl">{s.icon}</span>
              <h2 className="font-bold text-slate-900">{s.title}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="card mt-10 border-amber-200 bg-amber-50 p-6">
        <h3 className="font-bold text-amber-900">Important disclaimers</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-800">
          <li>Eligibility screening is a pre-screening aid — final eligibility must be confirmed by authorized medical/blood-bank personnel.</li>
          <li>Blood compatibility rules are configurable decision-support data, not a substitute for cross-matching.</li>
          <li>Demand forecasts are statistical estimates, not medically validated predictions.</li>
          <li>SMS/email channels report mock status when providers are not configured; delivery is never claimed without provider confirmation.</li>
        </ul>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ['React + Vite + Tailwind', 'Responsive healthcare dashboard UI'],
          ['Node.js + Express + MongoDB', 'REST API with JWT auth, RBAC and audit logs'],
          ['FastAPI + scikit-learn', 'Forecasting microservice with cached results'],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <p className="font-bold text-slate-900">{t}</p>
            <p className="mt-1 text-sm text-slate-500">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}