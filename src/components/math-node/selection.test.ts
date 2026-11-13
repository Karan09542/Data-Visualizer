import { test } from "node:test";
import assert from "node:assert/strict";
import * as mathjs from "mathjs";
import type { MathFunction } from "./mathTypes";
import {
  canLiftPoints,
  canTurnInSpace,
  describeSelection,
  describeSelections,
  freePoint,
  selectionCentre,
  selectionCentre3,
  transformPoints,
} from "./selection";

const p3 = (v: any) => {
  const a = (v?.toArray ? v.toArray() : v) as number[];
  return mathjs.matrix([a[0], a[1], a[2] ?? 0]);
};

let n = 0;
const row = (type: MathFunction["type"], expr: string, extra: Partial<MathFunction> = {}): MathFunction =>
  ({ id: `r${++n}`, type, expr, color: "#000", visible: true, compiled: mathjs.compile(expr), ...extra }) as MathFunction;
const toValue = (c: number[]) => mathjs.matrix(c);
const exprOf = (m: Map<string, string>, f: MathFunction) => m.get(f.id);

test("freePoint reads flat points and points in space", () => {
  assert.deepEqual(freePoint(row("point", "A = [1, 2]")), { id: `r${n}`, name: "A", x: 1, y: 2 });
  assert.deepEqual(freePoint(row("point", "B = [1, -2.5, 3]")), { id: `r${n}`, name: "B", x: 1, y: -2.5, z: 3 });
  // A point placed by a formula isn't free.
  assert.equal(freePoint(row("point", "C = A + [1, 0]")), null);
  assert.equal(freePoint(row("point", "D = [1, 2, 3, 4]")), null);
});

test("a shape in space is selected with the points under it", () => {
  const A = row("point", "A = [0, 0]");
  const B = row("point", "B = [2, 0, 1]");
  const C = row("point", "C = [0, 2, 3]");
  const tri = row("polygon", "[p3(A), p3(B), p3(C)]", { drawGroup: "g" });
  const label = row("point", "(p3(A) + p3(B) + p3(C))/3", { drawGroup: "g" });
  const sel = describeSelection(tri.id, [A, B, C, tri, label], [])!;
  assert.deepEqual(sel.rowIds.sort(), [tri.id, label.id].sort());
  assert.deepEqual(sel.points.map((p) => p.name).sort(), ["A", "B", "C"]);
  // The centre counts a flat point as standing on the floor.
  const c = selectionCentre3(sel)!;
  assert.ok(Math.abs(c[0] - 2 / 3) < 1e-9 && Math.abs(c[1] - 2 / 3) < 1e-9 && Math.abs(c[2] - 4 / 3) < 1e-9);
  assert.deepEqual(selectionCentre(sel)!.map((v) => Number(v.toFixed(6))), [0.666667, 0.666667]);
});

test("moving in space: flat points stay flat until they are lifted", () => {
  const A = row("point", "A = [1, 2]");
  const B = row("point", "B = [3, 4, 5]");
  const seg = row("line", "[p3(A), p3(B)]");
  const sel = describeSelection(seg.id, [A, B, seg], [])!;
  const across = transformPoints(sel, { kind: "move", dx: 1, dy: -1 }, []).exprs;
  assert.equal(exprOf(across, A), "A = [2, 1]");
  assert.equal(exprOf(across, B), "B = [4, 3, 5]");
  const up = transformPoints(sel, { kind: "move", dx: 0, dy: 0, dz: 0.5 }, []).exprs;
  assert.equal(exprOf(up, A), "A = [1, 2, 0.5]");
  assert.equal(exprOf(up, B), "B = [3, 4, 5.5]");
  // A point in space brought down to the floor keeps its three coordinates.
  const down = transformPoints(sel, { kind: "move", dx: 0, dy: 0, dz: -5 }, []).exprs;
  assert.equal(exprOf(down, B), "B = [3, 4, 0]");
});

test("turning is about the upright axis: heights stay", () => {
  const A = row("point", "A = [1, 0, 2]");
  const B = row("point", "B = [-1, 0, 4]");
  const seg = row("line", "[A, B]");
  const sel = describeSelection(seg.id, [A, B, seg], [])!;
  const turned = transformPoints(sel, { kind: "rotate", angle: Math.PI / 2, centre: [0, 0] }, []).exprs;
  assert.equal(exprOf(turned, A), "A = [0, 1, 2]");
  assert.equal(exprOf(turned, B), "B = [0, -1, 4]");
});

