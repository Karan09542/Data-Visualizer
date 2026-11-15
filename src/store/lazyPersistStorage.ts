import type { PersistStorage, StorageValue } from "zustand/middleware";

/**
 * Where the settings store is kept, without slowing the page down.
 *
 * zustand's persist middleware saves after *every* store update: a drag frame, a hover,
 * an API response. With the document's code among the saved settings, each of those
 * turned the whole document into text and wrote it synchronously to localStorage
 * (66 writes of ~290 KB during a two-second drag). Here:
 *  - an update that changes nothing that is saved writes nothing;
 *  - otherwise the latest state is written at most once every `delay` ms;
 *  - anything pending is written at once when the page is hidden or closed.
 */
export function lazyPersistStorage<S>(
  delay = 800,
  store: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof localStorage !== "undefined" ? localStorage : null,
): PersistStorage<S> & { flush: () => void } {
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The saved values last time, by key: what "nothing changed" is checked against. */
  let lastSaved: Record<string, unknown> | null = null;

  const write = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const job = pending;
    pending = null;
    if (!job || !store) return;
    try {
      store.setItem(job.name, JSON.stringify(job.value));
    } catch (err) {
      // Full or blocked: the next change tries again.
      console.warn("Could not save the settings", err);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", write);
    window.addEventListener("beforeunload", write);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") write();
      });
    }
  }

  return {
    getItem: (name) => {
      if (!store) return null;
      const raw = store.getItem(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      const state = (value.state ?? {}) as Record<string, unknown>;
      if (lastSaved && unchanged(lastSaved, state)) return;
      lastSaved = { ...state };
      pending = { name, value };
      if (timer === undefined) timer = setTimeout(write, delay);
    },
    removeItem: (name) => {
      pending = null;
      lastSaved = null;
      store?.removeItem(name);
    },
    flush: write,
  };
}

/**
 * Whether every saved value is the one saved before. The store replaces what it changes,
 * so the same reference means the same value; a list rebuilt each time (the collapsed
 * nodes) is compared item by item.
 */
export function unchanged(before: Record<string, unknown>, now: Record<string, unknown>): boolean {
  const keys = Object.keys(now);
  if (keys.length !== Object.keys(before).length) return false;
  for (const k of keys) {
    const a = before[k];
    const b = now[k];
    if (a === b) continue;
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])) continue;
    return false;
  }
  return true;
}
