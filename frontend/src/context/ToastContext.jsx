import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 4500) => {
      const id = ++idCounter;
      setToasts((t) => [...t.slice(-4), { id, message, type }]);
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d ?? 6000),
    info: (m, d) => push(m, 'info', d),
    warning: (m, d) => push(m, 'warning', d),
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(92vw,400px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto animate-slide-in rounded-lg border-l-4 bg-white p-4 shadow-lg ${
              t.type === 'success'
                ? 'border-emerald-500'
                : t.type === 'error'
                  ? 'border-red-500'
                  : t.type === 'warning'
                    ? 'border-amber-500'
                    : 'border-medical-500'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export default ToastContext;
