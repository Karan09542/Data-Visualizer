import React, { useCallback, useEffect, useRef, useState } from "react";

export type SashOrientation = "vertical" | "horizontal" | "corner";

interface WorkspaceSashProps {
  orientation: SashOrientation;
  /** Called once when a drag (or a keyboard nudge) begins - snapshot sizes here. */
  onStart: () => void;
  /** Total delta in px since onStart. */
  onDelta: (dx: number, dy: number) => void;
  onEnd?: () => void;
  /** Double click / Enter resets the pane to its default size. */
  onReset?: () => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  /** px moved per arrow key press */
  step?: number;
  /** Corner handles override the diagonal cursor depending on which corner they sit on. */
  cursor?: string;
}

const HOVER_DELAY = 250;

/**
 * A VS Code style sash: a 1px separator with a wide invisible hit area that
 * lights up in the accent colour while hovered or dragged. Works with mouse,
 * touch and pen (pointer events) plus arrow keys for accessibility.
 */
export function WorkspaceSash({
  orientation,
  onStart,
  onDelta,
  onEnd,
  onReset,
  label,
  className = "",
  style,
  step = 16,
  cursor,
}: WorkspaceSashProps) {
  const [dragging, setDragging] = useState(false);
  const [hot, setHot] = useState(false);
  const origin = useRef({ x: 0, y: 0 });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVertical = orientation === "vertical";
  const isCorner = orientation === "corner";
  const resolvedCursor =
    cursor || (isCorner ? "nwse-resize" : isVertical ? "col-resize" : "row-resize");

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  useEffect(() => clearHoverTimer, []);

  const endDrag = useCallback(() => {
    setDragging(false);
    document.body.classList.remove("vsc-resizing");
    document.body.style.cursor = "";
    onEnd?.();
  }, [onEnd]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
      return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
    origin.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    document.body.classList.add("vsc-resizing");
    document.body.style.cursor = resolvedCursor;
    onStart();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.preventDefault();
    onDelta(e.clientX - origin.current.x, e.clientY - origin.current.y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endDrag();
  };

  const nudge = (dx: number, dy: number) => {
    onStart();
    onDelta(dx, dy);
    onEnd?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const horizontalKeys = isVertical || isCorner;
    const verticalKeys = !isVertical || isCorner;
    if (horizontalKeys && e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(-step, 0);
    } else if (horizontalKeys && e.key === "ArrowRight") {
      e.preventDefault();
      nudge(step, 0);
    } else if (verticalKeys && e.key === "ArrowUp") {
      e.preventDefault();
      nudge(0, -step);
    } else if (verticalKeys && e.key === "ArrowDown") {
      e.preventDefault();
      nudge(0, step);
    } else if ((e.key === "Enter" || e.key === " ") && onReset) {
      e.preventDefault();
      onReset();
    }
  };

  const lit = dragging || hot;

  // The separator line itself keeps its 1px footprint in the flex layout while
  // the hit area (and the accent highlight) overhang it on both sides.
  const rootLayout = isCorner
    ? "absolute h-4 w-4"
    : isVertical
      ? "relative shrink-0 w-px self-stretch"
      : "relative shrink-0 h-px w-full";

  const hitArea = isCorner
    ? "absolute inset-0"
    : isVertical
      ? "absolute inset-y-0 -left-[3px] -right-[3px]"
      : "absolute inset-x-0 -top-[3px] -bottom-[3px]";

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      tabIndex={0}
      title={onReset ? `${label} (double click to reset)` : label}
      onKeyDown={handleKeyDown}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      style={style}
      className={`${rootLayout} z-40 outline-none ${
        isCorner ? "" : "bg-[var(--vsc-border)]"
      } ${className}`}
    >
      {/* Accent highlight, drawn over the neighbouring panes like VS Code. */}
      {!isCorner && (
        <div
          className={`pointer-events-none absolute transition-opacity duration-150 ${
            isVertical ? "inset-y-0 -left-px -right-px" : "inset-x-0 -top-px -bottom-px"
          } bg-[var(--vsc-accent)] ${lit ? "opacity-100" : "opacity-0"}`}
        />
      )}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerEnter={() => {
          clearHoverTimer();
          hoverTimer.current = setTimeout(() => setHot(true), HOVER_DELAY);
        }}
        onPointerLeave={() => {
          clearHoverTimer();
          if (!dragging) setHot(false);
        }}
        onDoubleClick={(e) => {
          if (!onReset) return;
          e.preventDefault();
          e.stopPropagation();
          onReset();
        }}
        data-orientation={orientation}
        style={{ cursor: resolvedCursor, touchAction: "none" }}
        className={`vsc-sash-hit ${hitArea} z-50`}
      >
        {isCorner && (
          <div
            className={`absolute inset-1 rounded-[2px] transition-colors ${
              lit
                ? "bg-[var(--vsc-accent)]"
                : "bg-[var(--vsc-border-strong)] opacity-70"
            }`}
          />
        )}
      </div>
    </div>
  );
}

export default WorkspaceSash;
