import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useStore } from '../store/useStore';

export function NotificationToast() {
  const { notification, setNotification } = useStore();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, setNotification]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={`flex items-start gap-3 p-4 rounded-lg shadow-xl border max-w-sm w-full
        ${notification.type === 'error' ? 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-900 text-slate-800 dark:text-slate-200' : ''}
        ${notification.type === 'success' ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900 text-slate-800 dark:text-slate-200' : ''}
        ${notification.type === 'info' ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900 text-slate-800 dark:text-slate-200' : ''}
      `}>
        <div className="flex-shrink-0 mt-0.5">
          {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {notification.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
        </div>
        <div className="flex-1 text-sm font-medium pr-2 whitespace-pre-wrap">
          {notification.message}
        </div>
        <button 
          onClick={() => setNotification(null)}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
