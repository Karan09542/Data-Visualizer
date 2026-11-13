import { useCallback, useState } from "react";

const PREFIX = "mathNode.open.";

function read(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === "1" ? true : v === "0" ? false : fallback;
  } catch {
    // Private window or blocked storage: the default.
    return fallback;
  }
}

/**
 * Whether a collapsible section is open, remembered in this browser across reloads.
 * `key` names the section (e.g. "examples"); every graph shares it, as a preference.
 */
export function usePersistentOpen(
  key: string,
  fallback = true,
): [boolean, (next: boolean | ((open: boolean) => boolean)) => void] {
  const [open, setOpenState] = useState(() => read(key, fallback));
  const setOpen = useCallback(
    (next: boolean | ((open: boolean) => boolean)) => {
      setOpenState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        try {
          localStorage.setItem(PREFIX + key, value ? "1" : "0");
        } catch {
          // Still applies for this visit.
        }
        return value;
      });
    },
    [key],
  );
  return [open, setOpen];
}
