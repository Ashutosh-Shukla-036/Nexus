import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '../utils/cn';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  error: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  info: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
};

const ToastItem = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) => {
  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl",
        "animate-in slide-in-from-bottom-2 fade-in duration-300",
        "min-w-[320px] max-w-[480px]",
        styles[toast.type]
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 hover:bg-white/10 rounded-md transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container — fixed to bottom-right */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-auto">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
