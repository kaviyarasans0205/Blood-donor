export function StatCard({ label, value, sub, icon, tone = 'default', onClick }) {
  const tones = {
    default: 'from-white to-slate-50 text-slate-900',
    danger: 'from-red-50 to-white text-red-700',
    warning: 'from-amber-50 to-white text-amber-700',
    success: 'from-emerald-50 to-white text-emerald-700',
    medical: 'from-medical-50 to-white text-medical-700',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`card card-hover w-full bg-gradient-to-br p-5 text-left ${tones[tone]} ${onClick ? 'focus:outline-none focus:ring-2 focus:ring-medical-300' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs font-medium text-slate-500">{sub}</p>}
        </div>
        {icon && (
          <div className="rounded-xl bg-white/80 p-2.5 text-xl shadow-sm ring-1 ring-slate-100">{icon}</div>
        )}
      </div>
    </Wrapper>
  );
}

export function SectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default StatCard;
