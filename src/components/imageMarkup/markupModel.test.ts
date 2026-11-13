import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bounds,
  hitTest,
  moveShape,
  nextBadgeNumber,
  ptUnit,
  shapeAt,
  shapesToSvg,
  simplify,
  strokePath,
  validShapes,
  type MarkupShape,
} from "./markupModel";

const unit = ptUnit(1200, 800); // 2 px per pt

test("pt is measured against the picture's long side", () => {
  assert.equal(ptUnit(1200, 800), 2);
  assert.equal(ptUnit(300, 600), 1);
});

test("simplify keeps the ends and the corners, drops points on a straight run", () => {
  const pts = [0, 0, 1, 0.01, 2, 0, 3, 0.02, 4, 0, 4, 1, 4, 2, 4, 3];
  const out = simplify(pts, 0.1);
  assert.deepEqual(out, [0, 0, 4, 0, 4, 3]);
  // Short lines are kept as they are.
  assert.deepEqual(simplify([1.234, 2.345], 1), [1.2, 2.3]);
});

test("strokePath draws a dot for a tap and curves through longer lines", () => {
  assert.match(strokePath([5, 5]), /^M5 5l0\.01 0$/);
  assert.equal(strokePath([0, 0, 10, 0]), "M0 0L10 0");
  assert.match(strokePath([0, 0, 10, 0, 10, 10]), /^M0 0Q10 0 10 5L10 10$/);
});

test("hitTest: near a line, on an outline, inside a filled shape", () => {
  const line: MarkupShape = { id: "l", kind: "line", color: "#f00", size: 2, x1: 0, y1: 0, x2: 100, y2: 0 };
  assert.ok(hitTest(line, 50, 3, unit, 2)); // within half its width (2) + slop
  assert.ok(!hitTest(line, 50, 10, unit, 2));

  const ring: MarkupShape = { id: "c", kind: "circle", color: "#f00", size: 2, x1: 0, y1: 0, x2: 50, y2: 0 };
  assert.ok(hitTest(ring, 50, 0, unit, 2));
  assert.ok(!hitTest(ring, 0, 0, unit, 2), "the middle of an outlined circle is empty");
  assert.ok(hitTest({ ...ring, fill: true } as MarkupShape, 0, 0, unit, 2), "a filled one is not");

  const box: MarkupShape = { id: "r", kind: "rect", color: "#f00", size: 2, x1: 100, y1: 100, x2: 0, y2: 0 };
  assert.ok(hitTest(box, 0, 50, unit, 2));
  assert.ok(!hitTest(box, 50, 50, unit, 2));

  const tick: MarkupShape = { id: "k", kind: "check", color: "#0f0", size: 3, cx: 10, cy: 10, stamp: 20 };
  // 20 pt across = 40 px: anywhere within its square.
  assert.ok(hitTest(tick, 25, 25, unit, 0));
  assert.ok(!hitTest(tick, 40, 10, unit, 0));
});

test("shapeAt picks the topmost mark", () => {
  const a: MarkupShape = { id: "a", kind: "rect", color: "#f00", size: 2, x1: 0, y1: 0, x2: 100, y2: 100, fill: true };
  const b: MarkupShape = { id: "b", kind: "star", color: "#f00", size: 2, cx: 50, cy: 50, stamp: 10 };
  assert.equal(shapeAt([a, b], 50, 50, unit, 1)?.id, "b");
  assert.equal(shapeAt([a, b], 5, 5, unit, 1)?.id, "a");
  assert.equal(shapeAt([a, b], 500, 500, unit, 1), null);
});

