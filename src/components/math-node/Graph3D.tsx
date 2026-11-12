/**
 * The 3D view of a math graph: the same rows the 2D (Mafs) graph draws, in space.
 *
 * Everything that is flat in 2D lies on the z = 0 plane here, exactly as it is drawn
 * there. On top of that, rows that mention z (or give three coordinates) use the
 * third axis:
 *
 *   z = x^2 - y^2                 a surface
 *   x^2 + y^2 + z^2 = 9           an implicit surface
 *   [cos(t), sin(t), t/4]         a space curve
 *   [u*cos(v), u*sin(v), v/2]     a parametric surface (u, v from 0 to 2π)
 *   A = [1, 2, 3]                 a point; Vector / Line / Polygon take 3D points too
 *
 * Loaded lazily, so three.js costs nothing until the view is opened. It draws on
 * demand (no render loop) and rebuilds a row only when something it depends on
 * changes, so an idle 3D graph uses no CPU.
 */
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { triTable } from "three/examples/jsm/objects/MarchingCubes.js";
import * as mathjs from "mathjs";
import { Home, Minus, Plus } from "lucide-react";
import type { MathFunction, MathVariable } from "./mathTypes";
import type { GraphView } from "./simulations";
import { computePCA } from "./mathHelpers";
import { dependencyKey } from "./dependencyKeys";
import { objectId } from "./SmoothCurve";
import { getFamilyCurveColor } from "./familyPlot";
import { DEGREE_TRIG, isDefinitionRow, isTailTipVector, odeRange, odeSolveKey, rowInDegrees } from "./scope";
import { evaluateFamilyValues, parseFamilyExpression } from "../../lib/math/familyPlot";
import { splitRelation } from "../../lib/math/splitRelation";
import { computeOdeExtent, odeAxisColumns, odePlaybackTime, solveCompiledOdeCached } from "../../lib/math/odeCurveData";
import { sampleOdeAt } from "../../lib/math/odeSolver";

export interface Graph3DProps {
  functions: MathFunction[];
  variables: MathVariable[];
  /** The graph's scope for this render (sliders, time, values rows define). */
  baseScope: any;
  time: number;
  degrees: boolean;
  width: number;
  height: number;
  dark: boolean;
  /** The 2D view: the 3D box opens on the same part of the plane. */
  view: GraphView;
  /** The graph's quality setting (1-30). */
  quality: number;
  /** The clock is running: rows that follow it are drawn a little coarser. */
  animating: boolean;
  /** The small canvas card: no buttons or hints. */
  compact?: boolean;
}

type Vec3 = [number, number, number];
type Transform2 = ((x: number, y: number) => [number, number]) | null;

interface Domain {
  cx: number;
  cy: number;
  cz: number;
  half: number;
}

interface LabelSpec {
  pos: Vec3;
  text: string;
  color?: string;
  strong?: boolean;
}

interface RowEntry {
  key: string;
  group: THREE.Group;
  labels: LabelSpec[];
}

const AXIS_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];
const AXIS_NAMES = ["x", "y", "z"];
const HOME_CAMERA = new THREE.Vector3(2.9, -3.7, 2.3).setLength(4.7);
const TWO_PI = 2 * Math.PI;

// ─── Small helpers ────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const isComplexValue = (v: any) => v && typeof v === "object" && (v.isComplex || ("re" in v && "im" in v));

function toReal(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isComplexValue(v)) return Math.abs(v.im) < 1e-9 ? Number(v.re) : NaN;
  if (v && (v.isMatrix || Array.isArray(v))) {
    try {
      return Number(mathjs.det(v));
    } catch {
      return NaN;
    }
  }
  return Number(v);
}

/** A colour three.js accepts: row colours may carry an alpha byte (#rrggbbaa). */
function toColor(c: string | undefined): THREE.Color {
  let s = c || "#3b82f6";
  if (s.startsWith("#") && s.length === 9) s = s.slice(0, 7);
  else if (s.startsWith("#") && s.length === 5) s = s.slice(0, 4);
  const color = new THREE.Color();
  try {
    color.set(s);
  } catch {
    color.set("#3b82f6");
  }
  return color;
}

const symbolCache = new Map<string, Set<string>>();

/** The variable names an expression uses (not function names). */
function symbolsOf(expr: string): Set<string> {
  const cached = symbolCache.get(expr);
  if (cached) return cached;
  const names = new Set<string>();
  let node: any = null;
  try {
    node = mathjs.parse(expr);
  } catch {
    try {
      // "x^2 + y^2 = 4" isn't an assignment; read "=" as "==".
      node = mathjs.parse(expr.replace(/(^|[^<>=!])=(?!=)/g, "$1=="));
    } catch {
      node = null;
    }
  }
  if (node) {
    node.traverse((n: any, _path: string, parent: any) => {
      if (n.isSymbolNode && !(parent?.isFunctionNode && parent.fn === n)) names.add(n.name);
    });
  } else {
    for (const m of expr.matchAll(/[A-Za-z_]\w*/g)) names.add(m[0]);
  }
  if (symbolCache.size > 500) symbolCache.clear();
  symbolCache.set(expr, names);
  return names;
}

const coordinate = (v: any): number | null => {
  while (Array.isArray(v) && v.length === 1) v = v[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Every point in a value: [x, y], [x, y, z], complex numbers, and lists of them. */
function extractPoints(val: any, out: Vec3[] = []): Vec3[] {
  if (val == null) return out;
  if (typeof val.toArray === "function") val = val.toArray();
  if (isComplexValue(val)) {
    const re = Number(val.re);
    const im = Number(val.im);
    if (Number.isFinite(re) && Number.isFinite(im)) out.push([re, im, 0]);
    return out;
  }
  if (!Array.isArray(val)) return out;
  if (val.length === 2 || val.length === 3) {
    const c = val.map(coordinate);
    if (c.every((n) => n !== null)) {
      out.push([c[0]!, c[1]!, c[2] ?? 0]);
      return out;
    }
  }
  for (const item of val) extractPoints(item, out);
  return out;
}

/** A 2D or 3D position from the value of a swept expression, written into `out`. */
function readPosition(res: any, out: Vec3): boolean {
  if (isComplexValue(res)) {
    out[0] = Number(res.re);
    out[1] = Number(res.im);
    out[2] = 0;
    return true;
  }
  const arr = res && res.toArray ? res.toArray() : res;
  if (Array.isArray(arr) && arr.length >= 2) {
    out[0] = toReal(coordinate(arr[0]) ?? arr[0]);
    out[1] = toReal(coordinate(arr[1]) ?? arr[1]);
    out[2] = arr.length >= 3 ? toReal(coordinate(arr[2]) ?? arr[2]) : 0;
    return true;
  }
  return false;
}

function niceStep(half: number): number {
  const raw = (2 * half) / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * pow;
}

function formatTick(v: number, step: number): string {
  const decimals = clamp(-Math.floor(Math.log10(step) + 1e-9), 0, 8);
  const a = Math.abs(v);
  const s = a >= 1e5 || (a > 0 && a < 1e-4) ? v.toExponential(1) : v.toFixed(decimals);
  return s.replace("-", "−");
}

const formatCoord = (v: number) => String(Number(v.toFixed(2))).replace("-", "−");

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o: any) => {
    o.geometry?.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
    else m?.dispose?.();
  });
}

function makeDiscTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(32, 32, 29, 0, TWO_PI);
  g.fillStyle = "#fff";
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Marching cubes: where each of a cell's 12 edges starts (corner offset) and its axis.
const EDGE_BASE: [number, number, number, number][] = [
  [0, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 1],
  [0, 0, 1, 0], [1, 0, 1, 1], [0, 1, 1, 0], [0, 0, 1, 1],
  [0, 0, 0, 2], [1, 0, 0, 2], [1, 1, 0, 2], [0, 1, 0, 2],
];
const CORNERS: [number, number, number][] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

// What a function-type row's value looks like (a number, or three coordinates),
// remembered per compiled expression.
const valueShapeCache = new WeakMap<object, boolean>();

// ─── Engine ───────────────────────────────────────────────────────────────────

class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  private controls: OrbitControls;
  /** Holds everything in graph units; scaled so the visible domain is the cube [-1, 1]³. */
  private content = new THREE.Group();
  private decor = new THREE.Group();
  private rowsGroup = new THREE.Group();
  private rows = new Map<string, RowEntry>();
  private decorLabels: LabelSpec[] = [];
  private labelSpecs: LabelSpec[] = [];
  private labelEls: HTMLSpanElement[] = [];
  private labelsDirty = true;
  private planes: THREE.Plane[];
  private disc = makeDiscTexture();
  private domain: Domain;
  private frame = 0;
  private needsSync = true;
  private coarse = false;
  private coarseTimer = 0;
  private width = 1;
  private height = 1;
  private dark = false;
  private disposed = false;
  private scratch = new THREE.Vector3();

  constructor(
    private host: HTMLElement,
    private labelHost: HTMLElement,
    private getProps: () => Graph3DProps,
  ) {
    // preserveDrawingBuffer: the graph's screenshot tool reads the canvas back.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    host.appendChild(canvas);

    // Nothing is drawn outside the box.
    const e = 1.002;
    this.planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), e),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), e),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), e),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), e),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), e),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), e),
    ];

    // Before the controls attach theirs, so a Ctrl/Shift scroll can be kept from them.
    canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.camera.up.set(0, 0, 1); // z points up, as in maths
    this.camera.position.copy(HOME_CAMERA);
    this.controls = new OrbitControls(this.camera, canvas);
    // Scroll and pinch bring the whole graph closer; right-drag (or two fingers) slides it.
    // Ctrl/Shift + scroll and the +/- buttons change the range of the axes instead (zoomBy).
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 14;
    this.controls.zoomSpeed = 1.2;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener("change", this.requestRender);

    // A headlight, so a surface is lit from wherever it is looked at.
    const light = new THREE.DirectionalLight(0xffffff, 1.7);
    light.position.set(0.6, 0.8, 1);
    this.camera.add(light);
    this.scene.add(this.camera, new THREE.AmbientLight(0xffffff, 2), this.content);
    this.content.add(this.decor, this.rowsGroup);

    const p = getProps();
    this.dark = p.dark;
    this.domain = this.homeDomain();
    this.resize(p.width, p.height);
    this.applyTheme();
    this.applyDomain();
  }

  // ── View ──

  private homeDomain(): Domain {
    const { view } = this.getProps();
    const half = Math.max(view.x[1] - view.x[0], view.y[1] - view.y[0]) / 2;
    return {
      cx: (view.x[0] + view.x[1]) / 2,
      cy: (view.y[0] + view.y[1]) / 2,
      cz: 0,
      half: Number.isFinite(half) && half > 0 ? half : 5,
    };
  }

  private applyDomain() {
    const { cx, cy, cz, half } = this.domain;
    this.content.scale.setScalar(1 / half);
    this.content.position.set(-cx / half, -cy / half, -cz / half);
    this.buildDecor();
    this.sync();
  }

  zoomBy(factor: number) {
    this.domain.half = clamp(this.domain.half * factor, 1e-4, 1e7);
    // Surfaces are sampled coarsely while the range is changing, then refined.
    this.coarse = true;
    window.clearTimeout(this.coarseTimer);
    this.coarseTimer = window.setTimeout(() => {
      this.coarse = false;
      this.sync();
    }, 220);
    this.applyDomain();
  }

  resetView() {
    this.camera.position.copy(HOME_CAMERA);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.domain = this.homeDomain();
    this.applyDomain();
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;
    // Keep the whole box in view on a tall, narrow graph.
    const base = 38;
    this.camera.fov =
      aspect >= 1 ? base : (2 * Math.atan(Math.tan((base * Math.PI) / 360) / aspect) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  setTheme(dark: boolean) {
    if (dark === this.dark) return;
    this.dark = dark;
    this.applyTheme();
    this.buildDecor();
    // Surface mesh lines are tinted for the theme.
    for (const row of this.rows.values()) row.key = "";
    this.sync();
  }

  private applyTheme() {
    const bg = this.dark ? "#020617" : "#ffffff";
    this.scene.background = new THREE.Color(bg);
    // A halo in the background colour keeps numbers readable over lines and surfaces.
    this.labelHost.style.textShadow = `0 0 3px ${bg}, 0 0 3px ${bg}, 0 0 2px ${bg}`;
  }

  // ── Input ──

  private onWheel = (e: WheelEvent) => {
    // The canvas around the graph must not zoom or scroll with it.
    e.preventDefault();
    e.stopPropagation();
    // A plain scroll is the controls': it moves the camera.
    if (!e.ctrlKey && !e.shiftKey && !e.metaKey) return;
    e.stopImmediatePropagation();
    // Shift turns a vertical scroll into a horizontal one on some systems.
    const raw = e.deltaY || e.deltaX;
    const delta = e.deltaMode === 1 ? raw * 30 : raw;
    this.zoomBy(Math.exp(clamp(delta, -300, 300) * 0.0015));
  };

  // ── Drawing ──

  private requestRender = () => {
    if (!this.frame && !this.disposed) this.frame = requestAnimationFrame(this.tick);
  };

  /** Rows may have changed: check them on the next frame. */
  sync() {
    this.needsSync = true;
    this.requestRender();
  }

  private tick = () => {
    this.frame = 0;
    if (this.disposed) return;
    if (this.needsSync) {
      this.needsSync = false;
      this.syncRows();
    }
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  };

  private updateLabels() {
    if (this.labelsDirty) {
      this.labelsDirty = false;
      this.labelSpecs = [...this.decorLabels];
      for (const row of this.rows.values()) this.labelSpecs.push(...row.labels);
      while (this.labelEls.length < this.labelSpecs.length) {
        const el = document.createElement("span");
        el.style.cssText = "position:absolute;left:0;top:0;white-space:nowrap;line-height:1;will-change:transform";
        this.labelHost.appendChild(el);
        this.labelEls.push(el);
      }
      while (this.labelEls.length > this.labelSpecs.length) this.labelEls.pop()!.remove();
      this.labelSpecs.forEach((spec, i) => {
        const el = this.labelEls[i];
        el.textContent = spec.text;
        el.style.color = spec.color || "";
        el.style.fontWeight = spec.strong ? "700" : "";
        el.style.fontSize = spec.strong ? "13px" : "";
      });
    }
    const v = this.scratch;
    const m = this.content.matrixWorld;
    for (let i = 0; i < this.labelSpecs.length; i++) {
      const el = this.labelEls[i];
      const [x, y, z] = this.labelSpecs[i].pos;
      v.set(x, y, z).applyMatrix4(m);
      const inside = Math.abs(v.x) <= 1.2 && Math.abs(v.y) <= 1.2 && Math.abs(v.z) <= 1.2;
      v.project(this.camera);
      if (!inside || v.z > 1 || !Number.isFinite(v.x + v.y)) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "";
      const px = (v.x * 0.5 + 0.5) * this.width;
      const py = (-v.y * 0.5 + 0.5) * this.height;
      el.style.transform = `translate(-50%,-50%) translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
    }
  }

  // ── Box, axes and grid ──

  private buildDecor() {
    disposeGroup(this.decor);
    this.decor.clear();
    const labels: LabelSpec[] = [];
    const { cx, cy, cz, half } = this.domain;
    const lo = [cx - half, cy - half, cz - half];
    const hi = [cx + half, cy + half, cz + half];
    // The axes run through the origin while it is in view, else along the nearest face.
    const at = [clamp(0, lo[0], hi[0]), clamp(0, lo[1], hi[1]), clamp(0, lo[2], hi[2])];
    const originInView = at[0] === 0 && at[1] === 0 && at[2] === 0;
    const step = niceStep(half);
    const gridColor = new THREE.Color(this.dark ? "#334155" : "#cbd5e1");

    // Grid on the horizontal plane the axes lie in.
    const grid: number[] = [];
    for (let k = Math.ceil(lo[0] / step); k * step <= hi[0] + 1e-9 * half; k++) {
      grid.push(k * step, lo[1], at[2], k * step, hi[1], at[2]);
    }
    for (let k = Math.ceil(lo[1] / step); k * step <= hi[1] + 1e-9 * half; k++) {
      grid.push(lo[0], k * step, at[2], hi[0], k * step, at[2]);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
    this.decor.add(
      new THREE.LineSegments(
        gridGeo,
        new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: this.dark ? 0.7 : 0.9 }),
      ),
    );

    // The box.
    const box: number[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const b = (axis + 1) % 3;
      const c = (axis + 2) % 3;
      for (const vb of [lo[b], hi[b]]) {
        for (const vc of [lo[c], hi[c]]) {
          const p: number[] = [0, 0, 0];
          const q: number[] = [0, 0, 0];
          p[axis] = lo[axis];
          q[axis] = hi[axis];
          p[b] = q[b] = vb;
          p[c] = q[c] = vc;
          box.push(...p, ...q);
        }
      }
    }
    const boxGeo = new THREE.BufferGeometry();
    boxGeo.setAttribute("position", new THREE.Float32BufferAttribute(box, 3));
    this.decor.add(
      new THREE.LineSegments(
        boxGeo,
        new THREE.LineBasicMaterial({ color: gridColor, transparent: true, opacity: 0.55 }),
      ),
    );

    // Axes, arrowheads, names and tick numbers.
    const axisPositions: number[] = [];
    const axisColors: number[] = [];
    for (let axis = 0; axis < 3; axis++) {
      const color = new THREE.Color(AXIS_COLORS[axis]);
      const p = [...at];
      const q = [...at];
      p[axis] = lo[axis];
      q[axis] = hi[axis];
      axisPositions.push(...p, ...q);
      axisColors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.022 * half, 0.08 * half, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      const dir = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cone.position.set(q[0], q[1], q[2]).addScaledVector(dir, 0.04 * half);
      this.decor.add(cone);

      const name = [...q] as Vec3;
      name[axis] += 0.16 * half;
      labels.push({ pos: name, text: AXIS_NAMES[axis], color: AXIS_COLORS[axis], strong: true });

      // Numbers sit just off the axis: below it for x and y, beside it for z.
      const off = axis === 2 ? 0 : 2;
      for (let k = Math.ceil(lo[axis] / step); k * step <= hi[axis] + 1e-9 * half; k++) {
        const value = k * step;
        // Where the three axes meet at the origin, one unlabelled crossing reads better than three zeros.
        if (originInView && Math.abs(value) < step * 1e-6) continue;
        if (hi[axis] - value < 0.06 * half) continue; // under the arrowhead
        const pos = [...at] as Vec3;
        pos[axis] = value;
        pos[off] -= 0.07 * half;
        labels.push({ pos, text: formatTick(value, step) });
      }
    }
    const axisGeo = new LineSegmentsGeometry();
    axisGeo.setPositions(axisPositions);
    axisGeo.setColors(axisColors);
    const axes = new LineSegments2(axisGeo, new LineMaterial({ vertexColors: true, linewidth: 2 }));
    axes.frustumCulled = false;
    this.decor.add(axes);

    this.decorLabels = labels;
    this.labelsDirty = true;
  }

  // ── Rows ──

  private syncRows() {
    const p = this.getProps();
    const seen = new Set<string>();
    const d = this.domain;
    const domainKey = `${d.cx},${d.cy},${d.cz},${d.half}`;

    for (const f of p.functions) {
      if (!f.visible || f.type === "calculator") continue;
      if (!f.compiled && !f.compiledOde) continue;

      const fTime = f.hasCustomTimeline ? (f.time !== undefined ? f.time : 0) : p.time;
      const inDegrees = rowInDegrees(f, p.degrees);
      // The row's own scope, as the 2D graph builds it.
      const scope: any = { ...p.baseScope, t: fTime, time: p.time, ...(inDegrees ? DEGREE_TRIG : {}) };

      let kind: string | null;
      try {
        kind = this.kindOf(f, scope, p.functions);
      } catch {
        kind = null;
      }
      if (!kind) continue;
      seen.add(f.id);

      const dep = dependencyKey(f, p.functions, scope, fTime, p.variables);
      // A row that follows the clock is redrawn every frame: keep it light while it plays.
      const coarse = this.coarse || (p.animating && dep.includes("@"));
      const key = [
        objectId(f.compiled ?? f.compiledOde),
        objectId(f.compiled2),
        kind,
        dep,
        f.color,
        f.fillColor,
        f.fillOpacity,
        f.lineStyle,
        f.outlineWidth,
        f.showLabel,
        f.showPoint,
        f.operator,
        f.tRange?.join(","),
        f.odeAxes?.join(","),
        f.odeSteps,
        kind === "ode" && f.odeAnimate !== false ? fTime : "",
        f.transformTranslate?.join(","),
        f.transformRotate,
        f.transformScale?.join(","),
        f.isTransformable,
        f.isPivotEnabled && f.transformPivot?.join(","),
        inDegrees,
        p.quality,
        coarse,
        domainKey,
      ].join("|");

      const existing = this.rows.get(f.id);
      if (existing && existing.key === key) continue;
      if (existing) this.removeRow(f.id);

      const entry: RowEntry = { key, group: new THREE.Group(), labels: [] };
      try {
        this.buildRow(kind, f, scope, fTime, inDegrees, coarse, p, entry);
      } catch {
        // A row that fails to evaluate draws nothing, as in 2D.
      }
      entry.group.traverse((o) => {
        o.frustumCulled = false;
      });
      this.rowsGroup.add(entry.group);
      this.rows.set(f.id, entry);
      this.labelsDirty = true;
    }

    for (const id of [...this.rows.keys()]) if (!seen.has(id)) this.removeRow(id);
  }

  private removeRow(id: string) {
    const row = this.rows.get(id);
    if (!row) return;
    this.rowsGroup.remove(row.group);
    disposeGroup(row.group);
    this.rows.delete(id);
    this.labelsDirty = true;
  }

  /** How a row is drawn in space; null if it isn't drawn at all. */
  private kindOf(f: MathFunction, scope: any, functions: MathFunction[]): string | null {
    if (f.type === "differential") return f.compiledOde ? "ode" : null;
    if (!f.compiled) return null;
    if (f.type === "point" || f.type === "vector" || f.type === "line" || f.type === "polygon") return "geometry";
    if (f.type === "parametric" || f.type === "polar") return f.type;

    // z is the third axis unless the graph already gives it a value (a slider, z = 2+3i).
    const freeZ = scope.z === undefined && symbolsOf(f.expr).has("z");

    if (f.type === "implicit" || f.type === "inequality") {
      if (!freeZ) return f.type === "implicit" ? "curve2d" : "region2d";
      if (f.type === "implicit") {
        const split = splitRelation(f.expr, "implicit");
        if (split && split.lhs === "z" && f.compiled2 && !symbolsOf(split.rhs).has("z")) return "surface-rhs";
      }
      return "iso";
    }

    // "function" rows.
    if (freeZ && /^\s*z\s*=(?!=)/.test(f.expr)) return "surface";
    if (this.hasThreeCoordinates(f, scope)) {
      const symbols = symbolsOf(f.expr);
      if (symbols.has("u") && symbols.has("v") && scope.u === undefined && scope.v === undefined) return "surface-uv";
      return symbols.has("t") ? "parametric" : "point3";
    }
    return isDefinitionRow(f, functions) ? null : "function";
  }

  private hasThreeCoordinates(f: MathFunction, scope: any): boolean {
    const cached = valueShapeCache.get(f.compiled);
    if (cached !== undefined) return cached;
    let result = false;
    try {
      const s = Object.create(scope);
      s.x = 0.5;
      s.y = 0.5;
      if (scope.u === undefined) s.u = 0.5;
      if (scope.v === undefined) s.v = 0.5;
      const val = f.compiled.evaluate(s);
      const arr = val && val.toArray ? val.toArray() : val;
      result = Array.isArray(arr) && arr.length === 3 && arr.every((c: any) => coordinate(c) !== null);
    } catch {
      result = false;
    }
    valueShapeCache.set(f.compiled, result);
    return result;
  }

  /** The row's translate / rotate / scale (in the plane), or null when it has none. */
  private transformOf(f: MathFunction, pivotPoints: () => [number, number][]): Transform2 {
    const tx = f.transformTranslate?.[0] || 0;
    const ty = f.transformTranslate?.[1] || 0;
    const rot = f.transformRotate || 0;
    const sx = f.transformScale?.[0] || 1;
    const sy = f.transformScale?.[1] || 1;
    let px = 0;
    let py = 0;
    let base = 0;
    if (f.isTransformable) {
      const pca = computePCA(pivotPoints());
      base = Math.atan2(pca.u[1], pca.u[0]);
      [px, py] = f.isPivotEnabled && f.transformPivot ? f.transformPivot : pca.center;
    }
    if (tx === 0 && ty === 0 && rot === 0 && sx === 1 && sy === 1) return null;
    const cosA = Math.cos(-base);
    const sinA = Math.sin(-base);
    const cosR = Math.cos(rot + base);
    const sinR = Math.sin(rot + base);
    return (x, y) => {
      const lx = x - px;
      const ly = y - py;
      const x1 = (lx * cosA - ly * sinA) * sx;
      const y1 = (lx * sinA + ly * cosA) * sy;
      return [x1 * cosR - y1 * sinR + px + tx, x1 * sinR + y1 * cosR + py + ty];
    };
  }

  private buildRow(
    kind: string,
    f: MathFunction,
    scope: any,
    fTime: number,
    inDegrees: boolean,
    coarse: boolean,
    p: Graph3DProps,
    entry: RowEntry,
  ) {
    const { group } = entry;
    const { cx, cy, cz, half } = this.domain;
    const q = clamp(p.quality || 14, 1, 30);
    const curveSamples = clamp(q * 60, 240, 1800);
    const surfaceCells = Math.round(clamp(q * 6, 24, 120) * (coarse ? 0.5 : 1));
    const isoCells = Math.round(clamp(q * 2.6, 14, 52) * (coarse ? 0.6 : 1));
    const planeCells = Math.round(clamp(q * 10, 60, 220) * (coarse ? 0.5 : 1));
    const angleUnit = inDegrees ? 180 / Math.PI : 1;
    const s = Object.create(scope);
    const add = (o: THREE.Object3D | null) => {
      if (o) group.add(o);
    };

    // One curve per member for family(…) rows, otherwise just the row itself.
    const family = kind === "function" || kind === "parametric" || kind === "polar" ? parseFamilyExpression(f.expr) : null;
    const familyValues = family ? evaluateFamilyValues(family, scope).values : [];
    const members: { color: string; bind: () => void }[] =
      family && familyValues.length > 0
        ? familyValues.map((val, i) => ({
            color: getFamilyCurveColor(f.color, i, familyValues.length),
            bind: () => {
              s[family.variable] = val;
            },
          }))
        : [{ color: f.color, bind: () => {} }];

    switch (kind) {
      case "function": {
        const xf = this.transformOf(f, () => {
          for (const x of [0, 1, -1, 2, -2, 3, -3]) {
            try {
              s.x = x;
              const y = toReal(f.compiled.evaluate(s));
              if (Number.isFinite(y)) return [[x, y]];
            } catch {}
          }
          return [[0, 0]];
        });
        // A moved or turned curve needs more of itself than the box is wide.
        const reach = xf ? 3 : 1;
        const x0 = cx - half * reach - (xf ? Math.abs(f.transformTranslate?.[0] || 0) : 0);
        const x1 = cx + half * reach + (xf ? Math.abs(f.transformTranslate?.[0] || 0) : 0);
        const n = curveSamples * (xf ? 2 : 1);
        for (const member of members) {
          member.bind();
          const pts = new Array<number>((n + 1) * 3);
          for (let i = 0; i <= n; i++) {
            const x = x0 + ((x1 - x0) * i) / n;
            let y = NaN;
            try {
              s.x = x;
              y = toReal(f.compiled.evaluate(s));
            } catch {}
            const [gx, gy] = xf ? xf(x, y) : [x, y];
            pts[i * 3] = gx;
            pts[i * 3 + 1] = gy;
            pts[i * 3 + 2] = 0;
          }
          // A jump taller than the box between two samples is an asymptote, not a line.
          add(this.line(pts, member.color, f, { maxJump: xf ? undefined : 4 * half }));
        }
        break;
      }

      case "parametric": {
        const [t0, t1] = f.tRange ?? [0, TWO_PI];
        const out: Vec3 = [0, 0, 0];
        const at = (t: number): boolean => {
          try {
            const angle = t * angleUnit;
            s.t = t;
            s.theta = s["θ"] = angle;
            s.x = angle;
            return readPosition(f.compiled.evaluate(s), out);
          } catch {
            return false;
          }
        };
        const xf = this.transformOf(f, () => {
          for (const t of [0, Math.PI / 4, Math.PI / 2, Math.PI]) if (at(t)) return [[out[0], out[1]]];
          return [[0, 0]];
        });
        for (const member of members) {
          member.bind();
          add(this.line(this.sweep(at, out, t0, t1, curveSamples, xf), member.color, f));
        }
        break;
      }

      case "polar": {
        const [t0, t1] = f.tRange ?? [0, TWO_PI * 5];
        const thetaIsAngle = /\btheta\b|θ/.test(f.expr);
        const out: Vec3 = [0, 0, 0];
        const at = (t: number): boolean => {
          try {
            const angle = t * angleUnit;
            if (!thetaIsAngle) s.t = angle;
            s.x = angle;
            s.theta = s["θ"] = angle;
            const res = f.compiled.evaluate(s);
            if (isComplexValue(res) && Math.abs(Number(res.im)) > 1e-9) {
              out[0] = Number(res.re);
              out[1] = Number(res.im);
            } else {
              const r = toReal(res);
              out[0] = r * Math.cos(t);
              out[1] = r * Math.sin(t);
            }
            out[2] = 0;
            return true;
          } catch {
            return false;
          }
        };
        const xf = this.transformOf(f, () => {
          for (const t of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
            if (at(t) && Number.isFinite(out[0] + out[1])) return [[out[0], out[1]]];
          }
          return [[0, 0]];
        });
        for (const member of members) {
          member.bind();
          add(this.line(this.sweep(at, out, t0, t1, Math.max(curveSamples, 1200), xf), member.color, f));
        }
        break;
      }

      case "point3": {
        const pts = extractPoints(f.compiled.evaluate(s));
        this.addPoints(entry, f, pts);
        break;
      }

      case "geometry": {
        let pts = extractPoints(f.compiled.evaluate(s)).filter((pt) => Number.isFinite(pt[0] + pt[1] + pt[2]));
        if (pts.length === 0) break;
        const flat = pts.map((pt) => [pt[0], pt[1]] as [number, number]);
        const xf = this.transformOf(f, () => flat);
        const place = (pt: Vec3): Vec3 => {
          if (!xf) return pt;
          const [x, y] = xf(pt[0], pt[1]);
          return [x, y, pt[2]];
        };
        const origin = place([0, 0, 0]);
        pts = pts.map(place);

        if (f.type === "point") {
          this.addPoints(entry, f, pts);
        } else if (f.type === "vector") {
          const arrows: [Vec3, Vec3][] = isTailTipVector(f)
            ? pts.length >= 2
              ? [[pts[0], pts[1]]]
              : []
            : pts.map((tip) => [origin, tip]);
          for (const [tail, tip] of arrows) this.addArrow(group, f, tail, tip);
        } else if (f.type === "line") {
          if (pts.length >= 2) add(this.line([...pts[0], ...pts[1]], f.color, f));
        } else if (pts.length > 2) {
          add(this.line(pts.flat(), f.color, f, { closed: true }));
          add(this.polygonFill(pts, f));
        }
        break;
      }

      case "ode": {
        const ode = f.compiledOde!;
        const system = ode.system;
        if (!system || system.states.length === 0) break;
        const [t0, t1] = odeRange(f);
        const solution = solveCompiledOdeCached(
          odeSolveKey(f, p.functions, scope, fTime, p.variables),
          system,
          ode.derivatives,
          ode.initials,
          scope,
          [t0, t1],
          f.odeSteps ?? 1000,
        );
        if (!solution) break;
        const [axisX, axisY] = f.odeAxes ?? ["t", system.states[0]?.display ?? "t"];
        const colX = odeAxisColumns(system, axisX);
        const colY = odeAxisColumns(system, axisY);
        if (!colX || !colY) break;
        // Three plain states drawn against each other (x, y, z of a Lorenz system):
        // the one not on the plane goes up the z-axis.
        let colZ = -1;
        if (axisX !== "t" && axisY !== "t" && system.states.length === 3 && system.states.every((st) => !st.display.includes("'"))) {
          const third = system.states.find((st) => st.display !== axisX && st.display !== axisY);
          colZ = third ? (odeAxisColumns(system, third.display)?.value ?? -1) : -1;
        }
        const xf = this.transformOf(f, () => {
          const e = computeOdeExtent(solution, system, axisX, axisY);
          return e
            ? [
                [e.cx - e.rx, e.cy - e.ry],
                [e.cx + e.rx, e.cy - e.ry],
                [e.cx + e.rx, e.cy + e.ry],
                [e.cx - e.rx, e.cy + e.ry],
              ]
            : [[0, 0]];
        });
        const { data, cols, rows } = solution;
        const pts = new Array<number>(rows * 3);
        for (let i = 0; i < rows; i++) {
          const x = data[i * cols + colX.value];
          const y = data[i * cols + colY.value];
          const [gx, gy] = xf ? xf(x, y) : [x, y];
          pts[i * 3] = gx;
          pts[i * 3 + 1] = gy;
          pts[i * 3 + 2] = colZ >= 0 ? data[i * cols + colZ] : 0;
        }
        add(this.line(pts, f.color, f));

        if (f.odeAnimate !== false) {
          const now = odePlaybackTime(fTime, t0, t1);
          const states = Number.isFinite(now) ? sampleOdeAt(solution, now) : null;
          if (states) {
            const pick = (axis: string) => {
              if (axis === "t") return now;
              const index = system.states.findIndex((st) => st.display === axis);
              return index < 0 ? NaN : states[index];
            };
            const mx = pick(axisX);
            const my = pick(axisY);
            const [gx, gy] = xf ? xf(mx, my) : [mx, my];
            const mz = colZ >= 0 ? states[colZ - 1] : 0;
            if (Number.isFinite(gx + gy + mz)) add(this.points([[gx, gy, mz]], f.color));
          }
        }
        break;
      }

      case "surface":
      case "surface-rhs": {
        const compiled = kind === "surface" ? f.compiled : f.compiled2;
        const limit = 1e3 * half;
        this.addSurface(
          group,
          (x, y, out) => {
            s.x = x;
            s.y = y;
            let z = NaN;
            try {
              z = toReal(compiled.evaluate(s));
            } catch {}
            out[0] = x;
            out[1] = y;
            // Far outside the box is as good as at its edge; the clip planes cut it.
            out[2] = clamp(z, cz - limit, cz + limit);
            return Number.isFinite(z);
          },
          [cx - half, cx + half],
          [cy - half, cy + half],
          surfaceCells,
          f,
          4 * half,
        );
        break;
      }

      case "surface-uv": {
        const out3: Vec3 = [0, 0, 0];
        this.addSurface(
          group,
          (u, v, out) => {
            s.u = u;
            s.v = v;
            try {
              if (!readPosition(f.compiled.evaluate(s), out3)) return false;
            } catch {
              return false;
            }
            out[0] = out3[0];
            out[1] = out3[1];
            out[2] = out3[2];
            return Number.isFinite(out[0] + out[1] + out[2]);
          },
          [0, TWO_PI],
          [0, TWO_PI],
          surfaceCells,
          f,
        );
        break;
      }

      case "iso": {
        this.addIsoSurface(group, f, s, isoCells);
        break;
      }

      case "curve2d":
      case "region2d": {
        this.addPlaneRelation(group, f, s, planeCells, kind === "region2d");
        break;
      }
    }
  }

  /** Samples a swept curve into a flat xyz list (NaN where it is undefined). */
  private sweep(
    at: (t: number) => boolean,
    out: Vec3,
    t0: number,
    t1: number,
    n: number,
    xf: Transform2,
  ): number[] {
    const pts = new Array<number>((n + 1) * 3);
    for (let i = 0; i <= n; i++) {
      const ok = at(t0 + ((t1 - t0) * i) / n);
      if (ok && xf) [out[0], out[1]] = xf(out[0], out[1]);
      pts[i * 3] = ok ? out[0] : NaN;
      pts[i * 3 + 1] = ok ? out[1] : NaN;
      pts[i * 3 + 2] = ok ? out[2] : NaN;
    }
    return pts;
  }

  // ── Primitives ──

  /** A polyline through `pts` (flat xyz), broken wherever a point isn't finite. */
  private line(
    pts: number[],
    color: string,
    f: MathFunction,
    opts: { closed?: boolean; maxJump?: number } = {},
  ): LineSegments2 | null {
    const { cx, cy, cz, half } = this.domain;
    const limit = 1e3 * half;
    const n = Math.floor(pts.length / 3);
    const segments: number[] = [];
    const push = (a: number, b: number) => {
      const ax = pts[a * 3], ay = pts[a * 3 + 1], az = pts[a * 3 + 2];
      const bx = pts[b * 3], by = pts[b * 3 + 1], bz = pts[b * 3 + 2];
      if (!Number.isFinite(ax + ay + az + bx + by + bz)) return;
      if (
        Math.abs(ax - cx) > limit || Math.abs(ay - cy) > limit || Math.abs(az - cz) > limit ||
        Math.abs(bx - cx) > limit || Math.abs(by - cy) > limit || Math.abs(bz - cz) > limit
      ) return;
      if (opts.maxJump !== undefined && Math.abs(by - ay) > opts.maxJump) return;
      segments.push(ax, ay, az, bx, by, bz);
    };
    for (let i = 0; i < n - 1; i++) push(i, i + 1);
    if (opts.closed && n > 2) push(n - 1, 0);
    if (segments.length === 0) return null;

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(segments);
    const dashed = !!f.lineStyle && f.lineStyle !== "solid";
    const material = new LineMaterial({
      color: toColor(color),
      linewidth: f.outlineWidth !== undefined ? f.outlineWidth : 3,
      clippingPlanes: this.planes,
      dashed,
      dashSize: (f.lineStyle === "dotted" ? 0.012 : 0.06) * half,
      gapSize: (f.lineStyle === "dotted" ? 0.03 : 0.045) * half,
    });
    const line = new LineSegments2(geometry, material);
    if (dashed) line.computeLineDistances();
    return line;
  }

  private points(pts: Vec3[], color: string): THREE.Points | null {
    if (pts.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: toColor(color),
        size: 11,
        sizeAttenuation: false,
        map: this.disc,
        alphaTest: 0.5,
        clippingPlanes: this.planes,
      }),
    );
  }

  private addPoints(entry: RowEntry, f: MathFunction, pts: Vec3[]) {
    pts = pts.filter((pt) => Number.isFinite(pt[0] + pt[1] + pt[2]));
    if (f.showPoint !== false) {
      const dots = this.points(pts, f.color);
      if (dots) entry.group.add(dots);
    }
    if (!f.showLabel) return;
    const name = f.expr.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/)?.[1];
    for (const pt of pts) {
      const lift = 0.07 * this.domain.half;
      entry.labels.push({
        pos: [pt[0], pt[1], pt[2] + lift],
        text: `${name ? `${name} ` : ""}(${pt.map(formatCoord).join(", ")})`,
        color: f.color,
      });
    }
  }

  private addArrow(group: THREE.Group, f: MathFunction, tail: Vec3, tip: Vec3) {
    const half = this.domain.half;
    const a = new THREE.Vector3(...tail);
    const b = new THREE.Vector3(...tip);
    const dir = b.clone().sub(a);
    const length = dir.length();
    if (!(length > 0) || !Number.isFinite(length)) return;
    dir.divideScalar(length);
    const head = Math.min(0.11 * half, length * 0.5);
    const neck = b.clone().addScaledVector(dir, -head * 0.9);
    const shaft = this.line([a.x, a.y, a.z, neck.x, neck.y, neck.z], f.color, f);
    if (shaft) group.add(shaft);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(head * 0.32, head, 16),
      new THREE.MeshPhongMaterial({ color: toColor(f.color), clippingPlanes: this.planes }),
    );
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.position.copy(b).addScaledVector(dir, -head / 2);
    group.add(cone);
  }

  private polygonFill(pts: Vec3[], f: MathFunction): THREE.Mesh | null {
    const flat = pts.every((pt) => Math.abs(pt[2] - pts[0][2]) < 1e-9);
    let index: number[] = [];
    if (flat) {
      // Handles polygons that aren't convex.
      index = THREE.ShapeUtils.triangulateShape(pts.map((pt) => new THREE.Vector2(pt[0], pt[1])), []).flat();
    }
    if (index.length === 0) for (let i = 1; i < pts.length - 1; i++) index.push(0, i, i + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
    geometry.setIndex(index);
    return new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: toColor(f.fillColor || f.color),
        transparent: true,
        opacity: f.fillOpacity !== undefined ? f.fillOpacity : 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        clippingPlanes: this.planes,
      }),
    );
  }

  /** A lit, see-through surface, lighter towards the top of the box. */
  private surfaceMesh(positions: Float32Array, index: number[], f: MathFunction): THREE.Mesh {
    const { cz, half } = this.domain;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();

    const base = toColor(f.fillColor || f.color);
    const white = new THREE.Color(1, 1, 1);
    const black = new THREE.Color(0, 0, 0);
    const c = new THREE.Color();
    const colors = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const h = clamp((positions[i + 2] - cz) / half, -1, 1);
      c.copy(base).lerp(h > 0 ? white : black, Math.abs(h) * (h > 0 ? 0.4 : 0.35));
      colors[i] = c.r;
      colors[i + 1] = c.g;
      colors[i + 2] = c.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const opacity = f.fillOpacity !== undefined ? clamp(f.fillOpacity, 0.05, 1) : 0.86;
    return new THREE.Mesh(
      geometry,
      new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: opacity < 1,
        opacity,
        shininess: 24,
        clippingPlanes: this.planes,
        // Lets the mesh lines and curves lying on the surface show cleanly.
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
  }

  /** A surface from a function of two parameters, with a light mesh drawn over it. */
  private addSurface(
    group: THREE.Group,
    fn: (a: number, b: number, out: Vec3) => boolean,
    [a0, a1]: [number, number],
    [b0, b1]: [number, number],
    n: number,
    f: MathFunction,
    /** Cells that climb more than this are a break in the surface, not part of it. */
    maxRise?: number,
  ) {
    const cols = n + 1;
    const positions = new Float32Array(cols * cols * 3);
    const ok = new Uint8Array(cols * cols);
    const out: Vec3 = [0, 0, 0];
    for (let j = 0; j <= n; j++) {
      const b = b0 + ((b1 - b0) * j) / n;
      for (let i = 0; i <= n; i++) {
        const k = j * cols + i;
        if (fn(a0 + ((a1 - a0) * i) / n, b, out)) {
          ok[k] = 1;
          positions[k * 3] = out[0];
          positions[k * 3 + 1] = out[1];
          positions[k * 3 + 2] = out[2];
        }
      }
    }
    const z = (k: number) => positions[k * 3 + 2];
    const joined = (k0: number, k1: number) =>
      ok[k0] === 1 && ok[k1] === 1 && (maxRise === undefined || Math.abs(z(k0) - z(k1)) <= maxRise);

    const index: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k00 = j * cols + i;
        const k10 = k00 + 1;
        const k01 = k00 + cols;
        const k11 = k01 + 1;
        if (joined(k00, k10) && joined(k00, k01) && joined(k11, k10) && joined(k11, k01)) {
          index.push(k00, k10, k11, k00, k11, k01);
        }
      }
    }
    if (index.length === 0) return;
    group.add(this.surfaceMesh(positions, index, f));

    // Mesh lines: every few samples, both ways.
    const stride = Math.max(1, Math.round(n / 14));
    const wire: number[] = [];
    const seg = (k0: number, k1: number) => {
      if (!joined(k0, k1)) return;
      wire.push(
        positions[k0 * 3], positions[k0 * 3 + 1], positions[k0 * 3 + 2],
        positions[k1 * 3], positions[k1 * 3 + 1], positions[k1 * 3 + 2],
      );
    };
    for (let j = 0; j <= n; j += stride) for (let i = 0; i < n; i++) seg(j * cols + i, j * cols + i + 1);
    for (let i = 0; i <= n; i += stride) for (let j = 0; j < n; j++) seg(j * cols + i, (j + 1) * cols + i);
    if (wire.length === 0) return;
    const wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wire, 3));
    group.add(
      new THREE.LineSegments(
        wireGeometry,
        new THREE.LineBasicMaterial({
          color: this.dark ? 0xffffff : 0x0f172a,
          transparent: true,
          opacity: this.dark ? 0.28 : 0.22,
          clippingPlanes: this.planes,
        }),
      ),
    );
  }

  /** lhs − rhs at a point of space, for relations. */
  private relation(f: MathFunction, s: any): () => number {
    const lhs = f.compiled;
    const rhs = f.compiled2;
    return () => {
      try {
        return toReal(lhs.evaluate(s)) - (rhs ? toReal(rhs.evaluate(s)) : 0);
      } catch {
        return NaN;
      }
    };
  }

  /** The surface where a relation in x, y and z holds (marching cubes). */
  private addIsoSurface(group: THREE.Group, f: MathFunction, s: any, n: number) {
    const { cx, cy, cz, half } = this.domain;
    const size = n + 1;
    const stepSize = (2 * half) / n;
    const x0 = cx - half;
    const y0 = cy - half;
    const z0 = cz - half;
    const value = this.relation(f, s);
    const values = new Float32Array(size * size * size);
    let p = 0;
    for (let k = 0; k < size; k++) {
      s.z = z0 + k * stepSize;
      for (let j = 0; j < size; j++) {
        s.y = y0 + j * stepSize;
        for (let i = 0; i < size; i++) {
          s.x = x0 + i * stepSize;
          values[p++] = value();
        }
      }
    }

    const at = (i: number, j: number, k: number) => (k * size + j) * size + i;
    // One vertex per grid edge the surface crosses, shared by the cells around it,
    // so the surface shades smoothly.
    const edgeVertex = new Int32Array(size * size * size * 3).fill(-1);
    const positions: number[] = [];
    const index: number[] = [];

    const vertexOn = (i: number, j: number, k: number, edge: number): number => {
      const [dx, dy, dz, axis] = EDGE_BASE[edge];
      const bi = i + dx;
      const bj = j + dy;
      const bk = k + dz;
      const slot = at(bi, bj, bk) * 3 + axis;
      let id = edgeVertex[slot];
      if (id >= 0) return id;
      const v0 = values[at(bi, bj, bk)];
      const v1 = values[at(bi + (axis === 0 ? 1 : 0), bj + (axis === 1 ? 1 : 0), bk + (axis === 2 ? 1 : 0))];
      const w = v0 === v1 ? 0.5 : clamp(v0 / (v0 - v1), 0, 1);
      id = positions.length / 3;
      positions.push(
        x0 + (bi + (axis === 0 ? w : 0)) * stepSize,
        y0 + (bj + (axis === 1 ? w : 0)) * stepSize,
        z0 + (bk + (axis === 2 ? w : 0)) * stepSize,
      );
      edgeVertex[slot] = id;
      return id;
    };

    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          let cube = 0;
          let defined = true;
          for (let c = 0; c < 8; c++) {
            const v = values[at(i + CORNERS[c][0], j + CORNERS[c][1], k + CORNERS[c][2])];
            if (v !== v) {
              defined = false;
              break;
            }
            if (v < 0) cube |= 1 << c;
          }
          if (!defined || cube === 0 || cube === 255) continue;
          for (let m = cube * 16; triTable[m] !== -1; m += 3) {
            index.push(
              vertexOn(i, j, k, triTable[m]),
              vertexOn(i, j, k, triTable[m + 1]),
              vertexOn(i, j, k, triTable[m + 2]),
            );
          }
        }
      }
    }
    if (index.length === 0) return;
    group.add(this.surfaceMesh(new Float32Array(positions), index, f));
  }

  /** A relation in x and y only, on the z = 0 plane: its curve, and its region if it is an inequality. */
  private addPlaneRelation(group: THREE.Group, f: MathFunction, s: any, n: number, region: boolean) {
    const { cx, cy, half } = this.domain;
    const xf = this.transformOf(f, () => {
      // Where the 2D graph pivots a relation: the first grid point on (or in) it.
      const probe = this.relation(f, s);
      for (let i = -3; i <= 3; i += 0.5) {
        for (let j = -3; j <= 3; j += 0.5) {
          s.x = i;
          s.y = j;
          const d = probe();
          if (f.type === "implicit" ? Math.abs(d) < 2 : d <= 0) return [[i, j]];
        }
      }
      return [[0, 0]];
    });
    // A moved or turned relation is sampled over a wider square.
    const reach = half * (xf ? 3 : 1);
    const size = n + 1;
    const stepSize = (2 * reach) / n;
    const x0 = cx - reach;
    const y0 = cy - reach;
    const value = this.relation(f, s);
    const values = new Float32Array(size * size);
    for (let j = 0; j < size; j++) {
      s.y = y0 + j * stepSize;
      for (let i = 0; i < size; i++) {
        s.x = x0 + i * stepSize;
        values[j * size + i] = value();
      }
    }
    const place = (x: number, y: number): [number, number] => (xf ? xf(x, y) : [x, y]);

    // Marching squares for the boundary.
    const segments: number[] = [];
    const cross = (xa: number, ya: number, va: number, xb: number, yb: number, vb: number): [number, number] => {
      const w = va === vb ? 0.5 : clamp(va / (va - vb), 0, 1);
      return place(xa + (xb - xa) * w, ya + (yb - ya) * w);
    };
    const link = (a: [number, number], b: [number, number]) => segments.push(a[0], a[1], 0, b[0], b[1], 0);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v0 = values[j * size + i];
        const v1 = values[j * size + i + 1];
        const v2 = values[(j + 1) * size + i + 1];
        const v3 = values[(j + 1) * size + i];
        if (v0 !== v0 || v1 !== v1 || v2 !== v2 || v3 !== v3) continue;
        const n0 = v0 < 0, n1 = v1 < 0, n2 = v2 < 0, n3 = v3 < 0;
        if (n0 === n1 && n1 === n2 && n2 === n3) continue;
        const xa = x0 + i * stepSize;
        const xb = xa + stepSize;
        const ya = y0 + j * stepSize;
        const yb = ya + stepSize;
        const bottom = n0 !== n1 ? cross(xa, ya, v0, xb, ya, v1) : null;
        const right = n1 !== n2 ? cross(xb, ya, v1, xb, yb, v2) : null;
        const top = n2 !== n3 ? cross(xb, yb, v2, xa, yb, v3) : null;
        const left = n3 !== n0 ? cross(xa, yb, v3, xa, ya, v0) : null;
        if (bottom && right && top && left) {
          // A saddle: the middle says which corners are joined.
          const middleNegative = (v0 + v1 + v2 + v3) / 4 < 0;
          if (middleNegative === n0) {
            link(bottom, right);
            link(top, left);
          } else {
            link(bottom, left);
            link(right, top);
          }
        } else {
          const ends = [bottom, right, top, left].filter(Boolean) as [number, number][];
          if (ends.length === 2) link(ends[0], ends[1]);
        }
      }
    }
    if (segments.length > 0) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(segments);
      const dashed = !!f.lineStyle && f.lineStyle !== "solid";
      const line = new LineSegments2(
        geometry,
        new LineMaterial({
          color: toColor(f.color),
          linewidth: f.outlineWidth !== undefined ? f.outlineWidth : 3,
          clippingPlanes: this.planes,
          dashed,
          dashSize: (f.lineStyle === "dotted" ? 0.012 : 0.06) * half,
          gapSize: (f.lineStyle === "dotted" ? 0.03 : 0.045) * half,
        }),
      );
      if (dashed) line.computeLineDistances();
      group.add(line);
    }

    if (!region) return;
    const op = f.operator || f.expr2 || "<";
    const holds = (d: number) => (op === "<" ? d < 0 : op === "<=" ? d <= 0 : op === ">" ? d > 0 : d >= 0);
    const positions = new Float32Array(size * size * 3);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const [x, y] = place(x0 + i * stepSize, y0 + j * stepSize);
        positions[(j * size + i) * 3] = x;
        positions[(j * size + i) * 3 + 1] = y;
      }
    }
    const index: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * size + i;
        if (holds(values[k]) && holds(values[k + 1]) && holds(values[k + size]) && holds(values[k + size + 1])) {
          index.push(k, k + 1, k + size + 1, k, k + size + 1, k + size);
        }
      }
    }
    if (index.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: toColor(f.fillColor || f.color),
          transparent: true,
          opacity: f.fillOpacity !== undefined ? f.fillOpacity : 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
          clippingPlanes: this.planes,
        }),
      ),
    );
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.coarseTimer);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("wheel", this.onWheel);
    this.controls.dispose();
    disposeGroup(this.scene);
    this.disc.dispose();
    this.renderer.dispose();
    canvas.remove();
    this.labelEls.forEach((el) => el.remove());
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const BUTTON =
  "size-8 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";

const Graph3D: React.FC<Graph3DProps> = (props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let engine: Engine;
    try {
      engine = new Engine(hostRef.current!, labelRef.current!, () => propsRef.current);
    } catch (e) {
      console.error("3D graph could not start", e);
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.resize(props.width, props.height);
  }, [props.width, props.height]);

  useEffect(() => {
    engineRef.current?.setTheme(props.dark);
  }, [props.dark]);

  // Every render may carry new rows, slider values or time. The engine compares each
  // row's key and rebuilds only what changed, once per frame.
  useEffect(() => {
    engineRef.current?.sync();
  });

  return (
    <div
      data-graph-3d
      className="absolute inset-0 nodrag nopan nowheel cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={labelRef}
        className="absolute inset-0 overflow-hidden pointer-events-none select-none font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300"
      />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-500 dark:text-slate-400">
          The 3D view needs WebGL, which this browser or device has turned off. Switch back to 2D to keep working.
        </div>
      )}
      {!props.compact && !failed && (
        <>
          <div
            data-capture-exclude
            className="hidden md:block absolute bottom-3 left-3 z-30 pointer-events-none px-2 py-1 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400"
          >
            Drag to turn · scroll or pinch to zoom · right-drag to move · +/− changes the axis range
          </div>
          <div
            data-capture-exclude
            className="absolute top-14 left-2 md:top-auto md:left-auto md:bottom-3 md:right-3 z-30 flex flex-col overflow-hidden rounded-lg bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/5 dark:shadow-black/30 cursor-default"
          >
            <button type="button" className={BUTTON} title="Show less of the axes (Ctrl + scroll)" aria-label="Smaller axis range" onClick={() => engineRef.current?.zoomBy(0.8)}>
              <Plus size={14} />
            </button>
            <button type="button" className={BUTTON} title="Show more of the axes (Ctrl + scroll)" aria-label="Larger axis range" onClick={() => engineRef.current?.zoomBy(1.25)}>
              <Minus size={14} />
            </button>
            <button type="button" className={BUTTON} title="Back to the starting view" aria-label="Reset view" onClick={() => engineRef.current?.resetView()}>
              <Home size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Graph3D;
