import React, { useLayoutEffect, useRef, useState } from "react";

export type BoxTone = "plain" | "active" | "carry" | "done" | "added" | "muted" | "answer";

/** One box. It can hold several digits that belong together, like the 44 carried out of 443. */
export interface BoxCell {
  v: string;
  tone?: BoxTone;
  /** A handle for animations: rendered as data-anim. */
  id?: string;
}

export interface BoxGroup {
  /** Shorthand: one box per character. */
  digits?: string;
  /** Or the boxes themselves; a plain string is a box with the group's tone. */
  cells?: (string | BoxCell)[];
  /** The tone of boxes that don't set their own. */
  tone?: BoxTone;
  /** A small note under the group, such as how it was made: "5 × 6". */
  caption?: string;
  /** The separator before this group, instead of the shared one: "×", "=", "|". */
  sepBefore?: string | null;
  /** A handle for animations: the group gets data-anim={id}, its separator {id}-sep. */
  id?: string;
}

/** A curved arrow from one group to another (by index), drawn above the boxes. */
export interface BoxArrow {
  from: number;
  to: number;
  label?: string;
  /** Where along each group the arrow leaves and lands, 0 (left edge) to 1 (right edge). */
  fromAt?: number;
  toAt?: number;
  /** Or exactly: leave from the middle of these cells (first, last), land on the middle of this cell. */
  fromCells?: [number, number];
  toCell?: number;
  /** A handle for animations: the line is data-anim={id}, its head {id}-head, its label {id}-label. */
  id?: string;
}

