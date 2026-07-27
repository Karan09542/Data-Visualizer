import React, { useEffect, useState } from 'react';
import { Activity, Trash2, RefreshCcw, PowerOff, Database } from 'lucide-react';

export function PWADiagnosticsPanel() {
  const [cacheInfo, setCacheInfo] = useState<{name: string, size?: number}[]>([]);
  const [storageUsage, setStorageUsage] = useState<number | null>(null);
  const [swStatus, setSwStatus] = useState<string>('Unknown');
  
  const refreshStats = async () => {
    // Get SW Status
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        if (reg.installing) setSwStatus('Installing');
        else if (reg.waiting) setSwStatus('Waiting (Update Pending)');
        else if (reg.active) setSwStatus('Active');
      } else {
        setSwStatus('Not Registered');
      }
    } else {
      setSwStatus('Unsupported');
    }

    // Get Cache Stats
    if ('caches' in window) {
      const keys = await caches.keys();
      setCacheInfo(keys.map(k => ({ name: k })));
    }

    // Get Storage Estimate
    if ('storage' in navigator && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage) {
        setStorageUsage(estimate.usage);
      }
    }
  };

  useEffect(() => {
    refreshStats();
    // Poll occasionally
    const interval = setInterval(refreshStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const clearCaches = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
      refreshStats();
    }
  };

  const unregisterSW = async () => {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.unregister();
        setSwStatus('Unregistered');
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">PWA Diagnostics</h3>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs mb-5 border border-slate-200 dark:border-slate-800 p-3 rounded-lg bg-white dark:bg-slate-800/50">
        <div>
          <span className="text-slate-500 block uppercase tracking-wider font-semibold mb-1">SW Status</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium">{swStatus}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase tracking-wider font-semibold mb-1">Network State</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium">{navigator.onLine ? 'Online' : 'Offline'}</span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase tracking-wider font-semibold mb-1">Storage Usage</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium">
            {storageUsage !== null ? formatBytes(storageUsage) : 'Calculating...'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block uppercase tracking-wider font-semibold mb-1">Active Caches</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium">{cacheInfo.length}</span>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        <span className="text-slate-500 block text-xs uppercase tracking-wider font-semibold mb-2">Cache Names</span>
        {cacheInfo.map(c => (
          <div key={c.name} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-400">
            {c.name}
          </div>
        ))}
        {cacheInfo.length === 0 && <div className="text-xs text-slate-400 italic px-1">No caches found</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={refreshStats} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors">
          <RefreshCcw size={14} /> Refresh
        </button>
        <button onClick={clearCaches} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-semibold transition-colors">
          <Trash2 size={14} /> Clear Caches
        </button>
        <button onClick={unregisterSW} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg text-xs font-semibold transition-colors">
          <PowerOff size={14} /> Unregister SW
        </button>
        <button onClick={() => window.location.reload()} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold transition-colors">
          <RefreshCcw size={14} /> Hard Reload
        </button>
      </div>
    </div>
  );
}
