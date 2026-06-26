import { create } from "zustand";

export type InputMode = "native" | "virtual" | "auto";

interface InputModeState {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  isTouchDevice: boolean;
  setIsTouchDevice: (isTouch: boolean) => void;
}

export const useInputMode = create<InputModeState>((set) => ({
  inputMode: "auto",
  setInputMode: (mode) => set({ inputMode: mode }),
  isTouchDevice: false,
  setIsTouchDevice: (isTouch) => set({ isTouchDevice: isTouch }),
}));
