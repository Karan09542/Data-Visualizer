import React from "react";
import { boxTone, type BoxCell } from "./NumberBoxes";

/** A line from a digit of the top number (by index from the left) to one of the bottom number. */
export interface CrossLine {
  from: number;
  to: number;
  /** A handle for animations (data-anim). */
  id?: string;
}

const SIZE = {
  sm: { box: 30, gap: 12, rise: 26, font: 14 },
  md: { box: 40, gap: 16, rise: 34, font: 18 },
};

/**
 * Two numbers, one over the other, with straight lines joining the digits that are
 * multiplied together: down for a vertical pair, across for a crosswise one.
 */
export const CrossDiagram: React.FC<{
  top: BoxCell[];
  bottom: BoxCell[];
  lines: CrossLine[];
  size?: "sm" | "md";
  /** Shown left of the bottom number, as a sum is written: "×". */
  sign?: string;
}> = ({ top, bottom, lines, size = "md", sign }) => {
  const s = SIZE[size];
  const n = Math.max(top.length, bottom.length);
  const width = n * s.box + (n - 1) * s.gap;
  const height = 2 * s.box + s.rise;
  const x = (i: number) => i * (s.box + s.gap) + s.box / 2;
  const cell = (c: BoxCell, i: number, y: number) => (
    <span
      key={`${y}-${i}`}
      data-anim={c.id}
      className={`absolute flex items-center justify-center rounded-lg border font-medium tabular-nums ${boxTone(c.tone)}`}
      style={{ left: x(i) - s.box / 2, top: y, width: s.box, height: s.box, fontSize: s.font }}
    >
      {c.v}
    </span>
  );
  return (
    <div className="relative shrink-0" style={{ width, height, marginLeft: sign ? 22 : 0 }} role="img" aria-label={`${top.map((c) => c.v).join("")} × ${bottom.map((c) => c.v).join("")}`}>
      <svg className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height} aria-hidden>
        {lines.map((l, i) => (
          <line
            key={i}
            data-anim={l.id}
            x1={x(l.from)}
            y1={s.box + 3}
            x2={x(l.to)}
            y2={s.box + s.rise - 3}
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-amber-500 dark:stroke-amber-400"
          />
        ))}
      </svg>
      {top.map((c, i) => cell(c, i, 0))}
      {bottom.map((c, i) => cell(c, i, s.box + s.rise))}
      {sign && (
        <span className="absolute text-lg text-slate-400 dark:text-slate-500" style={{ left: -22, top: s.box + s.rise + s.box / 2, transform: "translateY(-50%)" }}>
          {sign}
        </span>
      )}
    </div>
  );
};
