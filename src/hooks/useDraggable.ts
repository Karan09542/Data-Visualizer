import React, { useState, useEffect, useRef, useCallback } from "react";

export interface Position {
  x: number;
  y: number;
}

export interface UseDraggableOptions {
  /** LocalStorage key to save and restore coordinates */
  storageKey?: string;
  /** Default position if none saved. Function or object */
  defaultPosition?: Position | (() => Position);
  /** Margin from viewport edges in pixels (default: 16) */
  edgePadding?: number;
  /** Movement in px before a pointer down is considered a drag (default: 4) */
  dragThreshold?: number;
  /** Milliseconds to hold for long press on mobile/touch (default: 500) */
  longPressDelay?: number;
  /** Callback when long-press triggers (touch/pen) */
  onLongPress?: () => void;
  /** Callback when right-click triggers (desktop) */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Whether dragging is currently disabled */
  disabled?: boolean;
}

export interface UseDraggableReturn {
  position: Position;
  setPosition: React.Dispatch<React.SetStateAction<Position>>;
  setAndSavePosition: (pos: Position) => void;
  resetPosition: () => void;
  isDragging: boolean;
  targetRef: React.RefObject<HTMLDivElement | null>;
  dragProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onClickCapture: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
  };
  docking: {
    isTop: boolean;
    isLeft: boolean;
  };
}

