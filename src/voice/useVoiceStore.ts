import { create } from "zustand";

export type VoiceState = "idle" | "listening" | "processing" | "success" | "error";

interface VoiceStoreState {
  state: VoiceState;
  lastCommand: string | null;
  errorMessage: string | null;
  setState: (state: VoiceState) => void;
  setLastCommand: (command: string | null) => void;
  setErrorMessage: (error: string | null) => void;
  isVoiceEnabled: boolean;
  setIsVoiceEnabled: (enabled: boolean) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  state: "idle",
  lastCommand: null,
  errorMessage: null,
  isVoiceEnabled: true,
  setState: (state) => set({ state }),
  setLastCommand: (command) => set({ lastCommand: command }),
  setErrorMessage: (error) => set({ errorMessage: error }),
  setIsVoiceEnabled: (enabled) => set({ isVoiceEnabled: enabled }),
}));
