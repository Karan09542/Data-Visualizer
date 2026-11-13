import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../../lib/db";
import {
  FILLABLE,
  STAMP_RANGE,
  SIZE_RANGE,
  isStamp,
  nextBadgeNumber,
  validShapes,
  type MarkupShape,
  type MarkupTool,
} from "./markupModel";

/** How the next mark looks; kept between sessions (per browser, not per image). */
export interface MarkupStyle {
  tool: MarkupTool;
  color: string;
  /** Line thickness, pt. */
  size: number;
  /** Symbol size, pt. */
  stamp: number;
  fill: boolean;
}

const STYLE_KEY = "imageMarkup.style";
const DEFAULT_STYLE: MarkupStyle = { tool: "pen", color: "#ef4444", size: 4, stamp: 36, fill: false };
const HISTORY_LIMIT = 100;
const SAVE_DELAY = 300;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function loadStyle(): MarkupStyle {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (!raw) return DEFAULT_STYLE;
    const s = JSON.parse(raw);
    return {
      tool: typeof s.tool === "string" ? s.tool : DEFAULT_STYLE.tool,
      color: typeof s.color === "string" && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : DEFAULT_STYLE.color,
      size: clamp(Number(s.size) || DEFAULT_STYLE.size, SIZE_RANGE.min, SIZE_RANGE.max),
      stamp: clamp(Number(s.stamp) || DEFAULT_STYLE.stamp, STAMP_RANGE.min, STAMP_RANGE.max),
      fill: !!s.fill,
    };
  } catch {
    return DEFAULT_STYLE;
  }
}

/** Saved now, or the record removed when there is nothing left. */
async function store(key: string, shapes: MarkupShape[]) {
  try {
    if (shapes.length) await db.imageMarkups.put({ key, shapes, updatedAt: Date.now() });
    else await db.imageMarkups.delete(key);
  } catch (err) {
    console.warn("Could not save the marks on this image", err);
  }
}

/**
 * The marks on one image, with undo and redo, saved as they change. `key` names the
 * image across reloads; with no key the marks still work but are not kept.
 */
export function useImageMarkup(key: string | null) {
  const [shapes, setShapesState] = useState<MarkupShape[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [style, setStyleState] = useState<MarkupStyle>(loadStyle);
  const past = useRef<MarkupShape[][]>([]);
  const future = useRef<MarkupShape[][]>([]);
  const [, bump] = useState(0);

  // Latest values, for the save that runs after the image changes.
  const live = useRef({ key, shapes });
  live.current = { key, shapes };
  const dirty = useRef(false);
  const saveTimer = useRef(0);

  const flush = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const { key: k, shapes: s } = live.current;
    if (k) void store(k, s);
  }, []);

  // A different image: save what was drawn on the last one, then load this one's.
  useEffect(() => {
    let cancelled = false;
    setShapesState([]);
    setSelectedId(null);
    past.current = [];
    future.current = [];
    setLoaded(false);
    if (!key) {
      setLoaded(true);
      return;
    }
    db.imageMarkups
      .get(key)
      .then((rec) => {
        if (cancelled) return;
        setShapesState(validShapes(rec?.shapes));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
      flush();
    };
  }, [key, flush]);

  // Saved on leaving the page too.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  const schedule = useCallback(() => {
    dirty.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, SAVE_DELAY);
  }, [flush]);

  /** A change that can be undone. */
  const commit = useCallback(
    (next: MarkupShape[] | ((prev: MarkupShape[]) => MarkupShape[])) => {
      setShapesState((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        if (value === prev) return prev;
        past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), prev];
        future.current = [];
        return value;
      });
      schedule();
      bump((n) => n + 1);
    },
    [schedule],
  );

  /** A change while dragging: shown at once, recorded as one step by `finish` when it ends. */
  const preview = useCallback((next: MarkupShape[]) => setShapesState(next), []);

  /** The end of a drag that began at `before`: one undoable step from there to `after`. */
  const finish = useCallback(
    (before: MarkupShape[], after: MarkupShape[]) => {
      setShapesState(after);
      if (after === before) return;
      past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), before];
      future.current = [];
      schedule();
      bump((n) => n + 1);
    },
    [schedule],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setShapesState((cur) => {
      future.current.push(cur);
      return prev;
    });
    setSelectedId(null);
    schedule();
    bump((n) => n + 1);
  }, [schedule]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    setShapesState((cur) => {
      past.current.push(cur);
      return next;
    });
    setSelectedId(null);
    schedule();
    bump((n) => n + 1);
  }, [schedule]);

  const clear = useCallback(() => {
    setSelectedId(null);
    commit((prev) => (prev.length ? [] : prev));
  }, [commit]);

  const add = useCallback((shape: MarkupShape) => commit((prev) => [...prev, shape]), [commit]);

  const remove = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const gone = new Set(ids);
      setSelectedId((id) => (id && gone.has(id) ? null : id));
      commit((prev) => {
        const next = prev.filter((s) => !gone.has(s.id));
        return next.length === prev.length ? prev : next;
      });
    },
    [commit],
  );

  /** Restyles the selected mark with what changed, as one undoable step. */
  const restyle = useCallback(
    (patch: Partial<Pick<MarkupStyle, "color" | "size" | "stamp" | "fill">>) => {
      if (!selectedId) return;
      commit((prev) =>
        prev.map((s) => {
          if (s.id !== selectedId) return s;
          const out: any = { ...s };
          if (patch.color) out.color = patch.color;
          if (patch.size !== undefined) out.size = patch.size;
          if (patch.stamp !== undefined && isStamp(s)) out.stamp = patch.stamp;
          if (patch.fill !== undefined && FILLABLE.has(s.kind)) out.fill = patch.fill;
          return out as MarkupShape;
        }),
      );
    },
    [commit, selectedId],
  );

  const setStyle = useCallback((patch: Partial<MarkupStyle>) => {
    setStyleState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STYLE_KEY, JSON.stringify(next));
      } catch {
        /* private mode: still works for this visit */
      }
      return next;
    });
  }, []);

  return {
    shapes,
    loaded,
    persistent: !!key,
    style,
    setStyle,
    selectedId,
    setSelectedId,
    add,
    remove,
    restyle,
    commit,
    preview,
    finish,
    undo,
    redo,
    clear,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    nextBadge: () => nextBadgeNumber(live.current.shapes),
  };
}

export type ImageMarkupState = ReturnType<typeof useImageMarkup>;
