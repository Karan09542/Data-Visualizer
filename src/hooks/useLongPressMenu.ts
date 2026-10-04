import React, { useCallback, useEffect, useRef } from "react";

/** How long a press has to last to count as a hold on a touch screen */
const LONG_PRESS_MS = 500;
/** A finger that moves further than this is scrolling, not pressing */
const LONG_PRESS_SLOP = 10;

/**
 * Handlers that call `open` on right-click (desktop) or press-and-hold (touch and pen).
 * Spread them on the element. The tap that ends a hold is swallowed in the capture phase, so
 * buttons inside the element don't also fire.
 */
export function useLongPressMenu(open: () => void) {
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const swallowClick = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const cancel = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      openRef.current();
    },
    onPointerDown: (e: React.PointerEvent) => {
      // A new press starts fresh, even if Android's own long-press menu ate the last tap
      swallowClick.current = false;
      if (e.pointerType === "mouse") return;
      cancel();
      const timer = window.setTimeout(() => {
        press.current = null;
        swallowClick.current = true;
        navigator.vibrate?.(10);
        openRef.current();
      }, LONG_PRESS_MS);
      press.current = { timer, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    // No iOS callout or text selection while holding
    style: { WebkitTouchCallout: "none", userSelect: "none" } as React.CSSProperties,
  };
}
