import { useState, useCallback, useEffect } from "react";
import { HistoryEntry, NavigationState } from "../types/navigation";

export function useNavigationStack(initialEntry?: HistoryEntry | null) {
  const [navState, setNavState] = useState<NavigationState>(() => ({
    stack: initialEntry ? [initialEntry] : [],
    currentIndex: initialEntry ? 0 : -1,
  }));

  const push = useCallback((entry: HistoryEntry) => {
    setNavState((prev) => {
      // Remove any forward history if we're not at the end
      const newStack = prev.stack.slice(0, prev.currentIndex + 1);
      
      // Don't push if it's the same as the current entry (prevents duplicate consecutive entries)
      if (newStack.length > 0 && newStack[newStack.length - 1].id === entry.id && newStack[newStack.length - 1].type === entry.type) {
        return prev;
      }

      return {
        stack: [...newStack, entry],
        currentIndex: newStack.length,
      };
    });
  }, []);

  const updateCurrent = useCallback((updates: Partial<HistoryEntry>) => {
    setNavState((prev) => {
      if (prev.currentIndex === -1) return prev;
      const newStack = [...prev.stack];
      newStack[prev.currentIndex] = { ...newStack[prev.currentIndex], ...updates };
      return { ...prev, stack: newStack };
    });
  }, []);

  const back = useCallback(() => {
    setNavState((prev) => {
      if (prev.currentIndex <= 0) return prev;
      return { ...prev, currentIndex: prev.currentIndex - 1 };
    });
  }, []);

  const forward = useCallback(() => {
    setNavState((prev) => {
      if (prev.currentIndex >= prev.stack.length - 1) return prev;
      return { ...prev, currentIndex: prev.currentIndex + 1 };
    });
  }, []);

  const goToIndex = useCallback((index: number) => {
    setNavState((prev) => {
      if (index < 0 || index >= prev.stack.length) return prev;
      return { ...prev, currentIndex: index };
    });
  }, []);

  const goToHome = useCallback(() => {
    setNavState((prev) => {
      if (prev.stack.length === 0) return prev;
      return { ...prev, currentIndex: 0 };
    });
  }, []);

  const clear = useCallback(() => {
    setNavState({ stack: [], currentIndex: -1 });
  }, []);

  const currentEntry = navState.currentIndex !== -1 ? navState.stack[navState.currentIndex] : null;
  const canGoBack = navState.currentIndex > 0;
  const canGoForward = navState.currentIndex < navState.stack.length - 1;

  return {
    navState,
    currentEntry,
    push,
    back,
    forward,
    goToHome,
    goToIndex,
    clear,
    updateCurrent,
    canGoBack,
    canGoForward,
    setNavState,
  };
}
