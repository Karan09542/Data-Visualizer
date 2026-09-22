import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';

const TOAST_DURATION = 4500;

interface ToastTheme {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badgeClass: string;
  iconClass: string;
  borderClass: string;
  progressClass: string;
}

const THEMES: Record<string, ToastTheme> = {
  success: {
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30',
    iconClass: 'text-emerald-500 dark:text-emerald-400',
    borderClass: 'border-emerald-500/30 dark:border-emerald-500/25 shadow-emerald-500/5',
    progressClass: 'bg-emerald-500 dark:bg-emerald-400',
  },
  error: {
    icon: AlertCircle,
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30',
    iconClass: 'text-rose-500 dark:text-rose-400',
    borderClass: 'border-rose-500/30 dark:border-rose-500/25 shadow-rose-500/5',
    progressClass: 'bg-rose-500 dark:bg-rose-400',
  },
  warning: {
    icon: AlertTriangle,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30',
    iconClass: 'text-amber-500 dark:text-amber-400',
    borderClass: 'border-amber-500/30 dark:border-amber-500/25 shadow-amber-500/5',
    progressClass: 'bg-amber-500 dark:bg-amber-400',
  },
  info: {
    icon: Info,
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30',
    iconClass: 'text-blue-500 dark:text-blue-400',
    borderClass: 'border-blue-500/30 dark:border-blue-500/25 shadow-blue-500/5',
    progressClass: 'bg-blue-500 dark:bg-blue-400',
  },
};

export function NotificationToast() {
  const notification = useStore((state) => state.notification);
  const setNotification = useStore((state) => state.setNotification);

  const [remainingTime, setRemainingTime] = useState(TOAST_DURATION);
  const [isPaused, setIsPaused] = useState(false);
  const lastTimeRef = useRef<number>(Date.now());

  // Reset timer whenever notification changes
  useEffect(() => {
    if (notification) {
      setRemainingTime(TOAST_DURATION);
      setIsPaused(false);
      lastTimeRef.current = Date.now();
    }
  }, [notification]);

  // Real-time countdown timer with pause-on-hover
  useEffect(() => {
    if (!notification || isPaused) return;

    lastTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTimeRef.current;
      lastTimeRef.current = now;

      setRemainingTime((prev) => {
        const next = prev - elapsed;
        if (next <= 0) {
          clearInterval(interval);
          setNotification(null);
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [notification, isPaused, setNotification]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && notification) {
        setNotification(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, setNotification]);

  const handleClose = useCallback(() => {
    setNotification(null);
  }, [setNotification]);

  if (typeof document === 'undefined') return null;

  const currentType = notification?.type || 'info';
  const theme = THEMES[currentType] || THEMES.info;
  const IconComponent = theme.icon;
  const progressPercent = Math.max(0, Math.min(100, (remainingTime / TOAST_DURATION) * 100));

  return createPortal(
    <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto z-[9999999] flex justify-center sm:justify-end pointer-events-none select-none">
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification.message + notification.type}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.15, ease: 'easeOut' } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={`pointer-events-auto relative w-full sm:w-auto sm:min-w-[320px] sm:max-w-md overflow-hidden rounded-xl border ${theme.borderClass} bg-white/95 dark:bg-[#161b22]/95 backdrop-blur-md shadow-xl dark:shadow-2xl dark:shadow-black/60 transition-all`}
          >
            <div className="flex items-center gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3">
              {/* Compact Status Icon Badge */}
              <div className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center ${theme.badgeClass}`}>
                <IconComponent size={15} className={theme.iconClass} />
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 pr-1 select-text">
                <p className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-snug break-words line-clamp-3">
                  {notification.message}
                </p>
              </div>

              {/* Explicit Cancel / Close Button */}
              <button
                type="button"
                onClick={handleClose}
                title="Dismiss notification (Esc)"
                aria-label="Dismiss notification"
                className="p-1 sm:p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors shrink-0 flex items-center justify-center cursor-pointer group"
              >
                <X size={14} className="transition-transform group-hover:scale-110" />
              </button>
            </div>

            {/* Hairline Progress Indicator */}
            <div className="h-[2px] w-full bg-slate-100 dark:bg-slate-800/60 overflow-hidden">
              <div
                className={`h-full ${theme.progressClass} transition-[width] duration-75 ease-linear`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