test("resizing in space is about a point in space; on the flat graph heights stay", () => {
  const A = row("point", "A = [0, 0, 0]");
  const B = row("point", "B = [2, 2, 2]");
  const seg = row("line", "[A, B]");
  const sel = describeSelection(seg.id, [A, B, seg], [])!;
  const space = transformPoints(sel, { kind: "scale", factor: 2, centre: [1, 1], centreZ: 1 }, []).exprs;
  assert.equal(exprOf(space, A), "A = [-1, -1, -1]");
  assert.equal(exprOf(space, B), "B = [3, 3, 3]");
  const flat = transformPoints(sel, { kind: "scale", factor: 2, centre: [1, 1] }, []).exprs;
  assert.equal(exprOf(flat, B), "B = [3, 3, 2]");
});

test("a circle's radius slider grows with a resize, on any plane", () => {
  const C = row("point", "C = [0, 0, 1]");
  const variables = [{ id: "v", name: "r_C", value: 2, min: 0, max: 10, step: 0.01 }] as any;
  for (const ring of ["[cos(t rad), sin(t rad), 0]", "[cos(t rad), 0, sin(t rad)]", "[0, cos(t rad), sin(t rad)]"]) {
    const circle = row("parametric", `p3(C) + r_C*${ring}`.replace("p3(C)", "C"));
    const sel = describeSelection(circle.id, [C, circle], variables)!;
    assert.deepEqual(sel.sliders, ["r_C"], ring);
    assert.equal(transformPoints(sel, { kind: "scale", factor: 1.5, centre: [0, 0], centreZ: 1 }, variables).sliderValues.get("r_C"), 3);
  }
});

test("canTurnInSpace: not a circle standing on an upright plane", () => {
  const C = row("point", "C = [0, 0, 1]");
  const level = row("parametric", "C + 2*[cos(t rad), sin(t rad), 0]");
  const xz = row("parametric", "C + 2*[cos(t rad), 0, sin(t rad)]");
  const yz = row("parametric", "C + 2*[0, cos(t rad), sin(t rad)]");
  const sphere = row("function", "C + 2*[cos(u)*sin(v/2), cos(v/2), sin(u)*sin(v/2)]");
  const all = [C, level, xz, yz, sphere];
  assert.equal(canTurnInSpace(describeSelection(level.id, all, [])!, all), true);
  assert.equal(canTurnInSpace(describeSelection(xz.id, all, [])!, all), false);
  assert.equal(canTurnInSpace(describeSelection(yz.id, all, [])!, all), false);
  // A sphere looks the same however it is turned.
  assert.equal(canTurnInSpace(describeSelection(sphere.id, all, [])!, all), true);
});

test("canLiftPoints: only when no row would break", () => {
  const scope = { p3 };
  const A = row("point", "A = [0, 0]");
  const B = row("point", "B = [2, 0]");
  const C = row("point", "C = [0, 2]");
  const D = row("point", "D = [5, 5]");
  const tri = row("polygon", "[A, B, C]");
  // A flat triangle lifts whole: all its corners gain a height together.
  let rows = [A, B, C, D, tri];
  assert.equal(canLiftPoints(describeSelection(tri.id, rows, [])!, rows, scope, toValue), true);

  // Another triangle shares the corner C and isn't selected: it would mix flat and lifted corners.
  const other = row("polygon", "[C, D, [9, 9]]");
  rows = [A, B, C, D, tri, other];
  assert.equal(canLiftPoints(describeSelection(tri.id, rows, [])!, rows, scope, toValue), false);
  // Selected together, they lift together... but for the corner typed as numbers.
  assert.equal(canLiftPoints(describeSelections([tri.id, other.id], rows, [])!, rows, scope, toValue), false);
  // Written for space (p3), sharing is fine.
  const spaceOther = row("polygon", "[p3(C), p3(D), [9, 9, 0]]");
  rows = [A, B, C, D, tri, spaceOther];
  assert.equal(canLiftPoints(describeSelection(tri.id, rows, [])!, rows, scope, toValue), true);

  // A circle written for the flat graph can't take a centre in space.
  const flatCircle = row("parametric", "A + 2*[cos(t rad), sin(t rad)]");
  rows = [A, flatCircle];
  assert.equal(canLiftPoints(describeSelection(flatCircle.id, rows, [])!, rows, scope, toValue), false);
  const spaceCircle = row("parametric", "p3(A) + 2*[cos(t rad), sin(t rad), 0]");
  rows = [A, spaceCircle];
  assert.equal(canLiftPoints(describeSelection(spaceCircle.id, rows, [])!, rows, scope, toValue), true);

  // Points already in space need no check.
  const P = row("point", "P = [1, 1, 1]");
  const Q = row("point", "Q = [2, 2, 2]");
  const seg = row("line", "[P, Q]");
  rows = [P, Q, seg];
  assert.equal(canLiftPoints(describeSelection(seg.id, rows, [])!, rows, null, toValue), true);
});
