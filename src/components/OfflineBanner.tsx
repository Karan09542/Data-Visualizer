import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100000] bg-orange-500 text-white px-4 py-2 flex items-center justify-between text-sm shadow-md animate-in slide-in-from-top-full">
      <div className="flex items-center gap-2 font-medium">
        <WifiOff size={16} />
        <span>You are currently offline. Some features may be unavailable.</span>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}
