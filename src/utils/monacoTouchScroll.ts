interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Attaches touch event listeners to a Monaco Editor instance to provide
 * smooth, native-feeling touch scrolling and inertia on mobile devices and touchscreens.
 *
 * @param editor Monaco editor instance (ICodeEditor)
 * @returns Cleanup function to remove listeners and cancel active momentum animations
 */
export function enableMonacoTouchScroll(editor: any): () => void {
  const domNode: HTMLElement | null = editor?.getDomNode?.();
  if (!domNode) {
    return () => {};
  }

  let startX = 0;
  let startY = 0;
  let startScrollTop = 0;
  let startScrollLeft = 0;
  let isDragging = false;
  let isTouchActive = false;
  let isMultiTouch = false;
  let touchHistory: TouchPoint[] = [];
  let momentumRaf: number | null = null;

  const stopMomentum = () => {
    if (momentumRaf !== null) {
      cancelAnimationFrame(momentumRaf);
      momentumRaf = null;
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    // If multi-touch (e.g. pinch to zoom or two fingers), abort custom single-finger drag
    if (e.touches.length > 1) {
      isMultiTouch = true;
      isDragging = false;
      stopMomentum();
      return;
    }

    // Stop any ongoing inertia scrolling immediately when finger touches screen
    stopMomentum();

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startScrollTop = editor.getScrollTop?.() ?? 0;
    startScrollLeft = editor.getScrollLeft?.() ?? 0;
    isDragging = false;
    isTouchActive = true;
    isMultiTouch = false;

    const now = performance.now();
    touchHistory = [{ x: touch.clientX, y: touch.clientY, time: now }];
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isTouchActive || isMultiTouch || e.touches.length !== 1) {
      return;
    }

    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Movement threshold to differentiate between a tap and a scroll drag
    if (!isDragging) {
      if (Math.hypot(dx, dy) > 6) {
        isDragging = true;
      } else {
        return;
      }
    }

    // Actively dragging: cancel default browser behavior to prevent page scroll or text selection
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    // Finger moving UP (dy < 0) increases scrollTop (moves content up)
    const targetScrollTop = startScrollTop - dy;
    const targetScrollLeft = startScrollLeft - dx;

    // 1 corresponds to ScrollType.Immediate in Monaco
    editor.setScrollPosition?.({
      scrollTop: targetScrollTop,
      scrollLeft: targetScrollLeft,
      scrollType: 1,
    });

    const now = performance.now();
    touchHistory.push({ x: touch.clientX, y: touch.clientY, time: now });
    // Keep history for the last 100ms to compute release velocity
    while (touchHistory.length > 0 && now - touchHistory[0].time > 100) {
      touchHistory.shift();
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!isTouchActive) return;
    isTouchActive = false;

    if (isMultiTouch) {
      if (e.touches.length === 0) {
        isMultiTouch = false;
      }
      return;
    }

    if (!isDragging) {
      // Tap gesture: do not prevent default, allowing Monaco to focus and place cursor
      return;
    }

    // Finished a drag: prevent synthesized mouse/click event to avoid repositioning cursor on finger lift
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    // Compute release velocity for momentum scrolling
    const now = performance.now();
    const recentTouches = touchHistory.filter((t) => now - t.time <= 80);

    if (recentTouches.length >= 2) {
      const oldest = recentTouches[0];
      const newest = recentTouches[recentTouches.length - 1];
      const dt = newest.time - oldest.time;

      if (dt > 10) {
        let vy = (newest.y - oldest.y) / dt; // px/ms
        let vx = (newest.x - oldest.x) / dt;

        const speed = Math.hypot(vx, vy);
        // Minimum speed threshold to start inertia
        if (speed > 0.15) {
          // Cap maximum speed for safety
          const maxSpeed = 3.0; // px/ms
          if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            vx *= scale;
            vy *= scale;
          }

          let lastFrameTime = performance.now();

          const momentumStep = (frameTime: number) => {
            const frameDt = Math.min(frameTime - lastFrameTime, 32);
            lastFrameTime = frameTime;

            // Exponential friction decay (smooth deceleration curve)
            const friction = Math.pow(0.93, frameDt / 16.67);
            vx *= friction;
            vy *= friction;

            if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) {
              momentumRaf = null;
              return;
            }

            const curTop = editor.getScrollTop?.() ?? 0;
            const curLeft = editor.getScrollLeft?.() ?? 0;
            const layout = editor.getLayoutInfo?.();
            const maxTop = Math.max(
              0,
              (editor.getScrollHeight?.() ?? 0) - (layout?.height ?? 0)
            );
            const maxLeft = Math.max(
              0,
              (editor.getScrollWidth?.() ?? 0) - (layout?.width ?? 0)
            );

            let nextTop = curTop - vy * frameDt;
            let nextLeft = curLeft - vx * frameDt;

            // Stop velocity along axis if boundary reached
            if (nextTop <= 0) {
              nextTop = 0;
              vy = 0;
            } else if (nextTop >= maxTop) {
              nextTop = maxTop;
              vy = 0;
            }

            if (nextLeft <= 0) {
              nextLeft = 0;
              vx = 0;
            } else if (nextLeft >= maxLeft) {
              nextLeft = maxLeft;
              vx = 0;
            }

            editor.setScrollPosition?.({
              scrollTop: nextTop,
              scrollLeft: nextLeft,
              scrollType: 1,
            });

            if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) {
              momentumRaf = null;
              return;
            }

            momentumRaf = requestAnimationFrame(momentumStep);
          };

          momentumRaf = requestAnimationFrame(momentumStep);
        }
      }
    }
  };

  // Attach touch listeners to domNode (passive: false for touchmove to allow preventing default on drag)
  domNode.addEventListener("touchstart", handleTouchStart, { passive: true });
  domNode.addEventListener("touchmove", handleTouchMove, { passive: false });
  domNode.addEventListener("touchend", handleTouchEnd, { passive: false });
  domNode.addEventListener("touchcancel", handleTouchEnd, { passive: false });

  return () => {
    stopMomentum();
    domNode.removeEventListener("touchstart", handleTouchStart);
    domNode.removeEventListener("touchmove", handleTouchMove);
    domNode.removeEventListener("touchend", handleTouchEnd);
    domNode.removeEventListener("touchcancel", handleTouchEnd);
  };
}
