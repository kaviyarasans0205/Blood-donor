import { useMemo, useState } from 'react';

/**
 * Reusable client-side table with search, sort, pagination.
 * columns: [{ key, label, sortable?, render?(row), align? }]
 */
export default function DataTable({
  columns,
  rows = [],
  loading = false,
  error = null,
  onRetry,
  searchKeys = [],
  initialSort = null,
  pageSize = 10,
  emptyMessage = 'No records found',
  toolbar = null,
  onRowClick = null,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim() && searchKeys.length) {
      const q = query.toLowerCase();
      out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
    }
    if (sort?.key) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === 'desc' ? -cmp : cmp;
      });
    }
    return out;
  }, [rows, query, sort, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key) => {
    setPage(1);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-danger mt-3">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {(toolbar || searchKeys.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          {searchKeys.length > 0 && (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                className="input pl-9"
                placeholder="Search…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search table"
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{filtered.length} record(s)</span>
            {toolbar}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ textAlign: c.align || 'left' }}
                  className={c.sortable === false ? '' : 'cursor-pointer select-none hover:text-slate-700'}
                  onClick={() => c.sortable !== false && toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort?.key === c.key && <span className="text-brand-600">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      <div className="h-4 animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-500">
                  {query ? `No results for “${query}”` : emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={row.id || row._id || idx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          <button className="btn-secondary !py-1.5 text-xs" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            ← Prev
          </button>
          <span className="text-slate-500">
            Page {safePage} of {totalPages}
          </span>
          <button className="btn-secondary !py-1.5 text-xs" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
