import { create } from "zustand";

export type InputMode = "native" | "virtual" | "auto";

interface KeyboardState {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  // We can track if a touch device is detected
  isTouchDevice: boolean;
  setIsTouchDevice: (isTouch: boolean) => void;
}

export const useKeyboardStore = create<KeyboardState>((set) => ({
  inputMode: "auto",
  setInputMode: (mode) => set({ inputMode: mode }),
  isTouchDevice: false,
  setIsTouchDevice: (isTouch) => set({ isTouchDevice: isTouch }),
}));
