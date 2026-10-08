const styles = {
  // priorities
  CRITICAL: 'bg-red-100 text-red-800 ring-red-200',
  URGENT: 'bg-amber-100 text-amber-800 ring-amber-200',
  NORMAL: 'bg-sky-100 text-sky-800 ring-sky-200',
  // statuses
  Pending: 'bg-slate-100 text-slate-700 ring-slate-200',
  Matching: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  Fulfilled: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  'Partially Fulfilled': 'bg-amber-100 text-amber-800 ring-amber-200',
  Cancelled: 'bg-slate-200 text-slate-600 ring-slate-300',
  Expired: 'bg-rose-100 text-rose-700 ring-rose-200',
  Confirmed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Completed: 'bg-medical-100 text-medical-800 ring-medical-200',
  'No-show': 'bg-rose-100 text-rose-700 ring-rose-200',
  // eligibility
  eligible: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  ineligible: 'bg-red-100 text-red-800 ring-red-200',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-200',
  ELIGIBLE: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  NOT_ELIGIBLE: 'bg-red-100 text-red-800 ring-red-200',
  // inventory
  available: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  reserved: 'bg-sky-100 text-sky-800 ring-sky-200',
  expired: 'bg-rose-100 text-rose-700 ring-rose-200',
  consumed: 'bg-slate-200 text-slate-600 ring-slate-300',
  discarded: 'bg-slate-200 text-slate-600 ring-slate-300',
  // risk
  HIGH: 'bg-red-100 text-red-800 ring-red-200',
  MEDIUM: 'bg-amber-100 text-amber-800 ring-amber-200',
  LOW: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  // notifications
  queued: 'bg-slate-100 text-slate-600 ring-slate-200',
  sent: 'bg-medical-100 text-medical-800 ring-medical-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  failed: 'bg-red-100 text-red-800 ring-red-200',
  mocked: 'bg-amber-100 text-amber-800 ring-amber-200',
  // availability
  available_: '',
  unavailable: 'bg-slate-200 text-slate-600 ring-slate-300',
  busy: 'bg-amber-100 text-amber-800 ring-amber-200',
  // alert severity
  critical: 'bg-red-100 text-red-800 ring-red-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  info: 'bg-sky-100 text-sky-800 ring-sky-200',
  // engagement
  active: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  inactive: 'bg-slate-200 text-slate-600 ring-slate-300',
  // response
  accepted: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  declined: 'bg-rose-100 text-rose-700 ring-rose-200',
};

export default function StatusBadge({ value, className = '', dot = false }) {
  const key = String(value);
  const cls = styles[key] || 'bg-slate-100 text-slate-700 ring-slate-200';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {key}
    </span>
  );
}

export function BloodGroupTag({ group, size = 'md' }) {
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-12 w-12 text-lg' : 'h-9 w-9 text-sm';
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-lg bg-brand-600 font-bold text-white shadow-sm`}
      title={`Blood group ${group}`}
    >
      {group}
    </span>
  );
}
