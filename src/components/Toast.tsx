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

  const icons = {
    success: <CheckCircle className="text-green-500" size={20} />,
    error: <XCircle className="text-red-500" size={20} />,
    warning: <AlertCircle className="text-amber-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
  };

  const colors = {
    success: 'bg-green-50 border-green-100',
    error: 'bg-red-50 border-red-100',
    warning: 'bg-amber-50 border-amber-100',
    info: 'bg-blue-50 border-blue-100',
  };

  if (confirm) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={confirm.onCancel}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
          <div className="text-center">
            <div className={`w-14 h-14 ${type === 'error' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
               {type === 'error' ? <XCircle size={28} /> : <AlertCircle size={28} />}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{type === 'error' ? 'Confirm Action' : 'Are you sure?'}</h3>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <div className="flex space-x-3">
              <button onClick={confirm.onCancel} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
              <button 
                onClick={() => { confirm.onConfirm(); onClose(); }} 
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm text-white transition-colors ${type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
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
    <div className={`fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[100] animate-in slide-in-from-bottom-4 duration-300`}>
      <div className={`flex items-center p-4 rounded-2xl border shadow-lg ${colors[type]}`}>
        <div className="mr-3 flex-shrink-0">{icons[type]}</div>
        <p className="text-sm font-medium text-gray-800 flex-1">{message}</p>
        <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
