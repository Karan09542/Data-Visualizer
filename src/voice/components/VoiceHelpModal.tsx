import React from 'react';
import { X, Mic, Info, Play } from 'lucide-react';
import { useVoiceStore } from '../useVoiceStore';
import { CommandRegistry } from '../CommandRegistry';

export const VoiceHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const commands = CommandRegistry.getCommands();

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-white dark:bg-[#0b1120] sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto max-w-2xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 pt-safe">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Voice Commands</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Control the application hands-free</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 flex gap-3 text-indigo-800 dark:text-indigo-200">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">How to use voice commands</p>
              <p className="opacity-90 leading-relaxed">
                Enable the microphone from the Advanced Panel, click the floating mic icon, and say one of the phrases below. Some commands support dynamic words, like "change theme to <span className="font-semibold">ocean</span>".
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {commands.map((cmd, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 sm:p-4 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors">
                <div className="flex flex-wrap gap-2">
                  {cmd.phrases.map((phrase, i) => {
                    const parts = phrase.split(/(\*[a-zA-Z]+)/);
                    return (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium shadow-sm">
                        <Play className="w-3 h-3 text-indigo-500" />
                        {parts.map((p, pIdx) => 
                          p.startsWith('*') ? (
                            <span key={pIdx} className="text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1 rounded">{p.substring(1)}</span>
                          ) : (
                            <span key={pIdx}>{p}</span>
                          )
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
