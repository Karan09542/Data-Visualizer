import { create } from "zustand";
import { persist } from "zustand/middleware";

export type VoiceState = "idle" | "listening" | "processing" | "success" | "error";

/**
 * The model that matches commands by meaning (see semantic/SemanticMatcher): not checked yet, not
 * downloaded, downloaded but not loaded, being downloaded, being loaded, ready, or failed.
 */
export type MatcherStatus = "unknown" | "absent" | "stored" | "downloading" | "loading" | "ready" | "error";

/** What the voice toast says about the last thing heard. */
export type VoiceFeedback =
  /** A command ran. `byMeaning`: it was matched by meaning, so what was heard differs from it. */
  | { kind: "ran"; heard: string; command: string; byMeaning: boolean }
  /** Two or more commands were about equally close, so none ran. */
  | { kind: "ambiguous"; heard: string; options: string[] }
  | { kind: "unrecognized"; heard: string }
  /** A command was said without its argument ("search"); the next sentence supplies it. */
  | { kind: "awaiting"; heard: string; wants: string };

interface VoiceStoreState {
  state: VoiceState;
  feedback: VoiceFeedback | null;
  errorMessage: string | null;
  setState: (state: VoiceState) => void;
  setFeedback: (feedback: VoiceFeedback | null) => void;
  setErrorMessage: (error: string | null) => void;
  isVoiceEnabled: boolean;
  setIsVoiceEnabled: (enabled: boolean) => void;
  /** Match commands by meaning when the exact phrases don't ("fit center" → "fit into center"). */
  smartMatching: boolean;
  setSmartMatching: (enabled: boolean) => void;
  matcherStatus: MatcherStatus;
  /** Download progress, 0 to 1. */
  matcherProgress: number;
  matcherError: string | null;
}

export const useVoiceStore = create<VoiceStoreState>()(
  persist(
    (set) => ({
      state: "idle",
      feedback: null,
      errorMessage: null,
      isVoiceEnabled: false,
      setState: (state) => set({ state }),
      // Something new was heard, so an earlier mic error no longer applies.
      setFeedback: (feedback) => set(feedback ? { feedback, errorMessage: null } : { feedback }),
      setErrorMessage: (error) => set({ errorMessage: error }),
      setIsVoiceEnabled: (enabled) => set({ isVoiceEnabled: enabled }),
      smartMatching: true,
      setSmartMatching: (enabled) => set({ smartMatching: enabled }),
      matcherStatus: "unknown",
      matcherProgress: 0,
      matcherError: null,
    }),
    {
      name: "voice-store",
      partialize: (state) => ({ isVoiceEnabled: state.isVoiceEnabled, smartMatching: state.smartMatching }),
    }
  )
);
