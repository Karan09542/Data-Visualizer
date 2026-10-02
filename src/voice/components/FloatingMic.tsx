import React from "react";
import { MicOff } from "lucide-react";
import { VoiceSpirit3D } from "./VoiceSpirit3D";
import { VoiceToast } from "./VoiceToast";
import "./naad.css";
import { VoiceManager } from "../VoiceManager";
import { useVoiceStore } from "../useVoiceStore";

export const FloatingMic: React.FC = () => {
  const state = useVoiceStore((state) => state.state);
  const feedback = useVoiceStore((state) => state.feedback);
  const errorMessage = useVoiceStore((state) => state.errorMessage);
  const isVoiceEnabled = useVoiceStore((state) => state.isVoiceEnabled);

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
  /** Listening, or briefly showing what it heard before listening again. */
  const isActive = isListening || state === "processing" || isSuccess;
  
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      
      <VoiceToast state={state} feedback={feedback} errorMessage={errorMessage} />

      {/* Mic Button: the Kailash spirit, whose naad spreads while it listens */}
      <button
        onClick={handleToggle}
        aria-pressed={isActive}
        aria-label={isActive ? "Stop listening" : "Start voice commands"}
        title={isActive ? "Stop listening" : "Start voice commands"}
        className={`
          relative flex items-center justify-center w-16 h-16 rounded-full pointer-events-auto transition-all duration-300
          bg-[radial-gradient(circle_at_50%_40%,#1e1b4b_0%,#0b0a1f_60%,#020205_100%)] text-white shadow-xl hover:scale-105 active:scale-95
          focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50
          ${isActive
            ? "ring-2 ring-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.5)]"
            : isError
              ? "ring-2 ring-amber-400/70 shadow-amber-500/30"
              : "ring-1 ring-indigo-300/20 shadow-[0_0_14px_rgba(99,102,241,0.25)]"
          }
        `}
      >
        {isListening && (
          <span className="absolute inset-0 text-cyan-300" aria-hidden>
            <span className="naad-ring" />
            <span className="naad-ring" />
            <span className="naad-ring" />
          </span>
        )}
        <VoiceSpirit3D mode={state} size={64} />
      </button>
    </div>
  );
};
