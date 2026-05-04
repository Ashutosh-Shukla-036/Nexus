import { cn } from '../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card = ({ children, className, ...props }: CardProps) => (
  <div className={cn("bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl", className)} {...props}>
    {children}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = ({ variant = 'primary', size = 'md', isLoading, className, children, ...props }: ButtonProps) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-slate-100',
    outline: 'border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-indigo-400'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
};

export const Badge = ({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' }) => {
  const variants = {
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    info: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    neutral: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border", variants[variant])}>
      {children}
    </span>
  );
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const Modal = ({ open, onClose, children, title }: ModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-300">
        {title && (
          <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
};

