/**
 * Vector arithmetic as things drawn on the graph. Each result is built from the
 * vectors' own end points, so it stays right while they're dragged:
 *
 *   sum         a + b, with b carried to a's tip (and the parallelogram when
 *               they start from the same point)
 *   difference  a − b, with −b carried to a's tip
 *   multiple    k·a, on a slider: longer, shorter, or backwards for negative k
 *   dot         a · b as a live number (0 when they're perpendicular)
 */
import type { MathFunction } from "./mathTypes";
import { freeName, nextPointNames, vectorRows, type DrawnShape, type VectorOptions } from "./drawRows";

export type VectorOp = "sum" | "difference" | "multiple" | "dot";

/** A vector by the names of its end points. */
export interface NamedVector {
  tail: string;
  tip: string;
}

interface OpOptions {
  taken: Set<string>;
  /** For the result. */
  color: string;
  newId: () => string;
  vector?: VectorOptions;
}

const GUIDE = "#94a3b8";

export const VECTOR_OP_LABELS: Record<VectorOp, { label: string; title: string; needs: 1 | 2 }> = {
  sum: { label: "a + b", title: "Add them: the second is carried to the tip of the first", needs: 2 },
  difference: { label: "a − b", title: "Subtract the second from the first", needs: 2 },
  dot: { label: "a · b", title: "Their dot product, as a live number (0 when they're perpendicular)", needs: 2 },
  multiple: { label: "k × a", title: "A multiple of it, on a slider", needs: 1 },
};

export function buildVectorOp(op: VectorOp, vectors: NamedVector[], opts: OpOptions): DrawnShape | null {
  const [a, b] = vectors;
  if (!a || (VECTOR_OP_LABELS[op].needs === 2 && !b)) return null;
  const group = opts.newId();
  const base = { visible: true, autoType: false, angleUnit: "rad" as const, drawGroup: group };
  const row = (type: MathFunction["type"], expr: string, color: string, extra: Partial<MathFunction> = {}): MathFunction => ({
    ...base,
    id: opts.newId(),
    type,
    expr,
    color,
    ...extra,
  });
  const dashed = (from: string, along: string) =>
    row("parametric", `${from} + t*(${along})`, GUIDE, { tRange: [0, 1], lineStyle: "dashed", outlineWidth: 1.5 });
  const grouped = (rows: MathFunction[]) => rows.map((r) => ({ ...r, drawGroup: group }));

  const va = `(${a.tip} - ${a.tail})`;

  if (op === "multiple") {
    const [end] = nextPointNames(opts.taken, 1);
    const k = freeName(opts.taken, `k_${a.tail}${a.tip}`);
    return {
      rows: [
        // Dragging the end slides it along a's line, which sets k.
        row("point", `${end} = ${a.tail} + ${k}*${va}`, opts.color, { showLabel: true, label: end, dragVars: [k] }),
        ...grouped(vectorRows(a.tail, end, opts.color, opts)),
      ],
      sliders: [
        {
          name: k,
          value: 2,
          min: -3,
          max: 3,
          step: 0.05,
          description: `How many times ${a.tail}${a.tip}: drag ${end}. Negative turns it round.`,
        },
      ],
    };
  }

  const vb = `(${b.tip} - ${b.tail})`;

  if (op === "dot") {
    return {
      rows: [
        row("point", `(${a.tip} + ${b.tip})/2 + [0, 0.5]`, opts.color, {
          showPoint: false,
          showLabel: true,
          label: `\\overrightarrow{${a.tail}${a.tip}} \\cdot \\overrightarrow{${b.tail}${b.tip}} = {{dot(${va}, ${vb})}}`,
          labelLatex: true,
          labelAlignment: "center",
        }),
      ],
      sliders: [],
    };
  }

  const sign = op === "sum" ? "+" : "-";
  const [end] = nextPointNames(opts.taken, 1);
  const rows: MathFunction[] = [
    // Where a's tip ends up after going on by b (or back by b).
    row("point", `${end} = ${a.tip} ${sign} ${vb}`, opts.color, { showLabel: true, label: end }),
    // b carried to a's tip: tip to tail.
    dashed(a.tip, `${end} - ${a.tip}`),
  ];
  // From a common point the two make a parallelogram, and the sum is its diagonal.
  if (op === "sum" && a.tail === b.tail) rows.push(dashed(b.tip, va));
  rows.push(...grouped(vectorRows(a.tail, end, opts.color, opts)));
  return { rows, sliders: [] };
}
