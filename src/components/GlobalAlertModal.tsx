import React from 'react';
import { useStore } from '../store/useStore';
import { X, TriangleAlert } from 'lucide-react';
import { createPortal } from 'react-dom';

export function GlobalAlertModal() {
  const { globalAlert, setGlobalAlert } = useStore();

  if (!globalAlert) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22]">
          <div className="flex items-center gap-2">
            <TriangleAlert className="text-amber-500" size={20} />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {globalAlert.title}
            </h2>
          </div>
          <button 
            onClick={() => setGlobalAlert(null)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed whitespace-pre-wrap">
            {globalAlert.message}
          </p>

          {globalAlert.codeSnippet && (
            <div className="relative group">
              <div className="absolute -inset-y-2 -inset-x-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg -z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 bg-[#1e1e1e]">
                <div className="flex items-center px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="ml-4 text-[10px] text-slate-400 font-mono tracking-wider uppercase">Example</div>
                </div>
                <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed">
                  <code>{globalAlert.codeSnippet}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] flex justify-end">
          <button 
            onClick={() => setGlobalAlert(null)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
