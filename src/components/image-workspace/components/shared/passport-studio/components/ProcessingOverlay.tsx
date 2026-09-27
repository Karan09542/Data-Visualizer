import React from 'react';
import { Loader2 } from 'lucide-react';

export const ProcessingOverlay: React.FC<{ status: string }> = ({ status }) => (
  <div className="absolute inset-0 z-[999999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
    <div className="w-full max-w-xs mx-4 p-5 rounded-xl border shadow-2xl flex items-center gap-4 bg-white border-slate-200 dark:bg-[#1A1A1D] dark:border-white/[0.08]">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 shrink-0">
        <Loader2 size={20} className="animate-spin" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">AI Auto-Adjust</div>
        <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">{status || 'Processing...'}</div>
      </div>
    </div>
  </div>
);
