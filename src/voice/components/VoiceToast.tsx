import React from "react";
import { AlertCircle, ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";
import type { VoiceFeedback, VoiceState } from "../useVoiceStore";

/**
 * The card above the voice button: what the mic is doing, and what it made of the last thing
 * said. Dark glass with cyan accents, to sit with the Kailash spirit whatever the app theme.
 */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Four bars dancing like a level meter: the mic is open. */
const SoundBars: React.FC<{ className?: string }> = ({ className }) => (
  <span className={`voice-bars ${className ?? ""}`} aria-hidden>
    <span />
    <span />
    <span />
    <span />
  </span>
);

/** Three dots pulsing in turn: matching by meaning. */
const ThinkingDots: React.FC = () => (
  <span className="voice-dots" aria-hidden>
    <span />
    <span />
    <span />
  </span>
);

const Quote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-slate-200">“{children}”</span>
);

export const VoiceToast: React.FC<{ state: VoiceState; feedback: VoiceFeedback | null; errorMessage: string | null }> = ({ state, feedback, errorMessage }) => {
  if (state === "idle") return null;

  // Once it is listening again, the last result is history: shown small, not as news.
  const fresh = state !== "listening" || feedback?.kind === "awaiting";
  const failed = state === "error" && !!errorMessage;

  let tone = "text-cyan-300";
  let icon: React.ReactNode = <SoundBars />;
  let label = "Listening";
  if (state === "processing") {
    tone = "text-violet-300";
    icon = <ThinkingDots />;
    label = "Matching";
  } else if (state === "success") {
    tone = "text-emerald-300";
    icon = <CheckCircle2 className="w-4 h-4" />;
    label = "Done";
  } else if (failed) {
    tone = "text-amber-300";
    icon = <AlertCircle className="w-4 h-4" />;
    label = "Mic problem";
  } else if (state === "error" && feedback?.kind === "ambiguous") {
    tone = "text-amber-300";
    icon = <HelpCircle className="w-4 h-4" />;
    label = "Did you mean";
  } else if (state === "error") {
    tone = "text-amber-300";
    icon = <AlertCircle className="w-4 h-4" />;
    label = "Not a command";
  } else if (feedback?.kind === "awaiting") {
    label = `Listening for the ${feedback.wants}`;
  }

  let body: React.ReactNode;
  if (failed) {
    body = <p className="text-sm text-slate-100">{errorMessage}</p>;
  } else if (state === "processing") {
    // The feedback still holds the previous result until this one is decided.
    body = <p className="text-sm text-slate-300">Finding the command you meant…</p>;
  } else if (!feedback) {
    body = <p className="text-sm text-slate-400">Say a command, like “zoom in” or “go to users”</p>;
  } else if (!fresh) {
    body =
      feedback.kind === "ran" ? (
        <p className="text-xs text-slate-500 truncate">Last: {capitalize(feedback.command)}</p>
      ) : (
        <p className="text-sm text-slate-400">Say a command, like “zoom in” or “go to users”</p>
      );
  } else if (feedback.kind === "ran") {
    body = feedback.byMeaning ? (
      <>
        <p className="text-xs text-slate-400 truncate">
          Heard <Quote>{feedback.heard}</Quote>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-white">
          <ArrowRight className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
          <span className="truncate">{capitalize(feedback.command)}</span>
        </p>
      </>
    ) : (
      <p className="text-sm font-medium text-white truncate">{capitalize(feedback.command)}</p>
    );
  } else if (feedback.kind === "ambiguous") {
    body = (
      <>
        <p className="text-xs text-slate-400 truncate">
          Heard <Quote>{feedback.heard}</Quote>, which could be:
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {feedback.options.map((o) => (
            <span key={o} className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
              {capitalize(o)}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">Say it again with a little more.</p>
      </>
    );
  } else if (feedback.kind === "unrecognized") {
    body = (
      <>
        <p className="text-sm text-slate-100 truncate">
          <Quote>{feedback.heard}</Quote>
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">No command matches that. Voice help lists them all.</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="text-sm font-medium text-white">Say the {feedback.wants}</p>
        <p className="mt-0.5 text-xs text-slate-400 truncate">
          after <Quote>{feedback.heard}</Quote>
        </p>
      </>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-72 max-w-[calc(100vw-3rem)] rounded-2xl border border-cyan-200/15 bg-[#0b0a1f]/90 px-4 py-3 text-slate-100 shadow-[0_10px_40px_rgba(2,6,23,0.65),0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-2"
    >
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {/* Keyed so each new result animates in. */}
      <div key={`${state}:${feedback ? JSON.stringify(feedback) : ""}`} className="mt-1.5 animate-in fade-in duration-300">
        {body}
      </div>
    </div>
  );
};
