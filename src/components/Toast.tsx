import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  confirm?: {
    onConfirm: () => void;
    onCancel: () => void;
  };
}

export default function Toast({ message, type, onClose, confirm }: ToastProps) {
  useEffect(() => {
    if (!confirm) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
    return;
  }, [onClose, confirm]);

  // Session 128.8 — semantic palette tokens. success=green, error=red,
  // warning=amber, info=blue. Replaces the earlier `var(--f-cyan)` info color
  // which read as a teal more than a clear "blue info" signal.
  const accent: Record<ToastType, string> = {
    success: 'var(--c-success)',
    error: 'var(--c-danger)',
    warning: 'var(--c-warning)',
    info: 'var(--c-info)',
  };

  const icons = {
    success: <CheckCircle color={accent.success} size={20} />,
    error: <XCircle color={accent.error} size={20} />,
    warning: <AlertCircle color={accent.warning} size={20} />,
    info: <Info color={accent.info} size={20} />,
  };

  if (confirm) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(5,5,15,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={confirm.onCancel}>
        <div
          className="rounded-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200"
          style={{
            background: 'var(--f-modal-bg)', border: '1px solid var(--f-glass-border-2)',
            backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: (type === 'error' ? 'var(--f-danger)' : '#F59E0B') + '1A',
                border: `1px solid ${(type === 'error' ? 'var(--f-danger)' : '#F59E0B')}40`,
                color: type === 'error' ? 'var(--f-danger)' : '#F59E0B',
              }}
            >
               {type === 'error' ? <XCircle size={28} /> : <AlertCircle size={28} />}
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--f-text-1)' }}>{type === 'error' ? 'Confirm Action' : 'Are you sure?'}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--f-text-2)' }}>{message}</p>
            <div className="flex space-x-3">
              <button
                onClick={confirm.onCancel}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                style={{ color: 'var(--f-text-1)', background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)' }}
              >Cancel</button>
              <button
                onClick={() => { confirm.onConfirm(); onClose(); }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                style={
                  type === 'error'
                    ? { background: 'var(--f-danger)', border: 'none', boxShadow: '0 0 16px rgba(255,77,106,0.35)' }
                    : { background: 'var(--f-grad-primary)', border: 'none', boxShadow: '0 0 16px rgba(255,42,140,0.35)' }
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[100] animate-in slide-in-from-bottom-4 duration-300">
      <div
        className="flex items-center p-4 rounded-2xl"
        style={{
          background: 'var(--f-glass-bg-2)',
          border: `1px solid ${accent[type]}55`,
          backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: `0 8px 28px rgba(0,0,0,0.45), 0 0 18px ${accent[type]}22`,
        }}
      >
        <div className="mr-3 flex-shrink-0">{icons[type]}</div>
        <p className="text-sm font-medium flex-1" style={{ color: 'var(--f-text-1)' }}>{message}</p>
        <button onClick={onClose} className="ml-3" style={{ color: 'var(--f-text-3)' }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
