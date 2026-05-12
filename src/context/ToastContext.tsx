import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';

interface ToastOptions {
  type?: ToastType;
}

interface ConfirmOptions {
  type?: 'warning' | 'error';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => void;
  showConfirm: (message: string, options: ConfirmOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; confirm?: { onConfirm: () => void; onCancel: () => void } } | null>(null);

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    setToast({ message, type: options.type || 'info' });
  }, []);

  const showConfirm = useCallback((message: string, options: ConfirmOptions) => {
    setToast({
      message,
      type: options.type || 'warning',
      confirm: {
        onConfirm: options.onConfirm,
        onCancel: () => {
          if (options.onCancel) options.onCancel();
          setToast(null);
        }
      }
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={hideToast} 
          confirm={toast.confirm}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
