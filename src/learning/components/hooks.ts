import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/**
 * Time spent actually playing: runs only while `running` is true and the tab is visible.
 * `take()` hands over the time counted so far and starts counting again from zero, so the
 * caller can add it to the saved game state.
 */
export function useGameClock(running: boolean) {
  const banked = useRef(0);
  const resumedAt = useRef<number | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const sync = () => {
      const shouldRun = running && document.visibilityState === "visible";
      if (shouldRun && resumedAt.current === null) resumedAt.current = performance.now();
      if (!shouldRun && resumedAt.current !== null) {
        banked.current += performance.now() - resumedAt.current;
        resumedAt.current = null;
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    const tick = running ? window.setInterval(rerender, 1000) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(tick);
      if (resumedAt.current !== null) {
        banked.current += performance.now() - resumedAt.current;
        resumedAt.current = null;
      }
    };
  }, [running]);

  const peek = useCallback(
    () => banked.current + (resumedAt.current !== null ? performance.now() - resumedAt.current : 0),
    [],
  );

  const take = useCallback(() => {
    const ms = peek();
    banked.current = 0;
    if (resumedAt.current !== null) resumedAt.current = performance.now();
    return ms;
  }, [peek]);

  return { peek, take };
}

/** A value that switches back to null after `ms`, for one-off highlight animations. */
export function useTransient<T>(ms: number): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (next: T) => {
      window.clearTimeout(timer.current);
      setValue(next);
      timer.current = window.setTimeout(() => setValue(null), ms);
    },
    [ms],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [value, show];
}
