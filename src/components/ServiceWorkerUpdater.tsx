
import React, { useEffect, useState } from "react";
import { Download, X, RefreshCw } from "lucide-react";
import { Workbox } from 'workbox-window';

export function ServiceWorkerUpdater() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);

  useEffect(() => {
    // Detect if running in standalone mode (PWA)
    const checkIsPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // @ts-ignore - for iOS Safari
      const isIOSStandalone = window.navigator.standalone === true;
      setIsPWA(isStandalone || isIOSStandalone);
    };
    checkIsPWA();

    // Listen for display mode changes just in case
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkIsPWA();
    mediaQuery.addEventListener('change', handleChange);

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const workbox = new Workbox('/sw.js');
      
      workbox.addEventListener('waiting', () => {
        setShowPrompt(true);
      });

      workbox.addEventListener('controlling', (event) => {
        if (event.isUpdate) {
          window.location.reload();
        }
      });

      workbox.register();
      setWb(workbox);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const handleUpdate = () => {
    if (wb) {
      wb.messageSkipWaiting();
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  if (!isPWA) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-[99999] bg-white dark:bg-[#1e293b] border border-blue-500/30 dark:border-blue-400/30 rounded-2xl shadow-2xl p-5 flex flex-col gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Download size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Update Available</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {import.meta.env.VITE_APP_VERSION ? (
                <>New version <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{import.meta.env.VITE_APP_VERSION}</span> is ready.</>
              ) : (
                "A new version has been downloaded and is ready to use."
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleUpdate}
          className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Update Now
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          Later
        </button>
      </div>
    </div>
  );
}
