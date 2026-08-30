import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';

export function NotificationToast() {
  const notification = useStore((state) => state.notification);
  const setNotification = useStore((state) => state.setNotification);

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
    <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:right-6 md:left-auto z-[9999999] flex justify-center md:justify-end pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border w-full max-w-sm
        ${notification.type === 'error' ? 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-900 text-slate-800 dark:text-slate-200' : ''}
        ${notification.type === 'warning' ? 'bg-white dark:bg-slate-900 border-yellow-400/50 dark:border-yellow-600/50 text-slate-800 dark:text-slate-200' : ''}
        ${notification.type === 'success' ? 'bg-white dark:bg-[#0a0f1d] border-emerald-500/20 dark:border-emerald-500/30 text-slate-800 dark:text-slate-200 shadow-emerald-500/5' : ''}
        ${notification.type === 'info' ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900 text-slate-800 dark:text-slate-200' : ''}
      `}>
        <div className="flex-shrink-0 mt-0.5">
          {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {notification.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
        </div>
        <div className="flex-1 text-sm font-medium pr-2 whitespace-pre-wrap">
          {notification.message}
        </div>
        <button 
          onClick={() => setNotification(null)}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors pointer-events-auto"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
