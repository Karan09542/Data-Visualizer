import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { appendLogs } from '../utils/executionStore';
import { CornerDownLeft, Check, X, AlertCircle } from 'lucide-react';

interface TerminalInputPromptProps {
  path: string;
}

export function TerminalInputPrompt({ path }: TerminalInputPromptProps) {
  const activePrompt = useStore(state => state.activePrompts[path]);
  const setActivePrompt = useStore(state => state.setActivePrompt);
  
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activePrompt) {
      setValue(activePrompt.defaultValue || '');
      // Focus the input immediately when the prompt becomes active
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [activePrompt]);

  if (!activePrompt) return null;

  const handleSubmit = async (submitVal: any) => {
    // Send typed value to Service Worker to unblock the synchronous XHR request in the Web Worker
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STDIN_SUBMIT',
        sessionId: activePrompt.sessionId,
        value: submitVal
      });
    }

    // Capture input in terminal log history for natural real-terminal feel
    let logArg = submitVal;
    if (activePrompt.type === 'confirm') {
      logArg = `[Confirm: ${submitVal ? 'OK' : 'Cancel'}]`;
    } else if (activePrompt.type === 'alert') {
      logArg = `[Dismiss Alert]`;
    }

    await appendLogs(path, [{
      type: 'log',
      args: [logArg],
      time: new Date().toISOString()
    }]);

    // Clear active prompt so UI dismisses
    setActivePrompt(path, null);
  };

  const handleCancel = async () => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'STDIN_CANCEL',
        sessionId: activePrompt.sessionId
      });
    }

    await appendLogs(path, [{
      type: 'warn',
      args: ['[Cancelled]'],
      time: new Date().toISOString()
    }]);

    setActivePrompt(path, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (activePrompt.type === 'confirm') {
        handleSubmit(true);
      } else if (activePrompt.type === 'alert') {
        handleSubmit(null);
      } else {
        handleSubmit(value);
      }
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="border border-indigo-500/30 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg font-mono text-[11px] animate-fade-in flex flex-col gap-2 shadow-sm shrink-0">
      
      {/* Header Info */}
      <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 gap-1.5 font-semibold shrink-0">
        <div className="flex items-center gap-1.5">
          <AlertCircle size={14} className="animate-pulse shrink-0" />
          <span className="uppercase tracking-wider text-[9px]">
            {activePrompt.type === 'input' ? 'Stdin Input Required' : `${activePrompt.type} Dialog`}
          </span>
        </div>
        <button 
          onClick={handleCancel}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title="Cancel/Abort prompt"
        >
          <X size={13} />
        </button>
      </div>

      {/* Message / Prompt */}
      {activePrompt.promptText && (
        <div className="text-slate-700 dark:text-slate-200 leading-relaxed font-mono font-medium overflow-wrap break-all">
          {activePrompt.promptText}
        </div>
      )}

      {/* Inputs controls */}
      <div className="flex items-center gap-2 w-full shrink-0">
        
        {/* INPUT or PROMPT dialogs */}
        {(activePrompt.type === 'input' || activePrompt.type === 'prompt') && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 w-full focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
            <span className="text-slate-400 select-none font-bold">&gt;</span>
            <input
              id={`prompt-input-${path}`}
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-0 outline-none p-0 text-xs text-slate-800 dark:text-slate-100 font-mono"
              placeholder="Type your response..."
              autoComplete="off"
            />
            <button
              onClick={() => handleSubmit(value)}
              className="p-1 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
              title="Submit input (Enter)"
            >
              <CornerDownLeft size={12} />
            </button>
          </div>
        )}

        {/* CONFIRM style alerts */}
        {activePrompt.type === 'confirm' && (
          <div className="flex items-center gap-2">
            <button
              ref={inputRef as any}
              onClick={() => handleSubmit(true)}
              onKeyDown={handleKeyDown}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-xs transition-colors cursor-pointer shadow-sm"
            >
              <Check size={12} className="shrink-0" />
              <span>OK</span>
            </button>
            <button
              onClick={() => handleSubmit(false)}
              className="flex items-center gap-1 px-3 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs transition-colors cursor-pointer"
            >
              <X size={12} className="shrink-0" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* ALERT dialogs */}
        {activePrompt.type === 'alert' && (
          <button
            ref={inputRef as any}
            onClick={() => handleSubmit(null)}
            onKeyDown={handleKeyDown}
            className="flex items-center gap-1 px-4 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-xs transition-colors cursor-pointer shadow-sm"
          >
            <Check size={12} className="shrink-0" />
            <span>OK</span>
          </button>
        )}
      </div>
    </div>
  );
}
