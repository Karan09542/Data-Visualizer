import { useEffect, useRef } from "react";

export interface ModalStackEntry {
  id: string;
  onClose: () => void;
  hasHistoryState: boolean;
}

let modalStack: ModalStackEntry[] = [];
let ignorePopstateCount = 0;
let isListenerAttached = false;
let pendingRewindCount = 0;
let rewindTimeoutId: any = null;
let backButtonCloseEnabled = true;

/**
 * Checks whether the native-like back button popup closer is currently enabled.
 * Synchronized with the persistent `backButtonClosesPopups` setting in the application store.
 */
export const isBackButtonCloseEnabled = (): boolean => {
  if (typeof window !== "undefined" && (window as any).useStore?.getState) {
    try {
      const val = (window as any).useStore.getState().backButtonClosesPopups;
      if (typeof val === "boolean") return val;
    } catch {
      // fallback
    }
  }
  return backButtonCloseEnabled;
};

/**
 * Toggles the back button modal closer setting on/off.
 */
export const setBackButtonCloseEnabled = (enabled: boolean) => {
  backButtonCloseEnabled = enabled;
  if (typeof window !== "undefined" && (window as any).useStore?.getState) {
    try {
      const storeState = (window as any).useStore.getState();
      if (storeState.backButtonClosesPopups !== enabled && storeState.setBackButtonClosesPopups) {
        storeState.setBackButtonClosesPopups(enabled);
      }
    } catch {
      // ignore
    }
  }

  if (!enabled && modalStack.length > 0) {
    // If disabled while popups are open, clean up any pushed history entries
    // so browser history doesn't retain dangling forward entries
    const statesToRewind =
      modalStack.filter((e) => e.hasHistoryState).length + pendingRewindCount;
    if (statesToRewind > 0) {
      ignorePopstateCount += statesToRewind;
      try {
        window.history.go(-statesToRewind);
      } catch {
        // ignore
      }
    }
    modalStack.forEach((e) => {
      e.hasHistoryState = false;
    });
    pendingRewindCount = 0;
  }
};

function ensurePopstateListener() {
  if (isListenerAttached || typeof window === "undefined") return;
  window.addEventListener("popstate", handlePopstate);
  isListenerAttached = true;
}

/**
 * Global popstate listener for back button navigation (desktop browser back,
 * mouse back button, Alt+Left, Android hardware back button, Android/iOS swipe back).
 */
export function handlePopstate(_event?: PopStateEvent) {
  // If this popstate was triggered by a programmatic history rewind (e.g. user clicked 'X'), ignore it
  if (ignorePopstateCount > 0) {
    ignorePopstateCount--;
    return;
  }

  // If a programmatic rewind was scheduled and user navigated back, consume one pending rewind
  if (pendingRewindCount > 0) {
    pendingRewindCount--;
    return;
  }

  // If the feature is disabled, do not intercept; allow standard browser navigation
  if (!isBackButtonCloseEnabled()) {
    return;
  }

  // If we have modals open, pop the topmost one (LIFO) and trigger its close handler
  if (modalStack.length > 0) {
    const topModal = modalStack.pop();
    if (topModal) {
      // The browser already popped this history entry by navigating back
      topModal.hasHistoryState = false;
      try {
        topModal.onClose();
      } catch (err) {
        console.error(`[modalBackHandler] Error executing onClose for "${topModal.id}":`, err);
      }
    }
    return;
  }

  // If modalStack is empty, do nothing! Normal browser navigation proceeds.
}

/**
 * Batches programmatic history rewinds when modals close via UI (X button, Esc, backdrop).
 */
function scheduleHistoryRewind(count: number) {
  if (typeof window === "undefined" || count <= 0) return;
  pendingRewindCount += count;

  if (rewindTimeoutId !== null) return;

  rewindTimeoutId = setTimeout(() => {
    rewindTimeoutId = null;
    const toRewind = pendingRewindCount;
    pendingRewindCount = 0;
    if (toRewind > 0) {
      ignorePopstateCount += toRewind;
      try {
        window.history.go(-toRewind);
      } catch {
        // ignore
      }
    }
  }, 0);
}

/**
 * Pushes a modal onto the modal back handler stack.
 * If enabled, also pushes a history state so back button closes this modal.
 */
export function pushModal(id: string, onClose: () => void) {
  if (typeof window === "undefined") return;
  ensurePopstateListener();

  // If modal with this id is already present, update its callback and bring it to top
  const existingIdx = modalStack.findIndex((e) => e.id === id);
  if (existingIdx !== -1) {
    modalStack[existingIdx].onClose = onClose;
    if (existingIdx !== modalStack.length - 1) {
      const [item] = modalStack.splice(existingIdx, 1);
      modalStack.push(item);
    }
    return;
  }

  const enabled = isBackButtonCloseEnabled();
  let hasHistory = false;

  if (enabled) {
    try {
      window.history.pushState(
        { __visualizerModal: id, __modalDepth: modalStack.length + 1 },
        "",
        window.location.href
      );
      hasHistory = true;
    } catch (err) {
      console.warn("[modalBackHandler] Failed to push history state:", err);
    }
  }

  modalStack.push({ id, onClose, hasHistoryState: hasHistory });
}

/**
 * Unregisters a modal when closed programmatically (e.g. from UI 'X' button or unmounting).
 * Cleans up the pushed history entry so browser history stays clean.
 */
export function popModal(id: string) {
  if (typeof window === "undefined") return;

  const idx = modalStack.findIndex((e) => e.id === id);
  if (idx === -1) {
    // Already removed (for instance, by handlePopstate when back button was clicked)
    return;
  }

  const [removed] = modalStack.splice(idx, 1);

  if (removed.hasHistoryState) {
    scheduleHistoryRewind(1);
  }
}

/**
 * Returns a copy of the current modal stack IDs (from bottom to top).
 */
export function getModalStack(): string[] {
  return modalStack.map((m) => m.id);
}

/**
 * Clears the modal stack and resets pending counters (used for cleanup or tests).
 */
export function clearModalStack() {
  modalStack = [];
  pendingRewindCount = 0;
  ignorePopstateCount = 0;
  if (rewindTimeoutId !== null) {
    clearTimeout(rewindTimeoutId);
    rewindTimeoutId = null;
  }
}

/**
 * Reset internal state for unit testing.
 */
export function _resetForTesting(options?: { removeListener?: boolean }) {
  clearModalStack();
  backButtonCloseEnabled = true;
  if (options?.removeListener && isListenerAttached && typeof window !== "undefined") {
    window.removeEventListener("popstate", handlePopstate);
    isListenerAttached = false;
  }
}

/**
 * React hook that registers a modal or overlay with the back button handler.
 * While `isOpen` is true, clicking back closes the modal.
 * When `isOpen` becomes false, its history state is safely unwound.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  id: string,
  options?: { enabled?: boolean }
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isActuallyEnabled = options?.enabled ?? true;

  useEffect(() => {
    if (!isOpen || !isActuallyEnabled) {
      return;
    }

    pushModal(id, () => {
      onCloseRef.current();
    });

    return () => {
      popModal(id);
    };
  }, [isOpen, isActuallyEnabled, id]);
}

/**
 * Clean up any stale modal history entry left on window reload so home canvas starts clean.
 */
if (typeof window !== "undefined") {
  try {
    if (window.history.state?.__visualizerModal) {
      window.history.replaceState(null, "", window.location.href);
    }
  } catch {
    // Ignore in non-browser envs
  }
}
