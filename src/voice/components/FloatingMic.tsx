import React from "react";
import { Mic, MicOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { VoiceManager } from "../VoiceManager";
import { useVoiceStore } from "../useVoiceStore";

export const FloatingMic: React.FC = () => {
  const { state, lastCommand, errorMessage, isVoiceEnabled } = useVoiceStore();

  if (!isVoiceEnabled) return null;

  if (!VoiceManager.isSupported()) {
    return (
      <div 
        className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full shadow-lg opacity-50 cursor-not-allowed group"
        title="Voice commands are not supported in this browser."
      >
        <MicOff className="w-5 h-5 text-slate-400" />
      </div>
    );
  }

  const handleToggle = () => {
    VoiceManager.toggle();
  };

  const isListening = state === "listening";
  const isError = state === "error";
  const isSuccess = state === "success";
  
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      
      {/* Toast Notification */}
      {(lastCommand || errorMessage) && state !== "idle" && (
        <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-xs animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
          <div className="flex items-start gap-3">
            {isError ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <Loader2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5 animate-spin" />
            )}
            
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {isError ? "Error" : isSuccess ? "Recognized" : "Listening..."}
              </span>
              <span className="text-sm font-medium leading-tight">
                {isError ? errorMessage : lastCommand || "Say a command..."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mic Button */}
      <button
        onClick={handleToggle}
        className={`
          flex items-center justify-center w-14 h-14 rounded-full shadow-xl pointer-events-auto transition-all duration-300
          ${isListening 
            ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 ring-4 ring-red-500/20 animate-pulse" 
            : isError
              ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30"
          }
        `}
        title={isListening ? "Stop Listening" : "Start Voice Commands"}
      >
        {isListening ? (
          <Mic className="w-6 h-6" />
        ) : (
          <MicOff className="w-6 h-6" />
        )}
      </button>
    </div>
  );
};
