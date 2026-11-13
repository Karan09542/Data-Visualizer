import { test } from "node:test";
import assert from "node:assert/strict";
import { GEOMETRY_HELPERS as G } from "./geometryHelpers";
import { clipSegmentToBox, clipToBox } from "./clip3d";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);
const closeVec = (a: number[], b: number[], eps = 1e-6) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => close(v, b[i], eps));
};

test("planeEquation: simplest form", () => {
  assert.equal(G.planeEquation([-2, -2, 1], [2, -2, 0], [-1, 2, 2]), "4x − 5y + 16z = 18");
  // Through (2,0,0), (0,4,0), (0,0,6): x/2 + y/4 + z/6 = 1.
  assert.equal(G.planeEquation([2, 0, 0], [0, 4, 0], [0, 0, 6]), "6x + 3y + 2z = 12");
  // Points on the floor (no height given): the floor itself.
  assert.equal(G.planeEquation([-2, -2], [2, 0], [2.69, -4.09]), "z = 0");
  assert.equal(G.planeEquation([0, 0, 0], [1, 0, 0], [0, 1, 0.5]), "y − 2z = 0");
  // Three points on a line make no plane.
  assert.equal(G.planeEquation([0, 0, 0], [1, 1, 1], [2, 2, 2]), "—");
});

test("planeNormal and footOnPlane", () => {
  closeVec(G.planeNormal([0, 0, 0], [1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  // The foot from (1, 2, 5) on the floor is straight below it.
  closeVec(G.footOnPlane([1, 2, 5], [0, 0, 0], [1, 0, 0], [0, 1, 0]), [1, 2, 0]);
  // On the plane x + y + z = 3, from the origin: (1, 1, 1).
  closeVec(G.footOnPlane([0, 0, 0], [3, 0, 0], [0, 3, 0], [0, 0, 3]), [1, 1, 1]);
});

test("planeAngle between planes sharing an edge", () => {
  // The floor and an upright wall along the x-axis: a right angle.
  close(G.planeAngle([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 90);
  // A wall leaning 45° back.
  close(G.planeAngle([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 1]), 45);
  // The arc starts on the first plane's side and ends on the second's.
  const start = G.planeArc([0, 0, 0], [2, 0, 0], [0, 1, 0], [0, 0, 1], 0, 1);
  const end = G.planeArc([0, 0, 0], [2, 0, 0], [0, 1, 0], [0, 0, 1], 1, 1);
  closeVec(start, [1, 1, 0]);
  closeVec(end, [1, 0, 1]);
});

test("divergence and curl of fields written as functions", () => {
  // A source: F = (x, y, z) spreads out, div 3, no spin.
  const source = (x: number, y: number, z: number) => [x, y, z];
  close(G.divergence(source, [1, 2, 3]), 3, 1e-5);
  closeVec(G.curl(source, [1, 2, 3]), [0, 0, 0], 1e-5);
  // A spin round z: F = (−y, x, 0), div 0, curl (0, 0, 2).
  const spin = (x: number, y: number) => [-y, x, 0];
  close(G.divergence(spin, [0.5, -1, 2]), 0, 1e-5);
  closeVec(G.curl(spin, [0.5, -1, 2]), [0, 0, 2], 1e-5);
  // Not constant: F = (xy, yz, zx), div = y + z + x, curl = (−y, −z, −x).
  const mixed = (x: number, y: number, z: number) => [x * y, y * z, z * x];
  close(G.divergence(mixed, [1, 2, 3]), 6, 1e-5);
  closeVec(G.curl(mixed, [1, 2, 3]), [-2, -3, -1], 1e-5);
  assert.throws(() => G.divergence([1, 2, 3], [0, 0, 0]));
});

test("clipToBox keeps what is inside and cuts at the walls", () => {
  const lo = [-1, -1, -1];
  const hi = [1, 1, 1];
  // Wholly inside: unchanged.
  const inside = [[0, 0, 0], [0.5, 0, 0], [0, 0.5, 0]];
  assert.deepEqual(clipToBox(inside, lo, hi), inside);
  // Wholly outside: nothing.
  assert.equal(clipToBox([[2, 2, 2], [3, 2, 2], [2, 3, 2]], lo, hi).length, 0);
  // A big triangle on the floor, cut to the square: every corner within the box.
  const cut = clipToBox([[-5, -5, 0], [5, -5, 0], [0, 5, 0]], lo, hi);
  assert.ok(cut.length >= 3);
  for (const p of cut) for (let k = 0; k < 3; k++) assert.ok(p[k] >= lo[k] - 1e-9 && p[k] <= hi[k] + 1e-9);
  // Extra values (a colour) ride along, interpolated.
  const coloured = clipToBox([[0, 0, 0, 0], [4, 0, 0, 1], [0, 0.5, 0, 0]], lo, hi);
  const atWall = coloured.find((p) => Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[1]) < 1e-9);
  assert.ok(atWall);
  close(atWall![3], 0.25);
});

test("clipSegmentToBox", () => {
  const lo = [0, 0, 0];
  const hi = [1, 1, 1];
  const seg = clipSegmentToBox([-1, 0.5, 0.5], [2, 0.5, 0.5], lo, hi)!;
  closeVec(seg[0], [0, 0.5, 0.5]);
  closeVec(seg[1], [1, 0.5, 0.5]);
  assert.equal(clipSegmentToBox([2, 2, 2], [3, 3, 3], lo, hi), null);
  // Parallel to a wall, outside it.
  assert.equal(clipSegmentToBox([0, 2, 0], [1, 2, 0], lo, hi), null);
});