export function useDraggable({
  storageKey,
  defaultPosition,
  edgePadding = 16,
  dragThreshold = 4,
  longPressDelay = 500,
  onLongPress,
  onContextMenu: onContextMenuProp,
  disabled = false,
}: UseDraggableOptions = {}): UseDraggableReturn {
  const targetRef = useRef<HTMLDivElement | null>(null);

  // Helper to clamp a position given element width & height
  const clampPosition = useCallback(
    (pos: Position, width: number, height: number): Position => {
      if (typeof window === "undefined") return pos;
      const minX = edgePadding;
      const minY = edgePadding;
      const maxX = Math.max(minX, window.innerWidth - width - edgePadding);
      const maxY = Math.max(minY, window.innerHeight - height - edgePadding);

      return {
        x: Math.round(Math.min(Math.max(minX, pos.x), maxX)),
        y: Math.round(Math.min(Math.max(minY, pos.y), maxY)),
      };
    },
    [edgePadding]
  );

  // Compute initial position
  const getInitialPosition = useCallback((): Position => {
    if (typeof window === "undefined") return { x: 16, y: 16 };

    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
            return clampPosition(parsed, 64, 64);
          }
        }
      } catch {
        // Fallback if parsing fails
      }
    }

    if (typeof defaultPosition === "function") {
      return defaultPosition();
    }
    if (defaultPosition) {
      return defaultPosition;
    }

    return {
      x: Math.max(edgePadding, window.innerWidth - 88 - edgePadding),
      y: Math.max(edgePadding, window.innerHeight - 88 - edgePadding),
    };
  }, [storageKey, defaultPosition, edgePadding, clampPosition]);

  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const positionRef = useRef<Position>(position);
  positionRef.current = position;

  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const onContextMenuRef = useRef(onContextMenuProp);
  onContextMenuRef.current = onContextMenuProp;

  const pressTimerRef = useRef<number | null>(null);
  const swallowClickRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPosRef = useRef<Position>({ x: 0, y: 0 });
  const elSizeRef = useRef<{ w: number; h: number }>({ w: 64, h: 64 });

  const cancelLongPress = useCallback(() => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const setAndSavePosition = useCallback(
    (newPos: Position) => {
      const el = targetRef.current;
      const rect = el?.getBoundingClientRect();
      const w = rect?.width || elSizeRef.current.w;
      const h = rect?.height || elSizeRef.current.h;
      const clamped = clampPosition(newPos, w, h);
      positionRef.current = clamped;
      setPosition(clamped);
      if (el) {
        el.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
      }
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(clamped));
        } catch {}
      }
    },
    [clampPosition, storageKey]
  );

  const resetPosition = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    let def: Position;
    if (typeof defaultPosition === "function") {
      def = defaultPosition();
    } else if (defaultPosition) {
      def = defaultPosition;
    } else {
      def = {
        x: Math.max(edgePadding, window.innerWidth - 88 - edgePadding),
        y: Math.max(edgePadding, window.innerHeight - 88 - edgePadding),
      };
    }
    setAndSavePosition(def);
  }, [defaultPosition, edgePadding, setAndSavePosition, storageKey]);

  // Keep target DOM node transform in sync on mount and state updates
  useEffect(() => {
    const el = targetRef.current;
    if (el) {
      el.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    }
  }, [position]);

  // Re-clamp on window resize or when element size changes (e.g. expanding/collapsing)
  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const handleResize = () => {
      if (isDraggingRef.current) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        elSizeRef.current = { w: rect.width, h: rect.height };
        const prev = positionRef.current;
        const clamped = clampPosition(prev, rect.width, rect.height);
        if (clamped.x !== prev.x || clamped.y !== prev.y) {
          positionRef.current = clamped;
          setPosition(clamped);
          el.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0)`;
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(clamped));
            } catch {}
          }
        }
      }
    };

    handleResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(el);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [clampPosition, storageKey]);

  useEffect(() => {
    return () => {
      cancelLongPress();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [cancelLongPress]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Allow only primary mouse button or touch/pen
      if (e.button !== 0) return;

      const targetEl = targetRef.current;
      if (!targetEl) return;

      swallowClickRef.current = false;
      isDraggingRef.current = false;
      dragStartedRef.current = false;

      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      initialPosRef.current = { ...positionRef.current };

      // Measure dimensions ONCE on pointer down - 0 layout reflows during move!
      const rect = targetEl.getBoundingClientRect();
      elSizeRef.current = { w: rect.width || 64, h: rect.height || 64 };

      cancelLongPress();

      // Touch / pen long press handling
      if (e.pointerType !== "mouse" && onLongPressRef.current) {
        pressTimerRef.current = window.setTimeout(() => {
          pressTimerRef.current = null;
          swallowClickRef.current = true;
          try {
            navigator.vibrate?.(10);
          } catch {}
          onLongPressRef.current?.();
        }, longPressDelay);
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...positionRef.current };
      const elWidth = elSizeRef.current.w;
      const elHeight = elSizeRef.current.h;

      let latestX = startPos.x;
      let latestY = startPos.y;

      const onPointerMove = (moveEvt: PointerEvent) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        const dist = Math.hypot(dx, dy);

        // Cancel long press once movement exceeds small slop
        if (dist > 8) {
          cancelLongPress();
        }

        // Start drag once movement exceeds threshold
        if (!dragStartedRef.current && dist >= dragThreshold) {
          dragStartedRef.current = true;
          isDraggingRef.current = true;
          setIsDragging(true);
          cancelLongPress();

          try {
            targetEl.setPointerCapture(moveEvt.pointerId);
          } catch {}
        }

        if (dragStartedRef.current) {
          const minX = edgePadding;
          const minY = edgePadding;
          const maxX = Math.max(minX, window.innerWidth - elWidth - edgePadding);
          const maxY = Math.max(minY, window.innerHeight - elHeight - edgePadding);

          latestX = Math.round(Math.min(Math.max(minX, startPos.x + dx), maxX));
          latestY = Math.round(Math.min(Math.max(minY, startPos.y + dy), maxY));

          positionRef.current = { x: latestX, y: latestY };

          // Direct GPU-accelerated hardware transform update - ZERO LATENCY
          targetEl.style.transform = `translate3d(${latestX}px, ${latestY}px, 0)`;

          // Sync React state on next animation frame
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = null;
              setPosition({ x: latestX, y: latestY });
            });
          }
        }
      };

      const onPointerUp = (upEvt: PointerEvent) => {
        cancelLongPress();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);

        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        try {
          targetEl.releasePointerCapture(upEvt.pointerId);
        } catch {}

        if (dragStartedRef.current) {
          dragStartedRef.current = false;
          isDraggingRef.current = false;
          setIsDragging(false);

          // Swallow upcoming click event so underlying buttons/toggles don't fire
          swallowClickRef.current = true;

          const finalPos = { x: latestX, y: latestY };
          positionRef.current = finalPos;
          setPosition(finalPos);
          targetEl.style.transform = `translate3d(${finalPos.x}px, ${finalPos.y}px, 0)`;

          // Save final position to localStorage
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, JSON.stringify(finalPos));
            } catch {}
          }

          window.setTimeout(() => {
            swallowClickRef.current = false;
          }, 250);
        }
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [disabled, longPressDelay, dragThreshold, cancelLongPress, edgePadding, storageKey]
  );

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (swallowClickRef.current) {
      swallowClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      cancelLongPress();
      if (onContextMenuRef.current) {
        e.preventDefault();
        onContextMenuRef.current(e);
      }
    },
    [cancelLongPress]
  );

  const docking = {
    isTop: position.y < (typeof window !== "undefined" ? window.innerHeight / 2 : 400),
    isLeft: position.x < (typeof window !== "undefined" ? window.innerWidth / 2 : 500),
  };

  return {
    position,
    setPosition,
    setAndSavePosition,
    resetPosition,
    isDragging,
    targetRef,
    dragProps: {
      onPointerDown,
      onContextMenu,
      onClickCapture,
      style: {
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        touchAction: "none",
        WebkitTouchCallout: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        willChange: isDragging ? "transform" : undefined,
        transition: isDragging ? "none" : undefined,
        cursor: isDragging ? "grabbing" : "grab",
      },
    },
    docking,
  };
}