test("moveShape moves every kind; bounds include the line's thickness", () => {
  const pen: MarkupShape = { id: "p", kind: "pen", color: "#f00", size: 4, points: [0, 0, 10, 10] };
  assert.deepEqual((moveShape(pen, 5, -5) as any).points, [5, -5, 15, 5]);
  const arrow: MarkupShape = { id: "a", kind: "arrow", color: "#f00", size: 2, x1: 0, y1: 0, x2: 10, y2: 0 };
  const moved = moveShape(arrow, 1, 2) as any;
  assert.deepEqual([moved.x1, moved.y1, moved.x2, moved.y2], [1, 2, 11, 2]);
  const star: MarkupShape = { id: "s", kind: "star", color: "#f00", size: 2, cx: 0, cy: 0, stamp: 10 };
  assert.deepEqual([(moveShape(star, 3, 4) as any).cx, (moveShape(star, 3, 4) as any).cy], [3, 4]);
  const b = bounds(pen, unit); // 4 pt = 8 px wide: 4 px either side
  assert.deepEqual([b.x, b.y, b.w, b.h], [-4, -4, 18, 18]);
});

test("badges count on from the highest number", () => {
  assert.equal(nextBadgeNumber([]), 1);
  const badge = (n: number): MarkupShape => ({ id: `b${n}`, kind: "badge", color: "#f00", size: 2, cx: 0, cy: 0, stamp: 20, n });
  assert.equal(nextBadgeNumber([badge(1), badge(4), badge(2)]), 5);
});

test("validShapes keeps what can be drawn and drops the rest", () => {
  const good = [
    { id: "1", kind: "pen", color: "#f00", size: 2, points: [0, 0, 1, 1] },
    { id: "2", kind: "circle", color: "#f00", size: 2, x1: 0, y1: 0, x2: 1, y2: 1, fill: true },
    { id: "3", kind: "badge", color: "#f00", size: 2, cx: 0, cy: 0, stamp: 20, n: 1 },
  ];
  const bad = [
    null,
    { id: "4", kind: "pen", color: "#f00", size: 2, points: [] },
    { id: "5", kind: "hexagon", color: "#f00", size: 2 },
    { id: "6", kind: "rect", color: "#f00", size: 2, x1: 0, y1: 0, x2: "1", y2: 1 },
  ];
  assert.deepEqual(validShapes([...good, ...bad]).map((s) => s.id), ["1", "2", "3"]);
  assert.deepEqual(validShapes("nope"), []);
});

test("shapesToSvg draws every kind at the picture's size", () => {
  const all: MarkupShape[] = [
    { id: "1", kind: "pen", color: "#ef4444", size: 2, points: [0, 0, 5, 5, 10, 0] },
    { id: "2", kind: "highlighter", color: "#facc15", size: 4, points: [0, 0, 10, 0] },
    { id: "3", kind: "line", color: "#000000", size: 2, x1: 0, y1: 0, x2: 10, y2: 10 },
    { id: "4", kind: "arrow", color: "#000000", size: 2, x1: 0, y1: 0, x2: 100, y2: 0 },
    { id: "5", kind: "rect", color: "#000000", size: 2, x1: 0, y1: 0, x2: 10, y2: 10, fill: true },
    { id: "6", kind: "circle", color: "#000000", size: 2, x1: 50, y1: 50, x2: 60, y2: 50 },
    { id: "7", kind: "check", color: "#22c55e", size: 3, cx: 10, cy: 10, stamp: 20 },
    { id: "8", kind: "cross", color: "#ef4444", size: 3, cx: 10, cy: 10, stamp: 20 },
    { id: "9", kind: "star", color: "#facc15", size: 2, cx: 10, cy: 10, stamp: 20, fill: true },
    { id: "10", kind: "badge", color: "#6366f1", size: 2, cx: 10, cy: 10, stamp: 20, n: 7, fill: true },
  ];
  const svg = shapesToSvg(all, 1200, 800);
  assert.match(svg, /^<svg[^>]+width="1200" height="800" viewBox="0 0 1200 800">/);
  for (const tag of ["<path", "<line", "<polygon", "<rect", "<circle", "<text"]) assert.ok(svg.includes(tag), tag);
  assert.ok(svg.includes(">7</text>"));
  // A colour can't break out of its attribute.
  const evil = shapesToSvg([{ ...all[2], color: '#000" onload="x' } as MarkupShape], 10, 10);
  assert.ok(!evil.includes('"x'));
});