interface NumberBoxesProps {
  groups: BoxGroup[];
  /** Space between successive boxes in a group, in px; 0 joins them into one strip. */
  gap?: number;
  /** Shown between groups; null for none. */
  separator?: string | null;
  arrows?: BoxArrow[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Sizes follow the panel (an @container), so a row of boxes still fits on a phone.
const SIZE = {
  sm: { box: "h-7 min-w-7 text-sm @md:h-8 @md:min-w-8 @md:text-[15px]", sep: "text-base mx-1 @md:text-lg @md:mx-1.5", arrowSpace: 34 },
  md: { box: "h-8 min-w-8 text-base @md:h-10 @md:min-w-10 @md:text-lg", sep: "text-xl mx-1 @md:text-2xl @md:mx-2", arrowSpace: 40 },
  lg: { box: "h-10 min-w-10 text-xl @md:h-12 @md:min-w-12 @md:text-2xl", sep: "text-2xl mx-1.5 @md:text-3xl @md:mx-2.5", arrowSpace: 46 },
};
const CAPTION_SPACE = 22;

/** Fill and text of a box, light and dark. */
const FILL: Record<BoxTone, string> = {
  plain: "bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100",
  active: "bg-amber-50 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  // A digit on its way to the next place: the same colour as the arrow that carries it.
  carry: "bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  done: "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300",
  added: "bg-sky-50 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  muted: "bg-slate-50 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500",
  answer: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
};
const BORDER: Record<BoxTone, string> = {
  plain: "border-slate-300 dark:border-slate-600",
  active: "border-amber-400 dark:border-amber-400/60",
  carry: "border-rose-300 dark:border-rose-400/50",
  done: "border-emerald-300 dark:border-emerald-400/50",
  added: "border-sky-300 dark:border-sky-400/50",
  muted: "border-slate-200 dark:border-slate-700",
  answer: "border-emerald-600 dark:border-emerald-500",
};
/** The lines between joined boxes. */
const DIVIDER: Record<BoxTone, string> = {
  plain: "border-slate-200 dark:border-slate-700",
  active: "border-amber-200 dark:border-amber-400/30",
  carry: "border-rose-200 dark:border-rose-400/30",
  done: "border-emerald-200 dark:border-emerald-400/30",
  added: "border-sky-200 dark:border-sky-400/30",
  muted: "border-slate-200 dark:border-slate-700",
  answer: "border-emerald-500 dark:border-emerald-600",
};
const MIXED_BORDER = "border-slate-300 dark:border-slate-600";
const MIXED_DIVIDER = "border-slate-200 dark:border-slate-700";

/** A box's colours (fill, text and border) for its tone, for boxes drawn outside NumberBoxes. */
export const boxTone = (tone: BoxTone = "plain") => `${FILL[tone]} ${BORDER[tone]}`;

const cellsOf = (g: BoxGroup): BoxCell[] => (g.cells ?? [...(g.digits ?? "")]).map((c) => (typeof c === "string" ? { v: c } : c));

interface DrawnArrow {
  d: string;
  /** Places and turns the arrowhead at the end of the curve. */
  head: string;
  lx: number;
  ly: number;
  label?: string;
  id?: string;
}

/**
 * Numbers written in boxes, in groups split by a separator: 05/35/15 or 30|21.
 * A group's boxes can join into one strip or sit apart; a box can hold more than
 * one digit; a group can have a caption under it; and curved arrows can show what
 * moves from one group to another.
 */
export const NumberBoxes: React.FC<NumberBoxesProps> = ({ groups, gap = 0, separator = "/", arrows, size = "md", className = "" }) => {
  const s = SIZE[size];
  const joined = gap <= 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drawn, setDrawn] = useState<DrawnArrow[]>([]);
  const hasArrows = !!arrows?.length;
  const hasCaptions = groups.some((g) => g.caption);
  const layoutKey = JSON.stringify([groups, arrows, gap, size]);

  // The arrows go where the boxes actually are, measured before the first paint.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !hasArrows) {
      setDrawn([]);
      return;
    }
    // Layout positions (offsets), not screen rectangles: they ignore the canvas zoom and any
    // animation holding a group shrunk or shifted, so the arrow is drawn where the boxes rest.
    const at = (el: HTMLElement) => {
      let x = 0;
      let y = 0;
      for (let e: HTMLElement | null = el; e && e !== root; e = e.offsetParent as HTMLElement | null) {
        x += e.offsetLeft;
        y += e.offsetTop;
      }
      return { left: x, top: y, width: el.offsetWidth };
    };
    const measure = () => {
      const out: DrawnArrow[] = [];
      for (const a of arrows!) {
        const from = groupRefs.current[a.from];
        const to = groupRefs.current[a.to];
        if (!from || !to) continue;
        const fr = at(from);
        const tr = at(to);
        // From one part of a group to the facing part of the other, like a hand-drawn hop.
        const leftwards = tr.left < fr.left;
        // The middle of cells first…last of a group, so gaps between boxes don't skew it.
        const cellsMid = (group: HTMLDivElement, first: number, last: number) => {
          const c0 = group.children[first] as HTMLElement | undefined;
          const c1 = group.children[last] as HTMLElement | undefined;
          if (!c0 || !c1) return null;
          const p0 = at(c0);
          const p1 = at(c1);
          return (p0.left + p1.left + p1.width) / 2;
        };
        const fx = a.fromCells ? cellsMid(from, a.fromCells[0], a.fromCells[1]) : null;
        const tx = a.toCell !== undefined ? cellsMid(to, a.toCell, a.toCell) : null;
        const x1 = fx ?? fr.left + fr.width * (a.fromAt ?? (leftwards ? 0.4 : 0.6));
        const x2 = tx ?? tr.left + tr.width * (a.toAt ?? (leftwards ? 0.6 : 0.4));
        const y = Math.min(fr.top, tr.top) - 3;
        const lift = Math.min(s.arrowSpace - 14, 12 + Math.abs(x1 - x2) * 0.18);
        const cx = (x1 + x2) / 2;
        // The curve's direction where it lands, for the head: from the control point to the end.
        const angle = (Math.atan2(2 * lift, x2 - cx) * 180) / Math.PI;
        out.push({
          d: `M ${x1} ${y} Q ${cx} ${y - 2 * lift} ${x2} ${y}`,
          head: `translate(${x2} ${y}) rotate(${angle})`,
          lx: cx,
          ly: y - lift,
          label: a.label,
          id: a.id,
        });
      }
      setDrawn(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, hasArrows]);

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex items-center ${className}`}
      style={{ paddingTop: hasArrows ? s.arrowSpace : undefined, paddingBottom: hasCaptions ? CAPTION_SPACE : undefined }}
      role="img"
      aria-label={groups.map((g) => cellsOf(g).map((c) => c.v).join("")).join(" / ")}
    >
      {groups.map((g, gi) => {
        const cells = cellsOf(g);
        const toneOf = (c: BoxCell) => c.tone ?? g.tone ?? "plain";
        const sameTone = cells.length > 0 && cells.every((c) => toneOf(c) === toneOf(cells[0]));
        const ref = (el: HTMLDivElement | null) => {
          groupRefs.current[gi] = el;
        };
        const sep = gi > 0 ? (g.sepBefore !== undefined ? g.sepBefore : separator) : null;
        return (
          <React.Fragment key={gi}>
            {sep && (
              <span data-anim={g.id ? `${g.id}-sep` : undefined} className={`select-none font-light text-slate-300 dark:text-slate-600 ${s.sep}`}>
                {sep}
              </span>
            )}
            <div className="relative" data-anim={g.id}>
              {joined ? (
                // One strip with one outline; the boxes are split by thin lines.
                <div ref={ref} className={`flex overflow-hidden rounded-lg border ${sameTone ? BORDER[toneOf(cells[0])] : MIXED_BORDER}`}>
                  {cells.map((c, i) => (
                    <span
                      key={i}
                      data-anim={c.id}
                      className={`inline-flex items-center justify-center px-2 font-medium tabular-nums ${s.box} ${FILL[toneOf(c)]} ${i > 0 ? `border-l ${sameTone ? DIVIDER[toneOf(c)] : MIXED_DIVIDER}` : ""}`}
                    >
                      {c.v}
                    </span>
                  ))}
                </div>
              ) : (
                <div ref={ref} className="flex" style={{ gap }}>
                  {cells.map((c, i) => (
                    <span key={i} data-anim={c.id} className={`inline-flex items-center justify-center rounded-lg border px-2 font-medium tabular-nums ${s.box} ${FILL[toneOf(c)]} ${BORDER[toneOf(c)]}`}>
                      {c.v}
                    </span>
                  ))}
                </div>
              )}
              {g.caption && (
                <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {g.caption}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {drawn.length > 0 && (
        <>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            {drawn.map((a, i) => (
              <g key={i}>
                <path data-anim={a.id} d={a.d} fill="none" strokeWidth={1.75} strokeLinecap="round" className="stroke-rose-500 dark:stroke-rose-400" />
                {/* Its own shape, not a marker, so an animation can show it when the line arrives. */}
                <path data-anim={a.id ? `${a.id}-head` : undefined} d="M 1 0 L -6 -4 L -6 4 Z" transform={a.head} className="fill-rose-500 dark:fill-rose-400" />
              </g>
            ))}
          </svg>
          {drawn.map((a, i) =>
            a.label ? (
              <span
                key={i}
                data-anim={a.id ? `${a.id}-label` : undefined}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md bg-rose-50 px-1.5 text-[11px] font-semibold leading-4 tabular-nums text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800"
                style={{ left: a.lx, top: a.ly }}
              >
                {a.label}
              </span>
            ) : null,
          )}
        </>
      )}
    </div>
  );
};

/**
 * Shrinks what it holds to fit the width it's given, keeping every box and arrow
 * in proportion (the arrows measure through the scale), instead of scrolling a
 * long row of boxes off the side of a phone.
 */
export const FitWidth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height?: number }>({ scale: 1 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      // offsetWidth/Height ignore the scale, so measuring never feeds back into itself.
      const natural = i.offsetWidth;
      const room = o.clientWidth;
      const scale = natural > room && room > 0 ? room / natural : 1;
      setFit((f) => (f.scale === scale ? f : { scale, height: scale < 1 ? i.offsetHeight * scale : undefined }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} style={{ height: fit.height }}>
      <div ref={inner} className="inline-block w-max origin-top-left" style={{ transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined }}>
        {children}
      </div>
    </div>
  );
};

/** Rows of boxes stacked and lined up on the right, as a sum is written: 53 / × 57 / ──── / 30|21. */
export const BoxStack: React.FC<{
  rows: { label?: string; node: React.ReactNode; rule?: boolean }[];
}> = ({ rows }) => (
  <div className="inline-flex flex-col items-end gap-2">
    {rows.map((row, i) => (
      <div key={i} className={`flex items-center gap-2 ${row.rule ? "w-full justify-end border-t-2 border-slate-300 pt-2 dark:border-slate-600" : ""}`}>
        {row.label && <span className="text-lg text-slate-400 dark:text-slate-500">{row.label}</span>}
        {row.node}
      </div>
    ))}
  </div>
);
