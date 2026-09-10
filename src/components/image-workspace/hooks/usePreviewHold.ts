import { useCallback, useEffect, useRef } from 'react';

/**
 * "Show me what this would look like" for a list of choices.
 *
 * A menu of blend modes or type presets is unreadable as words - the only way to know what
 * "Color Burn" does to *this* layer is to see it. Hovering previews on a mouse; touch has no
 * hover, so a press-and-hold stands in for it.
 *
 * The preview never goes through the history: it writes straight to the canvas and is undone by
 * restoring what was captured, so scrubbing a menu cannot fill the undo stack with states the user
 * never chose.
 */

export interface PreviewHoldHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchMove: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

interface Options<T> {
  /** Apply the preview for one choice. */
  preview: (value: T) => void;
  /** Put back whatever was there before the preview. */
  revert: () => void;
  /** How long a touch must be held before it counts as "show me", in ms. */
  holdMs?: number;
}

export function usePreviewHold<T>({ preview, revert, holdMs = 350 }: Options<T>) {
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const heldRef = useRef(false);

  // Read through refs so the handlers stay stable and a re-render mid-preview cannot strand a
  // preview with no way to revert it.
  const previewRef = useRef(preview);
  const revertRef = useRef(revert);
  useEffect(() => { previewRef.current = preview; }, [preview]);
  useEffect(() => { revertRef.current = revert; }, [revert]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearTimer();
    if (!activeRef.current) return;
    activeRef.current = false;
    revertRef.current();
  }, []);

  const start = useCallback((value: T) => {
    activeRef.current = true;
    previewRef.current(value);
  }, []);

  // A menu can close, or the panel unmount, while a preview is showing.
  useEffect(() => stop, [stop]);

  const bind = useCallback((value: T): PreviewHoldHandlers => ({
    onMouseEnter: () => start(value),
    onMouseLeave: stop,
    onTouchStart: () => {
      clearTimer();
      heldRef.current = false;
      timerRef.current = window.setTimeout(() => {
        heldRef.current = true;
        start(value);
      }, holdMs);
    },
    // Sliding a finger means scrolling the menu, not choosing; end the preview and let it scroll.
    onTouchMove: stop,
    onTouchEnd: stop,
    onTouchCancel: stop
  }), [start, stop, holdMs]);

  /**
   * True when the click about to fire is the tail of a press-and-hold, which was a request to look
   * rather than to choose. Reading it clears it.
   */
  const consumeHoldClick = useCallback(() => {
    const held = heldRef.current;
    heldRef.current = false;
    return held;
  }, []);

  return { bind, stop, consumeHoldClick };
}
