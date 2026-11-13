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
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { triTable } from "three/examples/jsm/objects/MarchingCubes.js";
import * as mathjs from "mathjs";
import katex from "katex";
import { Home, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import type { FillPatternType, MathFunction, MathVariable } from "./mathTypes";
import type { GraphView } from "./simulations";
import { computePCA } from "./mathHelpers";
import { pointDraggable, type PointMenuTarget } from "./PointMenu";
import { dependencyKey } from "./dependencyKeys";
import { objectId } from "./SmoothCurve";
import { getFamilyCurveColor } from "./familyPlot";
import { DEGREE_TRIG, isDefinitionRow, isTailTipVector, odeRange, odeSolveKey, rowInDegrees } from "./scope";
import { evaluateFamilyValues, parseFamilyExpression } from "../../lib/math/familyPlot";
import { splitRelation } from "../../lib/math/splitRelation";
import { computeOdeExtent, odeAxisColumns, odePlaybackTime, solveCompiledOdeCached } from "../../lib/math/odeCurveData";
import { sampleOdeAt } from "../../lib/math/odeSolver";
import { odeSystemToLatex } from "../../lib/math/odeLatex";
import { hasLiveValues, pointLabelLocals, renderLiveLabel } from "../../lib/math/liveLabel";

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
  /** How the view is dressed (saved with the graph); missing fields take their defaults. */
  options?: Partial<Graph3DOptions>;
  onOptionsChange?: (options: Graph3DOptions) => void;
  /** Add a ready-made row (the examples in the view's menu). */
  onAddExample?: (expr: string, patch?: Partial<MathFunction>) => void;
  /** A point was dragged: its row's new expression. */
  onMovePoint?: (id: string, expr: string) => void;
  /** A point was right-clicked or double-tapped: open its menu (the same one as in 2D). */
  onPointMenu?: (target: PointMenuTarget) => void;
  /**
   * A handle placed by sliders (a pendulum bob, a launch arrow) was dragged to `target`:
   * the graph works out the slider values that put it there.
   */
  onDragHandle?: (id: string, target: [number, number, number]) => void;
  /** Patch row settings/transforms directly (used when dragging non-point rows in 3D). */
  onPatchRow?: (id: string, patch: Partial<MathFunction>) => void;
  /**
   * The transform gizmo moved, turned or resized a row. Like onPatchRow, but the graph
   * may first freeze a shape's coordinates (as the flat graph's handles do).
   */
  onTransformRow?: (id: string, patch: Partial<MathFunction>) => void;
}

type GizmoKind = "center" | "x" | "y" | "z" | "rotate" | "scale";

/** Where a transformable row's gizmo stands, and the transform it shows. */
interface GizmoFrame {
  px: number;
  py: number;
  /** The shape's own direction (its PCA axis), as on the flat graph. */
  base: number;
  /** Size of the gizmo in graph units (before scaling). */
  radius: number;
  tx: number;
  ty: number;
  tz: number;
  rot: number;
  sx: number;
  sy: number;
  /** Height the gizmo sits at. */
  cz: number;
  pivot: boolean;
  rotatable: boolean;
  resizable: boolean;
}

const GIZMO_COLORS: Partial<Record<GizmoKind, string>> = {
  x: "#ef4444",
  y: "#22c55e",
  z: "#3b82f6",
  rotate: "#eab308",
  scale: "#10b981",
};

const GIZMO_TITLES: Record<GizmoKind | "pivot" | "move", string> = {
  center: "",
  move: "Drag to move it across the floor",
  pivot: "Drag to move the pivot it turns and scales about",
  x: "Drag along x",
  y: "Drag along y",
  z: "Drag up or down (z)",
  rotate: "Drag round to turn it (Shift: steps of 15°)",
  scale: "Drag to resize (Shift: keep its shape)",
};

export interface Graph3DOptions {
  /** Surfaces in their row's colour, or coloured by height. */
  colorMode: "row" | "height";
  /** Level curves on surfaces, and their shadows on the floor of the box. */
  contours: boolean;
  /** A cutting plane: its axis (0 = x, 1 = y, 2 = z) and where it sits across the box (-1 to 1). */
  slice: { axis: 0 | 1 | 2; at: number } | null;
  /** Show the tangent plane and normal where the pointer touches a surface. */
  tangent: boolean;
  autoRotate: boolean;
}

function readOptions(o: Partial<Graph3DOptions> | undefined): Graph3DOptions {
  const slice = o?.slice;
  return {
    colorMode: o?.colorMode === "height" ? "height" : "row",
    contours: !!o?.contours,
    slice:
      slice && (slice.axis === 0 || slice.axis === 1 || slice.axis === 2) && Number.isFinite(slice.at)
        ? { axis: slice.axis, at: Math.max(-1, Math.min(1, slice.at)) }
        : null,
    tangent: !!o?.tangent,
    autoRotate: !!o?.autoRotate,
  };
}

type ViewName = "home" | "top" | "front" | "side";

/** A point being dragged. */
interface DragState {
  id: string;
  pos: Vec3;
  /** Where the point was, and the pointer, when this stretch of the drag began. */
  start: Vec3;
  startX: number;
  startY: number;
  /** Pointer minus the point's centre on screen at pickup, so the point doesn't jump to it. */
  offX: number;
  offY: number;
  /**
   * floor: across the point's horizontal plane (x, y);
   * screen: in the upright plane facing the camera (for a view from the side);
   * z: straight up and down.
   */
  mode: "floor" | "screen" | "z";
  /** Taken by the height grip: stays up-and-down whatever keys are held. */
  grip: boolean;
  /** On screen, the pixels `zUnit` of height spans, for up-and-down moves. */
  zAxis: [number, number];
  zUnit: number;
}

/** The on-screen handle of a draggable point (Mafs style), with its height grip. */
interface Handle {
  wrap: HTMLDivElement;
  dot: HTMLDivElement;
  stem: HTMLDivElement;
  grip: HTMLDivElement;
  tip: HTMLDivElement;
  /** Its centre on screen last frame, in canvas pixels. */
  x: number;
  y: number;
}

const HANDLE_CSS = `
.g3d-handle{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;transition:opacity .2s}
.g3d-dot{position:absolute;left:-22px;top:-22px;width:44px;height:44px;border-radius:50%;pointer-events:auto;cursor:grab;touch-action:none;outline:none;-webkit-tap-highlight-color:transparent}
.g3d-dot::before{content:"";position:absolute;inset:7px;border-radius:50%;background:var(--c);opacity:.2;transform:scale(.72);transition:transform .16s ease,opacity .16s ease}
.g3d-dot::after{content:"";position:absolute;inset:15.5px;border-radius:50%;background:var(--c);box-shadow:0 1px 3px rgba(0,0,0,.4);transition:transform .16s ease}
.g3d-handle:hover .g3d-dot::before,.g3d-handle:focus-within .g3d-dot::before{transform:scale(1);opacity:.28}
.g3d-dot:focus-visible::before{outline:2px solid var(--c);outline-offset:2px}
.g3d-handle.dragging .g3d-dot{cursor:grabbing}
.g3d-handle.dragging .g3d-dot::before{transform:scale(1.18);opacity:.34}
.g3d-handle.dragging .g3d-dot::after{transform:scale(1.1)}
.g3d-stem,.g3d-grip{visibility:hidden;opacity:0;transition:opacity .15s ease .3s,visibility 0s linear .45s}
.g3d-handle:hover .g3d-stem,.g3d-handle:hover .g3d-grip,.g3d-handle:focus-within .g3d-stem,.g3d-handle:focus-within .g3d-grip,.g3d-handle.dragging .g3d-stem,.g3d-handle.dragging .g3d-grip{visibility:visible;opacity:1;transition-delay:0s}
.g3d-stem{position:absolute;left:0;top:-6px;height:12px;transform-origin:0 50%;pointer-events:auto}
.g3d-stem::after{content:"";position:absolute;left:0;right:0;top:5px;height:2px;border-radius:1px;background:var(--c);opacity:.75}
.g3d-grip{position:absolute;left:-13px;top:-13px;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--g3d-bg);color:var(--c);border:2px solid var(--c);box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:auto;cursor:ns-resize;touch-action:none}
.g3d-grip:hover,.g3d-handle.dragging.z .g3d-grip{background:var(--c);color:#fff}
.g3d-tip{position:absolute;left:0;top:-24px;transform:translate(-50%,-100%);padding:4px 7px;border-radius:7px;font-weight:600;font-size:11px;white-space:nowrap;text-shadow:none;background:var(--g3d-tip);color:var(--g3d-fg);border:1.5px solid var(--c);box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none;display:none}
.g3d-handle.dragging .g3d-tip{display:block}
.g3d-handle.solver .g3d-stem,.g3d-handle.solver .g3d-grip{display:none}
.g3d-gz .g3d-dot{left:-17px;top:-17px;width:34px;height:34px}
.g3d-gz .g3d-dot::before{inset:5px}
.g3d-gz .g3d-dot::after{inset:11px;box-shadow:0 0 0 2px rgba(255,255,255,.92),0 1px 4px rgba(0,0,0,.45)}
.g3d-gz-center{z-index:3}
.g3d-gz-center .g3d-dot{cursor:move}
.g3d-gz-x .g3d-dot,.g3d-gz-y .g3d-dot{cursor:grab}
.g3d-gz-z .g3d-dot{cursor:ns-resize}
.g3d-gz-x .g3d-dot::after,.g3d-gz-y .g3d-dot::after,.g3d-gz-z .g3d-dot::after{inset:12.5px}
.g3d-gz-scale .g3d-dot{cursor:nwse-resize}
.g3d-gz-scale .g3d-dot::after{border-radius:3px}
.g3d-gz-rotate .g3d-dot{cursor:grab}
.g3d-gz-tip{position:absolute;left:0;top:0;transform:translate(-50%,0);padding:4px 8px;border-radius:7px;font-weight:600;font-size:11px;white-space:nowrap;text-shadow:none;background:var(--g3d-tip);color:var(--g3d-fg);border:1.5px solid var(--c);box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none;display:none}
.g3d-ax{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2}
.g3d-ax-hit{position:absolute;left:-20px;top:-20px;width:40px;height:40px;border-radius:50%;pointer-events:auto;cursor:pointer;touch-action:none;display:flex;align-items:center;justify-content:center;outline:none;-webkit-tap-highlight-color:transparent}
.g3d-ax-ring{width:20px;height:20px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--c) 45%,transparent);background:color-mix(in srgb,var(--c) 8%,transparent);transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}
.g3d-ax.hot .g3d-ax-ring,.g3d-ax-hit:hover .g3d-ax-ring{border:2px solid var(--c);background:color-mix(in srgb,var(--c) 24%,transparent);box-shadow:0 0 12px color-mix(in srgb,var(--c) 65%,transparent);transform:scale(1.28)}
.g3d-ax.dragging .g3d-ax-hit{cursor:grabbing}
.g3d-ax.dragging .g3d-ax-ring{border:2.5px solid var(--c);background:color-mix(in srgb,var(--c) 32%,transparent);box-shadow:0 0 16px color-mix(in srgb,var(--c) 80%,transparent);transform:scale(1.38)}
.g3d-ax-tip{position:absolute;left:0;top:-22px;transform:translate(-50%,-100%);padding:3px 7px;border-radius:6px;font-weight:600;font-size:10.5px;white-space:nowrap;text-shadow:none;background:var(--g3d-tip);color:var(--g3d-fg);border:1.5px solid var(--c);box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none;display:none}
.g3d-ax.hot .g3d-ax-tip,.g3d-ax-hit:hover .g3d-ax-tip,.g3d-ax.dragging .g3d-ax-tip{display:block}
`;

// ─── Screenshots ──────────────────────────────────────────────────────────────

/** The largest side, in pixels, a screenshot is rendered at (GPUs cap their buffers). */
const MAX_CAPTURE_SIDE = 8192;

let overlayCssPromise: Promise<string> | null = null;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** An @font-face rule with its woff2 files written in, so it works inside an image. */
async function inlineFontFace(css: string, base: string): Promise<string> {
  let out = css;
  for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const url = m[1];
    if (url.startsWith("data:") || !/\.woff2(\?|#|$)/.test(url)) continue;
    try {
      const res = await fetch(new URL(url, base).href);
      if (!res.ok) continue;
      out = out.split(url).join(await blobToDataUrl(await res.blob()));
    } catch {
      // Without it the maths falls back to a serif font, still laid out right.
    }
  }
  return out;
}

/**
 * The styles the labels need inside a picture: KaTeX's (with its fonts) and the point
 * handles'. Fetched once, then kept.
 */
function overlayCss(): Promise<string> {
  if (!overlayCssPromise) {
    overlayCssPromise = (async () => {
      const rules: string[] = [HANDLE_CSS];
      const fonts: Promise<string>[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        let list: CSSRuleList;
        try {
          list = sheet.cssRules;
        } catch {
          continue; // another origin's sheet
        }
        const base = sheet.href || location.href;
        for (const rule of Array.from(list)) {
          const text = rule.cssText;
          if (rule instanceof CSSFontFaceRule) {
            if (/KaTeX/i.test(text)) fonts.push(inlineFontFace(text, base));
          } else if (text.includes(".katex")) {
            rules.push(text);
          }
        }
      }
      return [...rules, ...(await Promise.all(fonts))].join("\n");
    })().catch((err) => {
      overlayCssPromise = null;
      throw err;
    });
  }
  return overlayCssPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("overlay image"));
    img.src = src;
  });
}

const GRIP_ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M7.5 8.5 12 4l4.5 4.5M7.5 15.5 12 20l4.5-4.5"/></svg>';

/** The height grip sits this far (px) from its point, and its stem starts and ends this far from each. */
const GRIP_DISTANCE = 40;

type Vec3 = [number, number, number];
type Transform2 = ((x: number, y: number) => [number, number]) | null;
type AffineTransform2 = {
  forward: (x: number, y: number) => [number, number];
  inverse: (gx: number, gy: number) => [number, number];
} | null;

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
  /** A row's label: moved down a line when it would sit on another one. */
  nudge?: boolean;
  /** Behind a surface: drawn faintly. */
  dim?: boolean;
  /** A draggable point's label: beside its handle (the height grip is above it). */
  besideRow?: string;
  /** Typeset maths (the row's label is LaTeX), in place of `text`. */
  html?: string;
  /** Size, relative to the usual (the row's label scale). */
  scale?: number;
  /** Rotation in degrees. */
  rotation?: number;
  /** Horizontal / vertical mirror flip. */
  flipX?: boolean;
  flipY?: boolean;
  /** Name and coordinates, written by the view: kept up to date as the point is dragged. */
  auto?: boolean;
}

/** LaTeX to HTML, remembered: labels are redrawn on every frame of an animation. */
const texCache = new Map<string, string>();
function texToHtml(tex: string): string {
  let html = texCache.get(tex);
  if (html === undefined) {
    try {
      html = katex.renderToString(tex, { throwOnError: false, output: "html" });
    } catch {
      html = "";
    }
    if (texCache.size > 400) texCache.clear();
    texCache.set(tex, html);
  }
  return html;
}

interface SurfaceData {
  positions: Float32Array;
  index: ArrayLike<number>;
}

interface RowEntry {
  id: string;
  color: string;
  /** Everything the row's drawing depends on, except how finely it is sampled. */
  baseKey: string;
  /** 0: coarse (while moving), 1: normal, 2: refined once the graph is at rest. */
  tier: number;
  group: THREE.Group;
  labels: LabelSpec[];
  /** The row's surfaces as triangles, for contours and slices. */
  surfaces: SurfaceData[];
  /** Notes pinned to the corner of the view (see MathFunction.labelPinned). */
  pinned?: LabelSpec[];
  /** A row of points: it has the point menu. */
  isPoint?: boolean;
  /** A point written as plain numbers can be dragged (or a non-point row translated via Origin shift). */
  drag?: {
    prefix: string;
    name: string;
    three: boolean;
    pos: Vec3;
    /** Placed by sliders: dragging it asks the graph to solve for them (see onDragHandle). */
    solver?: boolean;
    /** Dragging a non-point row adjusts transformTranslate around its current anchor. */
    translate?: boolean;
    baseTranslate?: [number, number];
    anchorStart?: [number, number];
  };
  /** A transformable row's gizmo (see syncGizmos). */
  gizmo?: GizmoFrame;
  /** Where the row's own drag or label handle sits (a representative point of it). */
  anchor?: Vec3;
  /** Its frame for the gizmo, noted while it is built (see affineTransformOf). */
  frame?: { px: number; py: number; base: number; spread: number };
}

const AXIS_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];
const AXIS_NAMES = ["x", "y", "z"];
const HOME_CAMERA = new THREE.Vector3(2.9, -3.7, 2.3).setLength(4.7);
const TWO_PI = 2 * Math.PI;

// Kinds that cost real time to sample: drawn coarser while things move, finer at rest.
const HEAVY_KINDS = new Set(["surface", "surface-rhs", "surface-uv", "iso", "curve2d", "region2d"]);

// Low to high.
const HEIGHT_STOPS = ["#3b4cc0", "#22a7d6", "#2fcf8f", "#f4d03f", "#e4572e"];
const HEIGHT_COLORS = HEIGHT_STOPS.map((c) => new THREE.Color(c));

/** The colour for a height, 0 (bottom of the box) to 1 (top). */
function heightColor(t: number, out: THREE.Color): THREE.Color {
  const x = Math.max(0, Math.min(1, t)) * (HEIGHT_COLORS.length - 1);
  const i = Math.min(Math.floor(x), HEIGHT_COLORS.length - 2);
  return out.copy(HEIGHT_COLORS[i]).lerp(HEIGHT_COLORS[i + 1], x - i);
}

// "[1, 2]", "A = [1, 2, 3]": a point given as plain numbers.
const NUMBER = "-?(?:\\d+\\.?\\d*|\\.\\d+)(?:e-?\\d+)?";
const LITERAL_POINT = new RegExp(
  `^(\\s*(?:[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*)?)\\[\\s*${NUMBER}\\s*,\\s*${NUMBER}\\s*(,\\s*${NUMBER}\\s*)?\\]\\s*$`,
);

const SECTION = new Float64Array(6);

/**
 * Where a triangle crosses the plane `coordinate[axis] = level`: calls `emit` with
 * the two ends of the cut, if there is one.
 */
function cutTriangle(
  p: Float32Array,
  a: number,
  b: number,
  c: number,
  axis: number,
  level: number,
  emit: (s: Float64Array) => void,
) {
  const va = p[a * 3 + axis] - level;
  const vb = p[b * 3 + axis] - level;
  const vc = p[c * 3 + axis] - level;
  const na = va < 0;
  const nb = vb < 0;
  const nc = vc < 0;
  if (na === nb && nb === nc) return;
  let n = 0;
  const edge = (i: number, j: number, vi: number, vj: number) => {
    const w = vi / (vi - vj);
    SECTION[n * 3] = p[i * 3] + (p[j * 3] - p[i * 3]) * w;
    SECTION[n * 3 + 1] = p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * w;
    SECTION[n * 3 + 2] = p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * w;
    n++;
  };
  if (na !== nb) edge(a, b, va, vb);
  if (nb !== nc && n < 2) edge(b, c, vb, vc);
  if (nc !== na && n < 2) edge(c, a, vc, va);
  if (n === 2) emit(SECTION);
}

/** Fades a row's shapes (while another row is pointed at in the list), or restores them. */
function dimGroup(group: THREE.Object3D, dim: boolean) {
  group.traverse((o: any) => {
    const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materials) {
      if (!m.userData.base) m.userData.base = { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite };
      const base = m.userData.base;
      m.opacity = dim ? base.opacity * 0.12 : base.opacity;
      m.transparent = dim ? true : base.transparent;
      m.depthWrite = dim ? false : base.depthWrite;
      m.needsUpdate = true;
    }
  });
}

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

/** Extract an explicit alpha channel (0..1) from #rrggbbaa, #rgba, or rgba(...), or null if opaque/unspecified. */
function parseCssAlpha(c: string | undefined): number | null {
  if (!c) return null;
  const s = c.trim();
  if (s.startsWith("#") && s.length === 9) {
    const a = parseInt(s.slice(7, 9), 16);
    return Number.isFinite(a) ? a / 255 : null;
  }
  if (s.startsWith("#") && s.length === 5) {
    const h = s.slice(4, 5);
    const a = parseInt(h + h, 16);
    return Number.isFinite(a) ? a / 255 : null;
  }
  const m = s.match(/^rgba\(\s*([^)]+)\s*\)$/i);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    const last = parts[3];
    if (last !== undefined) {
      const a = last.endsWith("%") ? parseFloat(last) / 100 : parseFloat(last);
      return Number.isFinite(a) ? clamp(a, 0, 1) : null;
    }
  }
  return null;
}

/** A colour three.js accepts: strips alpha bytes (#rrggbbaa) and normalises rgba(...) to rgb(...). */
function toColor(c: string | undefined): THREE.Color {
  let s = (c || "#3b82f6").trim();
  if (s.startsWith("#") && s.length === 9) s = s.slice(0, 7);
  else if (s.startsWith("#") && s.length === 5) s = s.slice(0, 4);
  else {
    const m = s.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,/i);
    if (m) s = `rgb(${Math.round(Number(m[1]))},${Math.round(Number(m[2]))},${Math.round(Number(m[3]))})`;
  }
  const color = new THREE.Color();
  try {
    color.set(s);
  } catch {
    color.set("#3b82f6");
  }
  return color;
}

/** Resolves effective fill opacity from fillOpacity, fallback alpha embedded in fillColor, or defaultAlpha. */
function resolveFillAlpha(f: MathFunction, defaultAlpha: number): number {
  if (typeof f.fillOpacity === "number" && Number.isFinite(f.fillOpacity)) return clamp(f.fillOpacity, 0, 1);
  const embedded = parseCssAlpha(f.fillColor);
  return embedded !== null ? clamp(embedded, 0, 1) : defaultAlpha;
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
    const disposeMat = (mat: any) => {
      if (!mat) return;
      if (mat.map?.userData?.owned) mat.map.dispose();
      mat.dispose?.();
    };
    if (Array.isArray(m)) m.forEach(disposeMat);
    else disposeMat(m);
  });
}

/**
 * Generates a white-on-transparent tiled CanvasTexture matching 2D's 8 Region Style patterns,
 * so materials can tint by fill color and scale alpha cleanly via `opacity`.
 */
function makeRegionPatternTexture(
  pattern: FillPatternType,
  thickness = 2,
  angleDeg = 0,
): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, size, size);
  g.strokeStyle = "#ffffff";
  g.fillStyle = "#ffffff";
  g.lineCap = "round";
  const lw = clamp((Math.max(1, thickness) / 15) * size, 2, 18);
  g.lineWidth = pattern === "math-region" ? Math.max(1.5, lw * 0.55) : lw;

  const diag = (dir: 1 | -1) => {
    const offsets = [-size, 0, size];
    g.beginPath();
    for (const o of offsets) {
      if (dir === 1) {
        g.moveTo(o, size);
        g.lineTo(o + size, 0);
      } else {
        g.moveTo(o, 0);
        g.lineTo(o + size, size);
      }
    }
    g.stroke();
  };

  switch (pattern) {
    case "hatch-diagonal":
    case "math-region":
      diag(1);
      break;
    case "hatch-reverse":
      diag(-1);
      break;
    case "hatch-cross":
      diag(1);
      diag(-1);
      break;
    case "dotted": {
      const r = clamp(lw * 0.85, 2.5, 14);
      g.beginPath();
      g.arc(size / 2, size / 2, r, 0, TWO_PI);
      g.fill();
      break;
    }
    case "grid":
      g.beginPath();
      g.moveTo(0, 0.5);
      g.lineTo(size, 0.5);
      g.moveTo(0.5, 0);
      g.lineTo(0.5, size);
      g.moveTo(0, size - 0.5);
      g.lineTo(size, size - 0.5);
      g.moveTo(size - 0.5, 0);
      g.lineTo(size - 0.5, size);
      g.stroke();
      break;
    case "dashed":
      g.setLineDash([size * 0.45, size * 0.35]);
      g.beginPath();
      g.moveTo(0, size * 0.5);
      g.lineTo(size, size * 0.5);
      g.stroke();
      break;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (angleDeg) {
    tex.center.set(0.5, 0.5);
    tex.rotation = -(angleDeg * Math.PI) / 180;
  }
  tex.userData.owned = true;
  return tex;
}

/** Assigns cumulative arc-length distances along connected polyline runs so dashed/dotted LineMaterial styles don't reset per tiny segment. */
function applyConnectedLineDistances(geometry: LineSegmentsGeometry, segments: number[]) {
  const count = Math.floor(segments.length / 6);
  if (count === 0) return;
  const lineDistances = new Float32Array(count * 2);
  let dist = 0;
  for (let i = 0; i < count; i++) {
    const k = i * 6;
    const ax = segments[k], ay = segments[k + 1], az = segments[k + 2];
    const bx = segments[k + 3], by = segments[k + 4], bz = segments[k + 5];
    const connected =
      i > 0 &&
      Math.abs(ax - segments[k - 3]) < 1e-9 &&
      Math.abs(ay - segments[k - 2]) < 1e-9 &&
      Math.abs(az - segments[k - 1]) < 1e-9;
    if (!connected) dist = 0;
    lineDistances[i * 2] = dist;
    dist += Math.hypot(bx - ax, by - ay, bz - az);
    lineDistances[i * 2 + 1] = dist;
  }
  const buf = new THREE.InstancedInterleavedBuffer(lineDistances, 2, 1);
  geometry.setAttribute("instanceDistanceStart", new THREE.InterleavedBufferAttribute(buf, 1, 0));
  geometry.setAttribute("instanceDistanceEnd", new THREE.InterleavedBufferAttribute(buf, 1, 1));
}

/** World-space UVs for planar and 3D meshes so Region Style hatching tiles evenly across shapes. */
function computeRegionUVs(positions: ArrayLike<number>, tileWorld: number, planar = false): Float32Array {
  const count = Math.floor(positions.length / 3);
  const uvs = new Float32Array(count * 2);
  const inv = 1 / Math.max(1e-6, tileWorld);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (planar) {
      uvs[i * 2] = x * inv;
      uvs[i * 2 + 1] = y * inv;
    } else {
      // Oblique projection with non-degenerate Jacobian on xy, xz, and yz planes.
      uvs[i * 2] = (x + 0.55 * z) * inv;
      uvs[i * 2 + 1] = (y - 0.35 * z) * inv;
    }
  }
  return uvs;
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
  private opts: Graph3DOptions;
  /** The row being built: its surfaces are noted as they are made. */
  private building: RowEntry | null = null;
  private fineReady = false;
  private fineTimer = 0;
  private highlightId: string | null = null;
  // Slice
  private sliceGroup = new THREE.Group();
  private sliceLabels: LabelSpec[] = [];
  private sliceDirty = true;
  // Camera moves
  private tween: {
    start: number;
    duration: number;
    r0: number;
    r1: number;
    phi0: number;
    phi1: number;
    theta0: number;
    dTheta: number;
    fromTarget: THREE.Vector3;
    fromUp: THREE.Vector3;
  } | null = null;
  // Constrained single-axis rotation when dragging an axis arrowhead/tip
  private axisTips: { axis: 0 | 1 | 2; cone: THREE.Mesh; handlePos: Vec3 }[] = [];
  private axisHandles: { axis: 0 | 1 | 2; wrap: HTMLDivElement; tip: HTMLDivElement }[] = [];
  private axisDrag: {
    axis: 0 | 1 | 2;
    pointerId: number;
    lastX: number;
    lastY: number;
    angle: number;
    startOffset: THREE.Vector3;
    startUp: THREE.Vector3;
  } | null = null;
  private hoverAxis: 0 | 1 | 2 | null = null;
  // Pointer: readout, tangent plane, dragging points
  private raycaster = new THREE.Raycaster();
  private occluder = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hoverDirty = false;
  private hover: { local: Vec3; color: string; rowId: string } | null = null;
  private hoverDot = document.createElement("div");
  private pinnedEl = document.createElement("div");
  private hoverTip = document.createElement("div");
  private tangentGroup = new THREE.Group();
  private tangentPlane: THREE.Mesh;
  private tangentArrow: THREE.ArrowHelper;
  private drag: DragState | null = null;
  // Transform gizmos
  private gizmoGroup = new THREE.Group();
  private gizmoEls = new Map<string, HTMLDivElement>();
  private gizmoTip = document.createElement("div");
  private gz: {
    id: string;
    kind: GizmoKind;
    start: GizmoFrame;
    hit0: THREE.Vector3 | null;
    along0: number | null;
  } | null = null;
  private handles = new Map<string, Handle>();
  /** The point a handle is pointed at or focused on: its guide lines are drawn. */
  private activeId: string | null = null;
  private guideGroup = new THREE.Group();
  private occlusionTimer = 0;
  /** Told when the range of the axes changes. */
  onDomain?: (domain: Domain) => void;

  constructor(
    private host: HTMLElement,
    private labelHost: HTMLElement,
    private handleHost: HTMLElement,
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

    // Before the controls attach theirs, so a Ctrl/Shift scroll, and a press on a
    // point that can be dragged, can be kept from them.
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    let style = document.getElementById("g3d-handle-css") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "g3d-handle-css";
      document.head.appendChild(style);
    }
    style.textContent = HANDLE_CSS;
    this.buildAxisTipHandles();

    this.camera.up.set(0, 0, 1); // z points up, as in maths
    this.camera.position.copy(HOME_CAMERA);
    this.controls = new OrbitControls(this.camera, canvas);
    // Scroll and pinch bring the whole graph closer; right-drag (or two fingers) slides it.
    // Ctrl/Shift + scroll and the +/- buttons change the range of the axes instead (zoomBy).
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 14;
    this.controls.zoomSpeed = 1.2;
    this.controls.zoomToCursor = true;
    // The view coasts to a stop instead of halting dead.
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.autoRotateSpeed = 1.2;
    this.controls.addEventListener("change", this.requestRender);

    // A headlight, so a surface is lit from wherever it is looked at.
    const light = new THREE.DirectionalLight(0xffffff, 1.7);
    light.position.set(0.6, 0.8, 1);
    this.camera.add(light);
    this.scene.add(this.camera, new THREE.AmbientLight(0xffffff, 2), this.content);
    this.content.add(this.decor, this.rowsGroup, this.sliceGroup, this.guideGroup, this.gizmoGroup);

    // Tangent plane and normal, placed where the pointer touches a surface.
    const planeGeometry = new THREE.PlaneGeometry(0.5, 0.5);
    this.tangentPlane = new THREE.Mesh(
      planeGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.tangentArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 0.36, 0xffffff, 0.09, 0.045);
    this.tangentGroup.add(
      this.tangentPlane,
      new THREE.LineSegments(new THREE.EdgesGeometry(planeGeometry), new THREE.LineBasicMaterial({ color: 0xffffff })),
      this.tangentArrow,
    );
    this.tangentGroup.visible = false;
    this.scene.add(this.tangentGroup);

    // The readout under the pointer.
    this.hoverDot.style.cssText =
      "position:absolute;left:0;top:0;width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.45);display:none";
    this.hoverTip.style.cssText =
      "position:absolute;left:0;top:0;padding:4px 7px;border-radius:7px;font-weight:600;font-size:11px;white-space:nowrap;text-shadow:none;border:1.5px solid;box-shadow:0 4px 12px rgba(0,0,0,.25);display:none";
    // Notes pinned to the corner: under the graph's toolbar, clear of the height legend.
    this.pinnedEl.style.cssText =
      "position:absolute;top:58px;right:34px;max-width:min(62%,26rem);display:none;flex-direction:column;align-items:flex-end;gap:7px;text-align:right;line-height:1.25";
    this.gizmoTip.className = "g3d-gz-tip";
    this.gizmoTip.dataset.captureExclude = "";
    this.handleHost.appendChild(this.gizmoTip);
    // The pointer's readout isn't part of the graph: left out of screenshots.
    this.hoverDot.dataset.captureExclude = "";
    this.hoverTip.dataset.captureExclude = "";
    labelHost.append(this.hoverDot, this.hoverTip, this.pinnedEl);
    (this.raycaster.params as any).Line2 = { threshold: 8 };

    const p = getProps();
    this.opts = readOptions(p.options);
    this.controls.autoRotate = this.opts.autoRotate;
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
    this.sliceDirty = true;
    this.clearHover();
    this.buildGuides();
    this.onDomain?.({ ...this.domain });
    this.sync();
  }

  getDomain(): Domain {
    return { ...this.domain };
  }

  setOptions(options: Graph3DOptions) {
    this.opts = options;
    this.controls.autoRotate = options.autoRotate;
    this.sliceDirty = true;
    if (!options.tangent) this.tangentGroup.visible = false;
    this.sync();
  }

  /** Fades every row but this one (null: none). */
  highlight(id: string | null) {
    if (id === this.highlightId) return;
    this.highlightId = id;
    for (const row of this.rows.values()) dimGroup(row.group, id !== null && row.id !== id);
    this.syncHandles();
    this.requestRender();
  }

  /** Glides the camera to a standard view. */
  flyTo(view: ViewName) {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const r0 = offset.length() || 1;
    const home = HOME_CAMERA;
    const r1 = home.length();
    let phi1 = Math.acos(home.z / r1);
    let theta1 = Math.atan2(home.y, home.x);
    if (view === "top") {
      phi1 = 0.002; // straight down, x to the right and y up: the 2D graph
      theta1 = -Math.PI / 2;
    } else if (view === "front") {
      phi1 = Math.PI / 2;
      theta1 = -Math.PI / 2;
    } else if (view === "side") {
      phi1 = Math.PI / 2;
      theta1 = 0;
    }
    const theta0 = Math.atan2(offset.y, offset.x);
    // The short way round.
    const dTheta = ((((theta1 - theta0 + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
    this.tween = {
      start: performance.now(),
      duration: 520,
      r0,
      r1,
      phi0: Math.acos(clamp(offset.z / r0, -1, 1)),
      phi1,
      theta0,
      dTheta,
      fromTarget: target.clone(),
      fromUp: this.camera.up.clone().normalize(),
    };
    this.requestRender();
  }

  private stepTween() {
    const tw = this.tween!;
    const k = clamp((performance.now() - tw.start) / tw.duration, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const target = this.controls.target;
    target.copy(tw.fromTarget).multiplyScalar(1 - e);
    const r = tw.r0 + (tw.r1 - tw.r0) * e;
    const phi = Math.max(0.002, tw.phi0 + (tw.phi1 - tw.phi0) * e);
    const theta = tw.theta0 + tw.dTheta * e;
    this.camera.up.lerpVectors(tw.fromUp, new THREE.Vector3(0, 0, 1), e).normalize();
    this.camera.position.set(
      target.x + r * Math.sin(phi) * Math.cos(theta),
      target.y + r * Math.sin(phi) * Math.sin(theta),
      target.z + r * Math.cos(phi),
    );
    this.camera.lookAt(target);
    if (k >= 1) {
      this.camera.up.set(0, 0, 1);
      this.tween = null;
      this.syncControlsUp();
      this.controls.update();
    }
    this.requestRender();
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
    const home = this.homeDomain();
    const d = this.domain;
    if (home.cx !== d.cx || home.cy !== d.cy || home.cz !== d.cz || home.half !== d.half) {
      this.domain = home;
      this.applyDomain();
    }
    this.flyTo("home");
  }

  /**
   * The graph as a picture `scale` times its size on screen: the scene rendered again by
   * three.js at that resolution (surfaces at their finest), with the labels, notes and
   * points drawn over it as vectors, so everything stays sharp.
   */
  async capture(scale: number): Promise<HTMLCanvasElement> {
    const w = this.width;
    const h = this.height;
    const s = Math.max(0.5, Math.min(scale, MAX_CAPTURE_SIDE / Math.max(w, h)));

    // Bring everything up to date, surfaces at their finest, labels placed.
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    window.clearTimeout(this.fineTimer);
    this.fineReady = true;
    this.needsSync = true;
    this.tick();

    const out = document.createElement("canvas");
    out.width = Math.round(w * s);
    out.height = Math.round(h * s);
    const ctx = out.getContext("2d")!;

    const ratio = this.renderer.getPixelRatio();
    try {
      this.renderer.setPixelRatio(s);
      this.renderer.setSize(w, h, false);
      // The gizmo is a tool, not part of the graph.
      this.gizmoGroup.visible = false;
      this.renderer.render(this.scene, this.camera);
      ctx.drawImage(this.renderer.domElement, 0, 0, out.width, out.height);
    } finally {
      this.gizmoGroup.visible = true;
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(w, h, false);
      this.requestRender();
    }

    try {
      await this.drawOverlay(ctx, w, h, s);
    } catch (err) {
      console.warn("3D screenshot: labels drawn as plain text", err);
      this.drawOverlayText(ctx, s);
    }
    return out;
  }

  /** Labels, notes and point handles as one vector image over the scene. */
  private async drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, s: number) {
    const css = await overlayCss();
    const wrap = document.createElement("div");
    wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrap.style.cssText = `position:relative;width:${w}px;height:${h}px;overflow:hidden;margin:0`;
    const style = document.createElement("style");
    style.textContent = css;
    wrap.appendChild(style);
    for (const host of [this.labelHost, this.handleHost]) {
      const cs = getComputedStyle(host);
      const clone = host.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-capture-exclude]").forEach((n) => n.remove());
      clone.removeAttribute("class");
      // Its look came from utility classes the picture doesn't have.
      clone.style.position = "absolute";
      clone.style.inset = "0";
      clone.style.overflow = "hidden";
      clone.style.fontFamily = cs.fontFamily;
      clone.style.fontSize = cs.fontSize;
      clone.style.fontWeight = cs.fontWeight;
      clone.style.color = cs.color;
      wrap.appendChild(clone);
    }
    const xml = new XMLSerializer().serializeToString(wrap);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w * s}" height="${h * s}" viewBox="0 0 ${w} ${h}">` +
      `<foreignObject x="0" y="0" width="${w}" height="${h}">${xml}</foreignObject></svg>`;
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    // Drawn on its own canvas first: if the browser won't let a picture with text in it
    // be read back, the screenshot falls back to plain text instead of failing.
    const layer = document.createElement("canvas");
    layer.width = ctx.canvas.width;
    layer.height = ctx.canvas.height;
    const lctx = layer.getContext("2d")!;
    lctx.drawImage(img, 0, 0, layer.width, layer.height);
    lctx.getImageData(0, 0, 1, 1);
    ctx.drawImage(layer, 0, 0);
  }

  /** The fallback: each label's text, where it stands, in its colour. */
  private drawOverlayText(ctx: CanvasRenderingContext2D, s: number) {
    const box = this.labelHost.getBoundingClientRect();
    const els = [...this.labelEls, ...Array.from(this.pinnedEl.children)] as HTMLElement[];
    ctx.save();
    ctx.scale(s, s);
    ctx.textBaseline = "middle";
    for (const el of els) {
      if (!el.isConnected || el.offsetParent === null) continue;
      const text = el.innerText.trim();
      if (!text) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.fillStyle = cs.color;
      ctx.globalAlpha = Number(cs.opacity) || 1;
      ctx.fillText(text, r.left - box.left, r.top - box.top + r.height / 2);
    }
    ctx.restore();
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
    for (const row of this.rows.values()) row.baseKey = "";
    this.sliceDirty = true;
    this.clearHover();
    this.sync();
  }

  private applyTheme() {
    const bg = this.dark ? "#020617" : "#ffffff";
    this.scene.background = new THREE.Color(bg);
    // A halo in the background colour keeps numbers readable over lines and surfaces.
    this.labelHost.style.textShadow = `0 0 3px ${bg}, 0 0 3px ${bg}, 0 0 2px ${bg}`;
    const hs = this.handleHost.style;
    hs.setProperty("--g3d-bg", bg);
    hs.setProperty("--g3d-tip", this.dark ? "rgba(15,23,42,.94)" : "rgba(255,255,255,.96)");
    hs.setProperty("--g3d-fg", this.dark ? "#f8fafc" : "#0f172a");
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

  private setPointer(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private syncControlsUp() {
    // Keep OrbitControls' cached up-quaternion aligned with camera.up so normal orbit never snaps or rolls unexpectedly.
    const ctrl = this.controls as any;
    if (ctrl._quat && ctrl._quatInverse) {
      ctrl._quat.setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
      ctrl._quatInverse.copy(ctrl._quat).invert();
    }
    ctrl._sphericalDelta?.set(0, 0, 0);
    ctrl._panOffset?.set(0, 0, 0);
  }

  private clientToCanvas(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const scaleX = r.width > 0 ? this.width / r.width : 1;
    const scaleY = r.height > 0 ? this.height / r.height : 1;
    return {
      x: (clientX - r.left) * scaleX,
      y: (clientY - r.top) * scaleY,
      rect: r,
    };
  }

  private buildAxisTipHandles() {
    for (const axis of [0, 1, 2] as const) {
      const name = AXIS_NAMES[axis];
      const color = AXIS_COLORS[axis];
      const wrap = document.createElement("div");
      wrap.className = "g3d-ax";
      wrap.style.setProperty("--c", color);
      wrap.dataset.captureExclude = "";

      const hit = document.createElement("div");
      hit.className = "g3d-ax-hit";
      hit.title = `Drag to rotate only around the ${name}-axis (0°–360°)`;

      const ring = document.createElement("div");
      ring.className = "g3d-ax-ring";
      hit.appendChild(ring);

      const tip = document.createElement("div");
      tip.className = "g3d-ax-tip";
      tip.textContent = `↻ Spin ${name}-axis`;
      wrap.append(hit, tip);
      this.handleHost.appendChild(wrap);

      const start = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.beginAxisDrag(axis, e.pointerId, e.clientX, e.clientY);
        try {
          hit.setPointerCapture(e.pointerId);
        } catch {
          // Synthetic events may have no active pointer to capture.
        }
      };

      const move = (e: PointerEvent) => {
        if (!this.axisDrag || this.axisDrag.axis !== axis || this.axisDrag.pointerId !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        this.stepAxisDrag(e.clientX, e.clientY);
      };

      const end = (e: PointerEvent) => {
        if (!this.axisDrag || this.axisDrag.axis !== axis || this.axisDrag.pointerId !== e.pointerId) return;
        e.stopPropagation();
        try {
          hit.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore if capture was already released.
        }
        this.endAxisDrag(e.type === "pointerup" && e.pointerType === "mouse" ? axis : null);
      };

      hit.addEventListener("pointerenter", () => {
        if (!this.axisDrag) this.setHoveredAxis(axis);
      });
      hit.addEventListener("pointerleave", () => {
        if (!this.axisDrag && this.hoverAxis === axis) this.setHoveredAxis(null);
      });
      hit.addEventListener("pointerdown", start);
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerup", end);
      hit.addEventListener("pointercancel", end);
      hit.addEventListener("wheel", (e) => this.renderer.domElement.dispatchEvent(new WheelEvent(e.type, e)), {
        passive: true,
      });

      this.axisHandles.push({ axis, wrap, tip });
    }
  }

  private placeAxisTipHandles() {
    const at = { x: 0, y: 0 };
    for (const h of this.axisHandles) {
      const tipSpec = this.axisTips.find((t) => t.axis === h.axis);
      if (!tipSpec || !this.toScreen(tipSpec.handlePos[0], tipSpec.handlePos[1], tipSpec.handlePos[2], at)) {
        h.wrap.style.display = "none";
        continue;
      }
      h.wrap.style.display = "";
      h.wrap.style.translate = `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px`;
    }
  }

  private setHoveredAxis(axis: 0 | 1 | 2 | null) {
    const activeAxis = this.axisDrag ? this.axisDrag.axis : axis;
    this.hoverAxis = axis;
    for (const tip of this.axisTips) {
      tip.cone.scale.setScalar(tip.axis === activeAxis ? 1.6 : 1);
    }
    for (const h of this.axisHandles) {
      const isHot = h.axis === activeAxis;
      const isDragging = this.axisDrag?.axis === h.axis;
      h.wrap.classList.toggle("hot", isHot);
      h.wrap.classList.toggle("dragging", isDragging);
      if (!isDragging) h.tip.textContent = `↻ Spin ${AXIS_NAMES[h.axis]}-axis`;
    }
    if (activeAxis !== null) this.clearHover();
    this.requestRender();
  }

  private beginAxisDrag(axis: 0 | 1 | 2, pointerId: number, clientX: number, clientY: number) {
    this.tween = null;
    this.clearHover();
    this.controls.enabled = false;
    this.syncControlsUp();
    const target = this.controls.target;
    this.axisDrag = {
      axis,
      pointerId,
      lastX: clientX,
      lastY: clientY,
      angle: 0,
      startOffset: this.camera.position.clone().sub(target),
      startUp: this.camera.up.clone().normalize(),
    };
    const h = this.axisHandles.find((item) => item.axis === axis);
    if (h) h.tip.textContent = `↻ ${AXIS_NAMES[axis]}: 0°`;
    this.setHoveredAxis(axis);
  }

  private stepAxisDrag(clientX: number, clientY: number) {
    const drag = this.axisDrag;
    if (!drag) return;
    const dx = clientX - drag.lastX;
    const dy = clientY - drag.lastY;
    drag.lastX = clientX;
    drag.lastY = clientY;
    if (dx === 0 && dy === 0) return;

    const axisVec = new THREE.Vector3(drag.axis === 0 ? 1 : 0, drag.axis === 1 ? 1 : 0, drag.axis === 2 ? 1 : 0);
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target);
    const viewDir = offset.clone().multiplyScalar(-1).normalize();

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const frontVel = new THREE.Vector3().crossVectors(viewDir, axisVec);
    const sinAngle = frontVel.length();

    const { x, y, rect } = this.clientToCanvas(clientX, clientY);
    const scaleX = rect.width > 0 ? this.width / rect.width : 1;
    const scaleY = rect.height > 0 ? this.height / rect.height : 1;
    const cdx = dx * scaleX;
    const cdy = dy * scaleY;
    const minDim = Math.max(180, Math.min(this.width, this.height));

    let linearDelta = 0;
    if (sinAngle > 1e-4) {
      const sx = frontVel.dot(camRight) / sinAngle;
      const sy = -frontVel.dot(camUp) / sinAngle;
      linearDelta = ((sx * cdx + sy * cdy) / minDim) * Math.PI * 1.8;
    }

    // End-on fallback: dragging circularly around the projected origin rotates smoothly 0-360 deg.
    const projTarget = target.clone().project(this.camera);
    const tx = (projTarget.x * 0.5 + 0.5) * this.width;
    const ty = (-projTarget.y * 0.5 + 0.5) * this.height;
    const rx = x - tx;
    const ry = y - ty;
    const dialSign = viewDir.dot(axisVec) < 0 ? -1 : 1;
    const dialDelta = dialSign * ((rx * cdy - ry * cdx) / Math.max(rx * rx + ry * ry, 40 * 40));

    const w = clamp((sinAngle - 0.1) / 0.35, 0, 1);
    drag.angle += w * linearDelta + (1 - w) * dialDelta;

    // Apply total angle from start so full 360-degree turns never accumulate numerical drift.
    const rot = new THREE.Quaternion().setFromAxisAngle(axisVec, -drag.angle);
    const rotatedOffset = drag.startOffset.clone().applyQuaternion(rot);
    this.camera.position.copy(target).add(rotatedOffset);
    this.camera.up.copy(drag.startUp).applyQuaternion(rot).normalize();
    this.camera.lookAt(target);

    const deg = (((Math.round((drag.angle * 180) / Math.PI) % 360) + 360) % 360);
    const h = this.axisHandles.find((item) => item.axis === drag.axis);
    if (h) h.tip.textContent = `↻ ${AXIS_NAMES[drag.axis]}: ${deg}°`;
    this.requestRender();
  }

  private endAxisDrag(nextHover: 0 | 1 | 2 | null) {
    if (!this.axisDrag) return;
    this.axisDrag = null;
    this.controls.enabled = true;
    this.syncControlsUp();
    this.controls.update();
    this.setHoveredAxis(nextHover);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.tween = null; // taking hold of the view stops a glide
    this.setPointer(e);
    if (e.pointerType !== "mouse" && e.isPrimary) this.tapDown = { x: e.clientX, y: e.clientY };
    // Touching the graph lets go of a point that was tapped.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && this.handleHost.contains(focused)) focused.blur();
    if (e.pointerType === "mouse") this.clearHover();
    else {
      // A tap reads the point under the finger.
      this.hoverDirty = true;
      this.requestRender();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e);
    if (this.axisDrag) return;
    if (e.pointerType !== "mouse") return;
    if (e.buttons === 0) {
      this.hoverDirty = true;
      this.requestRender();
    } else if (this.hover) this.clearHover();
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") this.clearHover();
  };

  // ── Point menu: right-click a point, or double-tap it, as on the 2D graph ──

  private tapDown: { x: number; y: number } | null = null;
  private lastTap: { t: number; x: number; y: number } | null = null;

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    this.openMenuFromCanvas(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary || !this.tapDown) return;
    const moved = Math.hypot(e.clientX - this.tapDown.x, e.clientY - this.tapDown.y) > 10;
    this.tapDown = null;
    if (moved) {
      this.lastTap = null;
      return;
    }
    if (this.isDoubleTap(e.clientX, e.clientY)) this.openMenuFromCanvas(e.clientX, e.clientY);
  };

  /** Two quick taps in the same place. */
  private isDoubleTap(x: number, y: number): boolean {
    const now = performance.now();
    const last = this.lastTap;
    if (last && now - last.t < 350 && Math.hypot(x - last.x, y - last.y) < 26) {
      this.lastTap = null;
      return true;
    }
    this.lastTap = { t: now, x, y };
    return false;
  }

  /** The menu of the (not draggable) point under the pointer, if there is one. */
  private openMenuFromCanvas(clientX: number, clientY: number) {
    const dots: THREE.Object3D[] = [];
    this.rowsGroup.traverse((o) => {
      if (o.userData.pointRow) dots.push(o);
    });
    if (dots.length === 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points.threshold = 0.05;
    const hit = this.raycaster.intersectObjects(dots, false).find((h) => this.inBox(h.point) && h.index !== undefined);
    if (!hit) return;
    const attribute = (hit.object as THREE.Points).geometry.getAttribute("position");
    const i = hit.index!;
    this.openMenu(hit.object.userData.pointRow, [attribute.getX(i), attribute.getY(i), attribute.getZ(i)], i, clientX, clientY);
  }

  private openMenu(fnId: string, pos: Vec3, index: number, clientX: number, clientY: number) {
    this.clearHover();
    this.getProps().onPointMenu?.({ fnId, index, x: pos[0], y: pos[1], z: pos[2], clientX, clientY });
  }

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
    // Coasting and auto-rotation: each step that moves the camera asks for the next frame.
    if (this.tween) this.stepTween();
    else if (!this.axisDrag) this.controls.update();
    if (this.needsSync) {
      this.needsSync = false;
      this.syncRows();
    }
    if (this.sliceDirty) {
      this.sliceDirty = false;
      this.buildSlice();
    }
    if (this.hoverDirty) {
      this.hoverDirty = false;
      this.pick();
    }
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    // Once the view has been still for a moment, fade the labels a surface hides.
    window.clearTimeout(this.occlusionTimer);
    this.occlusionTimer = window.setTimeout(this.computeOcclusion, 160);
  };

  private toScreen(x: number, y: number, z: number, out: { x: number; y: number }): boolean {
    const v = this.scratch.set(x, y, z).applyMatrix4(this.content.matrixWorld);
    const inside = Math.abs(v.x) <= 1.2 && Math.abs(v.y) <= 1.2 && Math.abs(v.z) <= 1.2;
    v.project(this.camera);
    if (!inside || v.z > 1 || !Number.isFinite(v.x + v.y)) return false;
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    return true;
  }

  private updateLabels() {
    if (this.labelsDirty) {
      this.labelsDirty = false;
      this.labelSpecs = [...this.decorLabels, ...this.sliceLabels];
      for (const row of this.rows.values()) this.labelSpecs.push(...row.labels);
      while (this.labelEls.length < this.labelSpecs.length) {
        const el = document.createElement("span");
        el.style.cssText =
          "position:absolute;left:0;top:0;white-space:nowrap;line-height:1;will-change:transform;transition:opacity .2s";
        this.labelHost.appendChild(el);
        this.labelEls.push(el);
      }
      while (this.labelEls.length > this.labelSpecs.length) this.labelEls.pop()!.remove();
      // Pinned notes: one list in the corner, in row order.
      const pinned = this.getProps().functions.flatMap((f) => this.rows.get(f.id)?.pinned ?? []);
      this.pinnedEl.style.display = pinned.length ? "flex" : "none";
      this.pinnedEl.replaceChildren(
        ...pinned.map((spec) => {
          const line = document.createElement("div");
          if (spec.html) line.innerHTML = spec.html;
          else line.textContent = spec.text;
          line.style.color = spec.color || "";
          line.style.fontSize = `${Math.round(14 * (spec.scale ?? 1))}px`;
          return line;
        }),
      );
      this.labelSpecs.forEach((spec, i) => {
        const el = this.labelEls[i];
        if (spec.html) el.innerHTML = spec.html;
        else el.textContent = spec.text;
        el.style.color = spec.color || "";
        el.style.fontWeight = spec.strong ? "700" : "";
        // Typeset maths reads small at the size of the tick numbers.
        el.style.fontSize = spec.html || spec.scale ? `${Math.round((spec.html ? 15 : 13) * (spec.scale ?? 1))}px` : spec.strong ? "13px" : "";
        el.style.opacity = spec.dim ? "0.2" : "";
      });
    }
    const at = { x: 0, y: 0 };
    // Row labels already placed this frame (x, y, width), to keep the next ones off them.
    const placed: number[] = [];
    for (let i = 0; i < this.labelSpecs.length; i++) {
      const el = this.labelEls[i];
      const spec = this.labelSpecs[i];
      if (!this.toScreen(spec.pos[0], spec.pos[1], spec.pos[2], at)) {
        el.style.display = "none";
        continue;
      }
      // While its point is dragged, the readout over the handle says the same.
      if (spec.besideRow && this.drag?.id === spec.besideRow) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "";
      let py = at.y;
      // Beside the handle's halo, reading away from it.
      const px = spec.besideRow ? at.x + 18 : at.x;
      if (spec.nudge) {
        const w = spec.text.length * 6.7 + 8;
        for (let tries = 0; tries < 8; tries++) {
          let clash = false;
          const mid = spec.besideRow ? px + w / 2 : px;
          for (let j = 0; j < placed.length; j += 3) {
            if (Math.abs(mid - placed[j]) < (w + placed[j + 2]) / 2 && Math.abs(py - placed[j + 1]) < 13) {
              clash = true;
              break;
            }
          }
          if (!clash) break;
          py += 14;
        }
        placed.push(spec.besideRow ? px + w / 2 : px, py, w);
      }
      el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(${spec.besideRow ? "0" : "-50%"},-50%)${spec.rotation ? ` rotate(${spec.rotation}deg)` : ""}${spec.flipX || spec.flipY ? ` scale(${spec.flipX ? -1 : 1},${spec.flipY ? -1 : 1})` : ""}`;
    }

    if (this.hover && this.toScreen(this.hover.local[0], this.hover.local[1], this.hover.local[2], at)) {
      this.hoverDot.style.display = this.hoverTip.style.display = "";
      this.hoverDot.style.transform = `translate(${(at.x - 5).toFixed(1)}px,${(at.y - 5).toFixed(1)}px)`;
      this.hoverTip.style.transform = `translate(-50%,-100%) translate(${at.x.toFixed(1)}px,${(at.y - 12).toFixed(1)}px)`;
    } else {
      this.hoverDot.style.display = this.hoverTip.style.display = "none";
    }

    this.placeHandles();
  }

  // ── Box, axes and grid ──

  private buildDecor() {
    disposeGroup(this.decor);
    this.decor.clear();
    this.axisTips = [];
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
      const tipAxis = axis as 0 | 1 | 2;
      const activeAxis = this.axisDrag ? this.axisDrag.axis : this.hoverAxis;
      if (activeAxis === tipAxis) cone.scale.setScalar(1.6);
      this.decor.add(cone);

      const handleVec = new THREE.Vector3(q[0], q[1], q[2]).addScaledVector(dir, 0.06 * half);
      const name = [...q] as Vec3;
      name[axis] += 0.16 * half;
      this.axisTips.push({
        axis: tipAxis,
        cone,
        handlePos: [handleVec.x, handleVec.y, handleVec.z],
      });
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
      const heavy = HEAVY_KINDS.has(kind);
      const baseKey = [
        objectId(f.compiled ?? f.compiledOde),
        objectId(f.compiled2),
        kind,
        dep,
        f.expr,
        f.color,
        f.fillColor,
        f.fillOpacity,
        f.fillPattern,
        f.patternSpacing,
        f.patternThickness,
        f.patternAngle,
        f.lineStyle,
        f.outlineWidth,
        f.showLabel,
        // Live values in a label ("θ = {{phi}}") change without the row's own shape changing.
        f.showLabel && f.label ? (hasLiveValues(f.label) ? renderLiveLabel(f.label, scope) : f.label) : "",
        f.labelLatex,
        f.labelPlain,
        f.labelScale,
        f.labelPinned,
        f.labelPosition?.join(","),
        f.labelAlignment,
        f.labelRotation,
        f.labelFlipX,
        f.labelFlipY,
        f.showLabelPoint,
        f.showPoint,
        f.isDraggable,
        f.operator,
        f.tRange?.join(","),
        f.odeAxes?.join(","),
        f.odeSteps,
        f.odeAnimate,
        kind === "ode" && f.odeAnimate !== false ? fTime : "",
        f.transformTranslate?.join(","),
        f.transformRotate,
        f.transformScale?.join(","),
        f.isTransformable,
        f.isRotatable,
        f.isResizable,
        f.isPivotEnabled,
        f.isPivotEnabled && f.transformPivot?.join(","),
        f.transformTranslateZ,
        f.handlesOnSelect,
        inDegrees,
        p.quality,
        heavy ? `${this.opts.colorMode},${this.opts.contours}` : "",
        domainKey,
      ].join("|");

      const existing = this.rows.get(f.id);
      const same = !!existing && existing.baseKey === baseKey;
      // A row that follows the clock is redrawn every frame: keep it light while it
      // plays. A row at rest is drawn once more, finer, when nothing has changed for a moment.
      const moving = this.coarse || (p.animating && dep.includes("@"));
      const tier = !heavy ? 1 : moving ? 0 : same ? (this.fineReady ? 2 : Math.max(1, existing!.tier)) : 1;
      if (same && existing!.tier === tier) continue;
      if (existing) this.removeRow(f.id);

      const entry: RowEntry = {
        id: f.id,
        color: f.color,
        baseKey,
        tier,
        group: new THREE.Group(),
        labels: [],
        surfaces: [],
      };
      entry.group.userData.rowId = f.id;
      this.building = entry;
      try {
        this.buildRow(kind, f, scope, fTime, inDegrees, tier, p, entry);
        if (this.opts.contours) this.addContours(entry);
      } catch {
        // A row that fails to evaluate draws nothing, as in 2D.
      }
      this.building = null;
      this.applyRowHeight(entry, f);
      this.makeGizmoFrame(entry, f);
      entry.group.traverse((o) => {
        o.frustumCulled = false;
      });
      if (this.highlightId && this.highlightId !== f.id) dimGroup(entry.group, true);
      this.rowsGroup.add(entry.group);
      this.rows.set(f.id, entry);
      this.labelsDirty = true;
      this.sliceDirty = true;
      if (heavy && tier === 1) this.scheduleFine();
    }

    for (const id of [...this.rows.keys()]) if (!seen.has(id)) this.removeRow(id);

    // A row rebuilt from the graph's state mid-drag is a step behind the pointer.
    if (this.drag) {
      const row = this.rows.get(this.drag.id);
      // A slider-driven handle is wherever its sliders now put it.
      if (row?.drag?.solver) {
        this.drag.pos = [...row.drag.pos];
        this.updateTip();
      } else if (row?.drag) this.placeDrag(row, this.drag.pos);
    }
    this.syncHandles();
    this.syncGizmos();
    this.buildGuides();
    if (this.hover && !this.rows.has(this.hover.rowId)) this.clearHover();
  }

  /** The 3D-only height shift: the whole row lifted up the z-axis, labels and handles too. */
  private applyRowHeight(entry: RowEntry, f: MathFunction) {
    const tz = f.transformTranslateZ || 0;
    if (!tz || !Number.isFinite(tz)) return;
    entry.group.position.z = tz;
    for (const l of entry.labels) l.pos = [l.pos[0], l.pos[1], l.pos[2] + tz];
    if (entry.anchor) entry.anchor = [entry.anchor[0], entry.anchor[1], entry.anchor[2] + tz];
    if (entry.drag) entry.drag.pos = [entry.drag.pos[0], entry.drag.pos[1], entry.drag.pos[2] + tz];
  }

  /** A transformable row's gizmo: where it stands and the transform it shows. */
  private makeGizmoFrame(entry: RowEntry, f: MathFunction) {
    if (!f.isTransformable || f.handlesOnSelect) return;
    const { cx, cy, cz, half } = this.domain;
    const fr = entry.frame ?? { px: 0, py: 0, base: 0, spread: 0 };
    const tz = f.transformTranslateZ || 0;
    // At the height of what's drawn: its anchor, or the middle of its bounding box.
    let z = entry.anchor?.[2];
    if (z === undefined || !Number.isFinite(z)) {
      const box = new THREE.Box3().setFromObject(entry.group);
      z = box.isEmpty() ? tz : (box.min.z + box.max.z) / 2;
    }
    void cx;
    void cy;
    entry.gizmo = {
      px: fr.px,
      py: fr.py,
      base: fr.base,
      radius: clamp(fr.spread + 0.08 * half, 0.28 * half, 0.75 * half),
      tx: f.transformTranslate?.[0] || 0,
      ty: f.transformTranslate?.[1] || 0,
      tz,
      rot: f.transformRotate || 0,
      sx: f.transformScale?.[0] || 1,
      sy: f.transformScale?.[1] || 1,
      cz: clamp(z, cz - half, cz + half),
      pivot: !!f.isPivotEnabled,
      rotatable: !!f.isRotatable,
      resizable: !!f.isResizable,
    };
  }

  private scheduleFine() {
    this.fineReady = false;
    window.clearTimeout(this.fineTimer);
    this.fineTimer = window.setTimeout(() => {
      this.fineReady = true;
      this.sync();
    }, 500);
  }

  private removeRow(id: string) {
    const row = this.rows.get(id);
    if (!row) return;
    this.rowsGroup.remove(row.group);
    disposeGroup(row.group);
    this.rows.delete(id);
    this.labelsDirty = true;
    this.sliceDirty = true;
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
      // NaN counts: a scene leaves a point out by giving it a NaN coordinate.
      const numeric = (c: any) => {
        while (Array.isArray(c) && c.length === 1) c = c[0];
        return typeof c === "number";
      };
      result = Array.isArray(arr) && arr.length === 3 && arr.every(numeric);
    } catch {
      result = false;
    }
    valueShapeCache.set(f.compiled, result);
    return result;
  }

  /** Forward & inverse 2D affine transform for Origin shift, Rotate, Scale, and Pivot. */
  private affineTransformOf(f: MathFunction, pivotPoints: () => [number, number][]): AffineTransform2 {
    const tx = f.transformTranslate?.[0] || 0;
    const ty = f.transformTranslate?.[1] || 0;
    const rot = f.transformRotate || 0;
    const sx = f.transformScale?.[0] || 1;
    const sy = f.transformScale?.[1] || 1;
    let px = 0;
    let py = 0;
    let base = 0;
    if (f.isTransformable) {
      const pts = pivotPoints();
      const pca = computePCA(pts);
      base = Math.atan2(pca.u[1], pca.u[0]);
      [px, py] = f.isPivotEnabled && f.transformPivot ? f.transformPivot : pca.center;
      // The gizmo stands on this frame, transformed or not.
      if (this.building) {
        let spread = 0;
        for (const [x, y] of pts) {
          if (Number.isFinite(x + y)) spread = Math.max(spread, Math.hypot(x - px, y - py));
        }
        this.building.frame = { px, py, base, spread };
      }
    }
    if (tx === 0 && ty === 0 && rot === 0 && sx === 1 && sy === 1) return null;
    const cosA = Math.cos(-base);
    const sinA = Math.sin(-base);
    const cosR = Math.cos(rot + base);
    const sinR = Math.sin(rot + base);
    const safeSx = Math.abs(sx) < 1e-6 ? (sx < 0 ? -1e-6 : 1e-6) : sx;
    const safeSy = Math.abs(sy) < 1e-6 ? (sy < 0 ? -1e-6 : 1e-6) : sy;
    return {
      forward: (x, y) => {
        const lx = x - px;
        const ly = y - py;
        const x1 = (lx * cosA - ly * sinA) * sx;
        const y1 = (lx * sinA + ly * cosA) * sy;
        return [x1 * cosR - y1 * sinR + px + tx, x1 * sinR + y1 * cosR + py + ty];
      },
      inverse: (gx, gy) => {
        const ux = gx - px - tx;
        const uy = gy - py - ty;
        const x1 = (ux * cosR + uy * sinR) / safeSx;
        const y1 = (-ux * sinR + uy * cosR) / safeSy;
        return [x1 * cosA + y1 * sinA + px, -x1 * sinA + y1 * cosA + py];
      },
    };
  }

  /** Forward-only shorthand used by curves and point sets. */
  private transformOf(f: MathFunction, pivotPoints: () => [number, number][]): Transform2 {
    return this.affineTransformOf(f, pivotPoints)?.forward ?? null;
  }

  /** Creates a fill material supporting Fill Color, Fill Alpha, and all 8 Region Styles. */
  private createFillMaterial(
    f: MathFunction,
    defaultAlpha: number,
    defaultPattern: FillPatternType,
    opts: { phong?: boolean; vertexColors?: boolean; forceSolid?: boolean } = {},
  ): THREE.MeshBasicMaterial | THREE.MeshPhongMaterial {
    const pattern: FillPatternType = opts.forceSolid ? "solid" : f.fillPattern || defaultPattern;
    let opacity = resolveFillAlpha(f, defaultAlpha);
    if (pattern === "math-region") opacity = clamp(opacity * 1.5, 0, 1);
    const map =
      pattern === "solid"
        ? null
        : makeRegionPatternTexture(pattern, f.patternThickness || 2, f.patternAngle || 0);
    const transparent = opacity < 0.99 || pattern !== "solid";
    const depthWrite = !transparent;
    const common: THREE.MeshBasicMaterialParameters & THREE.MeshPhongMaterialParameters = {
      color: opts.vertexColors ? 0xffffff : toColor(f.fillColor || f.color),
      vertexColors: !!opts.vertexColors,
      map,
      transparent,
      opacity,
      alphaTest: map ? 0.01 : 0,
      side: THREE.DoubleSide,
      depthWrite,
      clippingPlanes: this.planes,
    };
    if (opts.phong) {
      return new THREE.MeshPhongMaterial({
        ...common,
        shininess: 24,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
    }
    return new THREE.MeshBasicMaterial(common);
  }

  /** Builds a planar/3D filled region mesh with world-scaled UVs for pattern tiling. */
  private buildRegionMesh(
    positions: Float32Array,
    index: number[],
    f: MathFunction,
    defaultAlpha: number,
    defaultPattern: FillPatternType,
    planar: boolean,
  ): THREE.Mesh {
    const tileWorld = (clamp(f.patternSpacing || 15, 4, 40) / 15) * Math.max(0.25, this.domain.half / 4.5);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(computeRegionUVs(positions, tileWorld, planar), 2));
    geometry.setIndex(index);
    return new THREE.Mesh(geometry, this.createFillMaterial(f, defaultAlpha, defaultPattern));
  }

  /** Registers a row label with Alignment, Position offset, Anchor dot, Rotation, Flip, Scale, Plain/LaTeX, and Pinning. */
  private pushRowLabel(
    entry: RowEntry,
    f: MathFunction,
    scope: any,
    anchor: Vec3,
    opts: {
      defaultText?: string;
      locals?: Record<string, unknown>;
      lift?: number;
      nudge?: boolean;
      besideRow?: string;
      isPoint?: boolean;
    } = {},
  ) {
    if (!f.showLabel) return;
    if (!Number.isFinite(anchor[0] + anchor[1] + anchor[2])) return;
    const { half } = this.domain;
    const alignOffset = 0.09 * half;
    let dx = f.labelPosition?.[0] ?? (opts.isPoint ? 0 : 0.04 * half);
    let dy = f.labelPosition?.[1] ?? (opts.isPoint ? 0 : 0.04 * half);
    if (f.labelAlignment && f.labelAlignment !== "custom") {
      if (f.labelAlignment === "center") { dx = 0; dy = 0; }
      else if (f.labelAlignment === "above") { dx = 0; dy = alignOffset; }
      else if (f.labelAlignment === "below") { dx = 0; dy = -alignOffset; }
      else if (f.labelAlignment === "left") { dx = -alignOffset; dy = 0; }
      else if (f.labelAlignment === "right") { dx = alignOffset; dy = 0; }
    }
    const pos: Vec3 = [anchor[0] + dx, anchor[1] + dy, anchor[2] + (opts.lift ?? 0)];
    if (f.showLabelPoint) {
      const dot = this.points([pos], f.color);
      if (dot) entry.group.add(dot);
    }

    const auto = !f.label;
    const raw = f.label || "";
    const odeTex = !auto && f.type === "differential" && !f.labelPlain ? odeSystemToLatex(raw) : null;
    const text = auto
      ? (opts.defaultText ?? f.expr)
      : hasLiveValues(raw)
        ? renderLiveLabel(raw, scope, opts.locals)
        : raw;
    const isMathExpr = !auto && !f.labelPlain && !hasLiveValues(raw) && /[=^_\\()]/.test(text);
    const html = odeTex ? texToHtml(odeTex) : !auto && !f.labelPlain && (f.labelLatex || isMathExpr) ? texToHtml(text) : undefined;
    const spec: LabelSpec = {
      pos,
      text,
      html,
      scale: f.labelScale,
      rotation: f.labelRotation,
      flipX: f.labelFlipX,
      flipY: f.labelFlipY,
      auto,
      color: f.color,
      nudge: opts.nudge ?? true,
      besideRow: opts.besideRow,
    };
    const pinned = !auto && !!f.labelPinned;
    (pinned ? (entry.pinned ??= []) : entry.labels).push(spec);
  }

  /** Attaches a flat XY translation drag handle for non-point rows when `f.isDraggable` is active. */
  private attachShapeDrag(entry: RowEntry, f: MathFunction, anchor: Vec3) {
    if (Number.isFinite(anchor[0] + anchor[1] + anchor[2])) entry.anchor = [anchor[0], anchor[1], anchor[2]];
    if (entry.isPoint || entry.drag || !f.isDraggable || f.isTransformable) return;
    if (!Number.isFinite(anchor[0] + anchor[1] + anchor[2])) return;
    entry.drag = {
      prefix: "",
      name: f.name || "",
      three: false,
      pos: [anchor[0], anchor[1], anchor[2]],
      translate: true,
      baseTranslate: [f.transformTranslate?.[0] || 0, f.transformTranslate?.[1] || 0],
      anchorStart: [anchor[0], anchor[1]],
    };
  }

  private buildRow(
    kind: string,
    f: MathFunction,
    scope: any,
    fTime: number,
    inDegrees: boolean,
    tier: number,
    p: Graph3DProps,
    entry: RowEntry,
  ) {
    const { group } = entry;
    const { cx, cy, cz, half } = this.domain;
    const q = clamp(p.quality || 14, 1, 30);
    const curveSamples = clamp(q * 60, 240, 1800);
    const surfaceCells = Math.min(180, Math.round(clamp(q * 6, 24, 120) * [0.5, 1, 1.6][tier]));
    const isoCells = Math.min(64, Math.round(clamp(q * 2.6, 14, 52) * [0.6, 1, 1.3][tier]));
    const planeCells = Math.round(clamp(q * 10, 60, 220) * [0.5, 1, 1.5][tier]);
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
        let anchor: Vec3 | null = null;
        for (const member of members) {
          member.bind();
          const pts = new Array<number>((n + 1) * 3);
          const rawX = new Float64Array(n + 1);
          const rawY = new Float64Array(n + 1);
          for (let i = 0; i <= n; i++) {
            const x = x0 + ((x1 - x0) * i) / n;
            let y = NaN;
            try {
              s.x = x;
              y = toReal(f.compiled.evaluate(s));
            } catch {}
            rawX[i] = x;
            rawY[i] = y;
            const [gx, gy] = xf ? xf(x, y) : [x, y];
            pts[i * 3] = gx;
            pts[i * 3 + 1] = gy;
            pts[i * 3 + 2] = 0;
            if (!anchor && Number.isFinite(gx + gy) && Math.abs(gx - cx) <= half && Math.abs(gy - cy) <= half) {
              anchor = [gx, gy, 0];
            }
          }
          if (f.fillColor !== undefined) {
            const fillPos: number[] = [];
            const fillIdx: number[] = [];
            const maxJump = xf ? Infinity : 4 * half;
            for (let i = 0; i < n; i++) {
              const y0 = rawY[i], y1 = rawY[i + 1];
              const g0x = pts[i * 3], g0y = pts[i * 3 + 1];
              const g1x = pts[(i + 1) * 3], g1y = pts[(i + 1) * 3 + 1];
              if (!Number.isFinite(y0 + y1 + g0x + g0y + g1x + g1y)) continue;
              if (Math.abs(g1y - g0y) > maxJump) continue;
              const [b0x, b0y] = xf ? xf(rawX[i], 0) : [rawX[i], 0];
              const [b1x, b1y] = xf ? xf(rawX[i + 1], 0) : [rawX[i + 1], 0];
              const baseIdx = fillPos.length / 3;
              fillPos.push(b0x, b0y, 0, b1x, b1y, 0, g1x, g1y, 0, g0x, g0y, 0);
              fillIdx.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
            }
            if (fillIdx.length > 0) {
              add(this.buildRegionMesh(new Float32Array(fillPos), fillIdx, f, 0.3, "hatch-diagonal", true));
            }
          }
          // A jump taller than the box between two samples is an asymptote, not a line.
          add(this.line(pts, member.color, f, { maxJump: xf ? undefined : 4 * half }));
        }
        try {
          s.x = cx;
          const midY = toReal(f.compiled.evaluate(s));
          if (Number.isFinite(midY)) {
            const [gx, gy] = xf ? xf(cx, midY) : [cx, midY];
            anchor = [gx, gy, 0];
          }
        } catch {}
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
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
        let anchor: Vec3 | null = null;
        for (const member of members) {
          member.bind();
          const swept = this.sweep(at, out, t0, t1, curveSamples, xf);
          if (f.fillColor !== undefined) {
            const ring: Vec3[] = [];
            for (let i = 0; i < swept.length; i += 3) {
              if (Number.isFinite(swept[i] + swept[i + 1] + swept[i + 2])) {
                ring.push([swept[i], swept[i + 1], swept[i + 2]]);
              }
            }
            if (ring.length > 2) add(this.polygonFill(ring, f, 0.3));
          }
          add(this.line(swept, member.color, f));
          if (!anchor) {
            for (let i = Math.floor(swept.length / 6) * 3; i < swept.length; i += 3) {
              if (Number.isFinite(swept[i] + swept[i + 1] + swept[i + 2])) {
                anchor = [swept[i], swept[i + 1], swept[i + 2]];
                break;
              }
            }
          }
        }
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
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
        const pole = xf ? xf(0, 0) : ([0, 0] as [number, number]);
        let anchor: Vec3 | null = null;
        for (const member of members) {
          member.bind();
          const swept = this.sweep(at, out, t0, t1, Math.max(curveSamples, 1200), xf);
          if (f.fillColor !== undefined) {
            const fillPos: number[] = [pole[0], pole[1], 0];
            const fillIdx: number[] = [];
            for (let i = 0; i < swept.length - 3; i += 3) {
              const x0 = swept[i], y0 = swept[i + 1], z0 = swept[i + 2];
              const x1 = swept[i + 3], y1 = swept[i + 4], z1 = swept[i + 5];
              if (!Number.isFinite(x0 + y0 + z0 + x1 + y1 + z1)) continue;
              const vIdx = fillPos.length / 3;
              fillPos.push(x0, y0, z0, x1, y1, z1);
              fillIdx.push(0, vIdx, vIdx + 1);
            }
            if (fillIdx.length > 0) {
              add(this.buildRegionMesh(new Float32Array(fillPos), fillIdx, f, 0.3, "hatch-diagonal", true));
            }
          }
          add(this.line(swept, member.color, f));
          if (!anchor) anchor = [pole[0], pole[1], 0];
        }
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
        }
        break;
      }

      case "point3": {
        let pts = extractPoints(f.compiled.evaluate(s)).filter((pt) => Number.isFinite(pt[0] + pt[1] + pt[2]));
        if (pts.length === 0) break;
        const xf = this.transformOf(f, () => pts.map((pt) => [pt[0], pt[1]] as [number, number]));
        if (xf) {
          pts = pts.map((pt) => {
            const [x, y] = xf(pt[0], pt[1]);
            return [x, y, pt[2]];
          });
        }
        this.addPoints(entry, f, pts, scope);
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
          this.addPoints(entry, f, pts, scope);
        } else if (f.type === "vector") {
          const arrows: [Vec3, Vec3][] = isTailTipVector(f)
            ? pts.length >= 2
              ? [[pts[0], pts[1]]]
              : []
            : pts.map((tip) => [origin, tip]);
          for (const [tail, tip] of arrows) this.addArrow(group, f, tail, tip);
          // An arrow set by sliders is dragged by its tip.
          if (f.dragVars?.length && arrows.length > 0) {
            entry.drag = { prefix: "", name: "", three: true, pos: [...arrows[arrows.length - 1][1]], solver: true };
          }
          if (arrows.length > 0) {
            const [tail, tip] = arrows[0];
            const mid: Vec3 = [(tail[0] + tip[0]) / 2, (tail[1] + tip[1]) / 2, (tail[2] + tip[2]) / 2];
            this.pushRowLabel(entry, f, scope, mid);
            this.attachShapeDrag(entry, f, mid);
          }
        } else if (f.type === "line") {
          if (pts.length >= 2) {
            add(this.line([...pts[0], ...pts[1]], f.color, f));
            const mid: Vec3 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2, (pts[0][2] + pts[1][2]) / 2];
            this.pushRowLabel(entry, f, scope, mid);
            this.attachShapeDrag(entry, f, mid);
          }
        } else if (pts.length > 2) {
          add(this.line(pts.flat(), f.color, f, { closed: true }));
          add(this.polygonFill(pts, f));
          const c: Vec3 = [0, 0, 0];
          for (const pt of pts) {
            c[0] += pt[0] / pts.length;
            c[1] += pt[1] / pts.length;
            c[2] += pt[2] / pts.length;
          }
          this.pushRowLabel(entry, f, scope, c);
          this.attachShapeDrag(entry, f, c);
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
        let anchor: Vec3 | null = null;
        for (let i = 0; i < rows; i++) {
          const x = data[i * cols + colX.value];
          const y = data[i * cols + colY.value];
          const [gx, gy] = xf ? xf(x, y) : [x, y];
          const gz = colZ >= 0 ? data[i * cols + colZ] : 0;
          pts[i * 3] = gx;
          pts[i * 3 + 1] = gy;
          pts[i * 3 + 2] = gz;
          if (!anchor && i >= Math.floor(rows / 2) && Number.isFinite(gx + gy + gz)) anchor = [gx, gy, gz];
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
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
        }
        break;
      }

      case "surface":
      case "surface-rhs": {
        const compiled = kind === "surface" ? f.compiled : f.compiled2;
        const limit = 1e3 * half;
        const axf = this.affineTransformOf(f, () => [[0, 0]]);
        const anchor = this.addSurface(
          group,
          (gx, gy, out) => {
            const [lx, ly] = axf ? axf.inverse(gx, gy) : [gx, gy];
            s.x = lx;
            s.y = ly;
            let z = NaN;
            try {
              z = toReal(compiled.evaluate(s));
            } catch {}
            out[0] = gx;
            out[1] = gy;
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
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
        }
        break;
      }

      case "surface-uv": {
        const out3: Vec3 = [0, 0, 0];
        const evalUV = (u: number, v: number) => {
          s.u = u;
          s.v = v;
          return readPosition(f.compiled.evaluate(s), out3) && Number.isFinite(out3[0] + out3[1] + out3[2]);
        };
        const xf = this.transformOf(f, () => {
          for (const [u, v] of [[0, 0], [Math.PI / 2, Math.PI / 2], [Math.PI, Math.PI]]) {
            try {
              if (evalUV(u, v)) return [[out3[0], out3[1]]];
            } catch {}
          }
          return [[0, 0]];
        });
        const anchor = this.addSurface(
          group,
          (u, v, out) => {
            try {
              if (!evalUV(u, v)) return false;
            } catch {
              return false;
            }
            const [gx, gy] = xf ? xf(out3[0], out3[1]) : [out3[0], out3[1]];
            out[0] = gx;
            out[1] = gy;
            out[2] = out3[2];
            return Number.isFinite(out[0] + out[1] + out[2]);
          },
          [0, TWO_PI],
          [0, TWO_PI],
          surfaceCells,
          f,
        );
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
        }
        break;
      }

      case "iso": {
        const anchor = this.addIsoSurface(group, f, s, isoCells);
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
        }
        break;
      }

      case "curve2d":
      case "region2d": {
        const anchor = this.addPlaneRelation(group, f, s, planeCells, kind === "region2d");
        if (anchor) {
          this.pushRowLabel(entry, f, scope, anchor);
          this.attachShapeDrag(entry, f, anchor);
        }
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
      dashSize: (f.lineStyle === "dotted" ? 0.012 : f.lineStyle === "dashdot" ? 0.085 : 0.06) * half,
      gapSize: (f.lineStyle === "dotted" ? 0.03 : f.lineStyle === "dashdot" ? 0.025 : 0.045) * half,
    });
    const line = new LineSegments2(geometry, material);
    if (dashed) applyConnectedLineDistances(geometry, segments);
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

  private addPoints(entry: RowEntry, f: MathFunction, pts: Vec3[], scope: any) {
    pts = pts.filter((pt) => Number.isFinite(pt[0] + pt[1] + pt[2]));
    const literal = f.expr.match(LITERAL_POINT);
    const name = f.expr.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/)?.[1] ?? "";
    // A single point written as plain numbers, not moved by a transform, can be
    // dragged. Flat points follow the row's own "draggable" switch, as in 2D.
    const moved =
      !!f.isTransformable ||
      !!f.transformRotate ||
      !!f.transformTranslate?.some(Boolean) ||
      !!f.transformTranslateZ ||
      (!!f.transformScale && (f.transformScale[0] !== 1 || f.transformScale[1] !== 1));
    entry.isPoint = true;
    if (literal && !moved && f.showPoint !== false && pointDraggable(f)) {
      // Read straight from the expression: a dropped point is where it was dropped,
      // even before the row is compiled again.
      const nums = (f.expr.slice(literal[1].length).match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? []).map(Number);
      if (nums.length >= 2 && nums.every(Number.isFinite)) {
        pts = [[nums[0], nums[1], nums[2] ?? 0]];
        // Drawn as an on-screen handle (see syncHandles), not in the scene.
        entry.drag = { prefix: literal[1] || "", name, three: literal[2] !== undefined, pos: [...pts[0]] };
      }
    }
    // A point placed by sliders (a pendulum bob, a launch height): dragging it sets them.
    if (!entry.drag && f.dragVars?.length && pts.length === 1 && f.showPoint !== false) {
      entry.drag = { prefix: "", name, three: true, pos: [...pts[0]], solver: true };
    }
    if (!entry.drag && f.showPoint !== false) {
      const dots = this.points(pts, f.color);
      if (dots) {
        dots.userData.pointRow = f.id;
        entry.group.add(dots);
      }
    }
    if (!f.showLabel) return;
    for (const pt of pts) {
      // Text standing on its own (no dot) sits exactly where it was put.
      const lift = entry.drag || f.showPoint === false ? 0 : 0.07 * this.domain.half;
      const defaultText = `${name ? `${name} ` : ""}(${pt.map(formatCoord).join(", ")})`;
      this.pushRowLabel(entry, f, scope, pt, {
        defaultText,
        // x, y and xy mean the point's own position in a point's label; text standing
        // on its own (a readout) has no point, so there they keep the graph's meaning.
        locals: f.showPoint === false ? undefined : pointLabelLocals(pt[0], pt[1]),
        lift,
        nudge: f.showPoint !== false,
        besideRow: entry.drag ? f.id : undefined,
        isPoint: true,
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

  private polygonFill(pts: Vec3[], f: MathFunction, defaultAlpha = 0.2): THREE.Mesh | null {
    const flat = pts.every((pt) => Math.abs(pt[2] - pts[0][2]) < 1e-9);
    let index: number[] = [];
    if (flat) {
      // Handles polygons that aren't convex.
      index = THREE.ShapeUtils.triangulateShape(pts.map((pt) => new THREE.Vector2(pt[0], pt[1])), []).flat();
    }
    if (index.length === 0) for (let i = 1; i < pts.length - 1; i++) index.push(0, i, i + 1);
    return this.buildRegionMesh(new Float32Array(pts.flat()), index, f, defaultAlpha, "hatch-diagonal", flat);
  }

  /** A lit, see-through surface, lighter towards the top of the box. */
  private surfaceMesh(positions: Float32Array, index: number[], f: MathFunction): THREE.Mesh {
    const { cz, half } = this.domain;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const tileWorld = (clamp(f.patternSpacing || 15, 4, 40) / 15) * Math.max(0.25, half / 4.5);
    geometry.setAttribute("uv", new THREE.BufferAttribute(computeRegionUVs(positions, tileWorld, false), 2));

    const base = toColor(f.fillColor || f.color);
    const white = new THREE.Color(1, 1, 1);
    const black = new THREE.Color(0, 0, 0);
    const c = new THREE.Color();
    const colors = new Float32Array(positions.length);
    const byHeight = this.opts.colorMode === "height";
    for (let i = 0; i < positions.length; i += 3) {
      const h = clamp((positions[i + 2] - cz) / half, -1, 1);
      if (byHeight) heightColor((h + 1) / 2, c);
      else c.copy(base).lerp(h > 0 ? white : black, Math.abs(h) * (h > 0 ? 0.4 : 0.35));
      colors[i] = c.r;
      colors[i + 1] = c.g;
      colors[i + 2] = c.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.building?.surfaces.push({ positions, index });
    const mesh = new THREE.Mesh(
      geometry,
      this.createFillMaterial(f, 0.86, "solid", { phong: true, vertexColors: true }),
    );
    mesh.userData.surface = true;
    return mesh;
  }

  /** A surface from a function of two parameters, with a mesh drawn in the row's outline style over it. */
  private addSurface(
    group: THREE.Group,
    fn: (a: number, b: number, out: Vec3) => boolean,
    [a0, a1]: [number, number],
    [b0, b1]: [number, number],
    n: number,
    f: MathFunction,
    /** Cells that climb more than this are a break in the surface, not part of it. */
    maxRise?: number,
  ): Vec3 | null {
    const cols = n + 1;
    const positions = new Float32Array(cols * cols * 3);
    const ok = new Uint8Array(cols * cols);
    const out: Vec3 = [0, 0, 0];
    let sumX = 0, sumY = 0, sumZ = 0, validCount = 0;
    let centerAnchor: Vec3 | null = null;
    const midI = Math.floor(n / 2);
    const midJ = Math.floor(n / 2);
    for (let j = 0; j <= n; j++) {
      const b = b0 + ((b1 - b0) * j) / n;
      for (let i = 0; i <= n; i++) {
        const k = j * cols + i;
        if (fn(a0 + ((a1 - a0) * i) / n, b, out)) {
          ok[k] = 1;
          positions[k * 3] = out[0];
          positions[k * 3 + 1] = out[1];
          positions[k * 3 + 2] = out[2];
          sumX += out[0];
          sumY += out[1];
          sumZ += out[2];
          validCount++;
          if (i === midI && j === midJ) centerAnchor = [out[0], out[1], out[2]];
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
    if (index.length === 0) return null;
    group.add(this.surfaceMesh(positions, index, f));

    // Mesh lines: every few samples, both ways. Contours take their place when they are on.
    if (!this.opts.contours) {
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
      if (wire.length > 0) {
        const half = this.domain.half;
        const outlineColor = toColor(f.color);
        const fillDiffers = f.fillColor !== undefined && toColor(f.fillColor).getHex() !== outlineColor.getHex();
        // Tint close-to-same outline slightly for contrast unless the user picked a distinct outline colour.
        const lineColor = fillDiffers
          ? outlineColor
          : outlineColor.clone().lerp(new THREE.Color(this.dark ? 0xffffff : 0x0f172a), 0.35);
        const dashed = !!f.lineStyle && f.lineStyle !== "solid";
        const wireGeo = new LineSegmentsGeometry();
        wireGeo.setPositions(wire);
        const wireMat = new LineMaterial({
          color: lineColor,
          linewidth: Math.max(0.8, (f.outlineWidth !== undefined ? f.outlineWidth : 2) * 0.55),
          transparent: true,
          opacity: fillDiffers ? 0.85 : 0.42,
          clippingPlanes: this.planes,
          dashed,
          dashSize: (f.lineStyle === "dotted" ? 0.012 : f.lineStyle === "dashdot" ? 0.085 : 0.06) * half,
          gapSize: (f.lineStyle === "dotted" ? 0.03 : f.lineStyle === "dashdot" ? 0.025 : 0.045) * half,
        });
        const wireLines = new LineSegments2(wireGeo, wireMat);
        if (dashed) applyConnectedLineDistances(wireGeo, wire);
        group.add(wireLines);
      }
    }
    if (centerAnchor) return centerAnchor;
    return validCount > 0 ? [sumX / validCount, sumY / validCount, sumZ / validCount] : null;
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
  private addIsoSurface(group: THREE.Group, f: MathFunction, s: any, n: number): Vec3 | null {
    const { cx, cy, cz, half } = this.domain;
    const axf = this.affineTransformOf(f, () => [[0, 0]]);
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
        const gy = y0 + j * stepSize;
        for (let i = 0; i < size; i++) {
          const gx = x0 + i * stepSize;
          if (axf) {
            const [lx, ly] = axf.inverse(gx, gy);
            s.x = lx;
            s.y = ly;
          } else {
            s.x = gx;
            s.y = gy;
          }
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
    if (index.length === 0) return null;
    group.add(this.surfaceMesh(new Float32Array(positions), index, f));
    const vCount = positions.length / 3;
    let sx = 0, sy = 0, sz = 0;
    for (let i = 0; i < positions.length; i += 3) {
      sx += positions[i];
      sy += positions[i + 1];
      sz += positions[i + 2];
    }
    return [sx / vCount, sy / vCount, sz / vCount];
  }

  /** A relation in x and y only, on the z = 0 plane: its curve, and its region if it is an inequality (or filled curve). */
  private addPlaneRelation(group: THREE.Group, f: MathFunction, s: any, n: number, region: boolean): Vec3 | null {
    const { cx, cy, half } = this.domain;
    const axf = this.affineTransformOf(f, () => {
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
    const size = n + 1;
    const stepSize = (2 * half) / n;
    const x0 = cx - half;
    const y0 = cy - half;
    const value = this.relation(f, s);
    const values = new Float32Array(size * size);
    for (let j = 0; j < size; j++) {
      const gy = y0 + j * stepSize;
      for (let i = 0; i < size; i++) {
        const gx = x0 + i * stepSize;
        if (axf) {
          const [lx, ly] = axf.inverse(gx, gy);
          s.x = lx;
          s.y = ly;
        } else {
          s.x = gx;
          s.y = gy;
        }
        values[j * size + i] = value();
      }
    }

    // Marching squares directly in transformed world space (gx, gy).
    const segments: number[] = [];
    const cross = (xa: number, ya: number, va: number, xb: number, yb: number, vb: number): [number, number] => {
      const w = va === vb ? 0.5 : clamp(va / (va - vb), 0, 1);
      return [xa + (xb - xa) * w, ya + (yb - ya) * w];
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
    let anchor: Vec3 | null = null;
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
          dashSize: (f.lineStyle === "dotted" ? 0.012 : f.lineStyle === "dashdot" ? 0.085 : 0.06) * half,
          gapSize: (f.lineStyle === "dotted" ? 0.03 : f.lineStyle === "dashdot" ? 0.025 : 0.045) * half,
        }),
      );
      if (dashed) applyConnectedLineDistances(geometry, segments);
      group.add(line);
      anchor = [segments[0], segments[1], 0];
    }

    const shouldFill = region || f.fillColor !== undefined;
    if (!shouldFill) return anchor;
    const op = f.operator || f.expr2 || "<";
    const holds = region
      ? (d: number) => (op === "<" ? d < 0 : op === "<=" ? d <= 0 : op === ">" ? d > 0 : d >= 0)
      : (d: number) => d <= 0;
    const positions = new Float32Array(size * size * 3);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        positions[(j * size + i) * 3] = x0 + i * stepSize;
        positions[(j * size + i) * 3 + 1] = y0 + j * stepSize;
      }
    }
    const index: number[] = [];
    let sx = 0, sy = 0, cells = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * size + i;
        if (holds(values[k]) && holds(values[k + 1]) && holds(values[k + size]) && holds(values[k + size + 1])) {
          index.push(k, k + 1, k + size + 1, k, k + size + 1, k + size);
          sx += x0 + (i + 0.5) * stepSize;
          sy += y0 + (j + 0.5) * stepSize;
          cells++;
        }
      }
    }
    if (index.length > 0) {
      group.add(this.buildRegionMesh(positions, index, f, 0.3, "hatch-diagonal", true));
      if (!anchor && cells > 0) anchor = [sx / cells, sy / cells, 0];
    }
    return anchor;
  }

  // ── Contours and slices ──

  /** Level curves of a row's surfaces, on the surface and as shadows on the floor of the box. */
  private addContours(entry: RowEntry) {
    if (entry.surfaces.length === 0) return;
    const { cz, half } = this.domain;
    const step = niceStep(half) / 2;
    const lo = cz - half;
    const hi = cz + half;
    // Drawn inside the row, which may be lifted (its height shift): undo that for the floor.
    const floorZ = lo + 0.004 * half - entry.group.position.z;
    const onSurface: number[] = [];
    const onFloor: number[] = [];
    const floorColors: number[] = [];
    const base = toColor(entry.color);
    const c = new THREE.Color();
    const byHeight = this.opts.colorMode === "height";
    for (const { positions, index } of entry.surfaces) {
      for (let t = 0; t < index.length; t += 3) {
        const a = index[t];
        const b = index[t + 1];
        const d = index[t + 2];
        const za = positions[a * 3 + 2];
        const zb = positions[b * 3 + 2];
        const zd = positions[d * 3 + 2];
        const k0 = Math.ceil(Math.max(lo, Math.min(za, zb, zd)) / step);
        const k1 = Math.floor(Math.min(hi, Math.max(za, zb, zd)) / step);
        for (let k = k0; k <= k1; k++) {
          const level = k * step;
          cutTriangle(positions, a, b, d, 2, level, (s) => {
            onSurface.push(s[0], s[1], s[2], s[3], s[4], s[5]);
            onFloor.push(s[0], s[1], floorZ, s[3], s[4], floorZ);
            if (byHeight) heightColor((level - lo) / (2 * half), c);
            else c.copy(base);
            floorColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
          });
        }
      }
    }
    if (onSurface.length === 0) return;
    const surfaceGeometry = new THREE.BufferGeometry();
    surfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(onSurface, 3));
    entry.group.add(
      new THREE.LineSegments(
        surfaceGeometry,
        new THREE.LineBasicMaterial({
          color: this.dark ? 0xffffff : 0x0f172a,
          transparent: true,
          opacity: this.dark ? 0.6 : 0.5,
          clippingPlanes: this.planes,
        }),
      ),
    );
    const floorGeometry = new THREE.BufferGeometry();
    floorGeometry.setAttribute("position", new THREE.Float32BufferAttribute(onFloor, 3));
    floorGeometry.setAttribute("color", new THREE.Float32BufferAttribute(floorColors, 3));
    entry.group.add(
      new THREE.LineSegments(
        floorGeometry,
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, clippingPlanes: this.planes }),
      ),
    );
  }

  /** The cutting plane, and the curve it cuts out of every surface. */
  private buildSlice() {
    disposeGroup(this.sliceGroup);
    this.sliceGroup.clear();
    this.sliceLabels = [];
    this.labelsDirty = true;
    const slice = this.opts.slice;
    if (!slice) return;
    const { cx, cy, cz, half } = this.domain;
    const centre = [cx, cy, cz];
    const axis = slice.axis;
    const b = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    const value = centre[axis] + slice.at * half * 0.999;
    const color = new THREE.Color(AXIS_COLORS[axis]);

    const corner = (sb: number, sc: number): number[] => {
      const pt = [0, 0, 0];
      pt[axis] = value;
      pt[b] = centre[b] + sb * half;
      pt[c] = centre[c] + sc * half;
      return pt;
    };
    const quad = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    const planeGeometry = new THREE.BufferGeometry();
    planeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(quad.flat(), 3));
    planeGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.sliceGroup.add(
      new THREE.Mesh(
        planeGeometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
      ),
    );
    const outline = new THREE.BufferGeometry();
    outline.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 1, 1, 2, 2, 3, 3, 0].flatMap((i) => quad[i]), 3),
    );
    this.sliceGroup.add(
      new THREE.LineSegments(outline, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })),
    );
    this.sliceLabels.push({
      pos: corner(1, 1) as Vec3,
      text: `${AXIS_NAMES[axis]} = ${formatCoord(value)}`,
      color: AXIS_COLORS[axis],
      strong: true,
    });

    // The cross-sections stand out from their surface: lighter on dark, darker on light.
    const contrast = new THREE.Color(this.dark ? 0xffffff : 0x000000);
    for (const row of this.rows.values()) {
      const segments: number[] = [];
      // A lifted row's surfaces are stored as built: cut them where they are drawn.
      const lift = row.group.position.z;
      const level = axis === 2 ? value - lift : value;
      for (const { positions, index } of row.surfaces) {
        for (let t = 0; t < index.length; t += 3) {
          cutTriangle(positions, index[t], index[t + 1], index[t + 2], axis, level, (s) => {
            segments.push(s[0], s[1], s[2] + lift, s[3], s[4], s[5] + lift);
          });
        }
      }
      if (segments.length === 0) continue;
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(segments);
      const line = new LineSegments2(
        geometry,
        new LineMaterial({
          color: toColor(row.color).lerp(contrast, 0.55),
          linewidth: 4,
          clippingPlanes: this.planes,
        }),
      );
      line.frustumCulled = false;
      line.renderOrder = 2;
      this.sliceGroup.add(line);
    }
  }

  // ── Pointer: readout, tangent plane, dragging ──

  private inBox(p: THREE.Vector3): boolean {
    return Math.abs(p.x) <= 1.004 && Math.abs(p.y) <= 1.004 && Math.abs(p.z) <= 1.004;
  }

  /** Finds what is under the pointer and shows its coordinates there. */
  private pick() {
    const targets: THREE.Object3D[] = [];
    this.rowsGroup.traverse((o: any) => {
      if (o.isMesh || o.isPoints) targets.push(o);
    });
    if (targets.length === 0) return this.clearHover();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points.threshold = 0.035;
    let hits: THREE.Intersection[];
    try {
      hits = this.raycaster.intersectObjects(targets, false);
    } catch {
      return this.clearHover();
    }
    // Nearest first; a point or curve lying on a surface wins over the surface.
    const rank = (o: any) => (o.isPoints ? 2 : o.isLineSegments2 ? 1 : 0);
    let best: { hit: THREE.Intersection; point: THREE.Vector3; rank: number } | null = null;
    for (const hit of hits) {
      const point: THREE.Vector3 = (hit as any).pointOnLine ?? hit.point;
      if (!this.inBox(point)) continue; // clipped away: not on screen
      if (best && hit.distance > best.hit.distance + 0.06) break;
      const r = rank(hit.object);
      if (!best || r > best.rank) best = { hit, point, rank: r };
    }
    if (!best) return this.clearHover();

    let owner: THREE.Object3D | null = best.hit.object;
    while (owner && !owner.userData.rowId) owner = owner.parent;
    const row = owner ? this.rows.get(owner.userData.rowId) : undefined;
    if (!row) return this.clearHover();

    const local = this.content.worldToLocal(best.point.clone());
    this.hover = { local: [local.x, local.y, local.z], color: row.color, rowId: row.id };
    const css = `#${toColor(row.color).getHexString()}`;
    this.hoverDot.style.background = css;
    this.hoverTip.textContent = `(${formatCoord(local.x)}, ${formatCoord(local.y)}, ${formatCoord(local.z)})`;
    this.hoverTip.style.background = this.dark ? "rgba(15,23,42,.94)" : "rgba(255,255,255,.96)";
    this.hoverTip.style.color = this.dark ? "#f8fafc" : "#0f172a";
    this.hoverTip.style.borderColor = css;

    const face = best.hit.face;
    if (this.opts.tangent && best.hit.object.userData.surface && face) {
      const normal = face.normal.clone().transformDirection(best.hit.object.matrixWorld);
      // Towards the viewer.
      if (normal.dot(this.scratch.copy(this.camera.position).sub(best.point)) < 0) normal.negate();
      this.tangentGroup.position.copy(best.point);
      this.tangentGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      (this.tangentPlane.material as THREE.MeshBasicMaterial).color.copy(toColor(row.color));
      this.tangentArrow.setColor(this.dark ? 0xffffff : 0x0f172a);
      this.tangentGroup.visible = true;
    } else {
      this.tangentGroup.visible = false;
    }
  }

  private clearHover() {
    this.hoverDirty = false;
    if (!this.hover && !this.tangentGroup.visible) return;
    this.hover = null;
    this.tangentGroup.visible = false;
    this.requestRender();
  }

  // ── Draggable points ──

  /** One handle per draggable point; made, recoloured and removed as rows change. */
  private syncHandles() {
    for (const [id, h] of this.handles) {
      if (this.rows.get(id)?.drag) continue;
      if (this.drag?.id === id) this.drag = null;
      h.wrap.remove();
      this.handles.delete(id);
      if (this.activeId === id) this.activeId = null;
    }
    for (const row of this.rows.values()) {
      if (!row.drag) continue;
      let h = this.handles.get(row.id);
      if (!h) {
        h = this.makeHandle(row.id);
        this.handles.set(row.id, h);
      }
      h.wrap.style.setProperty("--c", `#${toColor(row.color).getHexString()}`);
      h.wrap.classList.toggle("solver", !!(row.drag.solver || row.drag.translate));
      const name = row.drag.name ? `Point ${row.drag.name}` : row.drag.translate ? "Shape" : "Point";
      h.dot.setAttribute(
        "aria-label",
        row.drag.translate
          ? `${name} handle at (${row.drag.pos.map(formatCoord).join(", ")}). Drag or use arrow keys to shift.`
          : `${name} at (${row.drag.pos.map(formatCoord).join(", ")}). Arrow keys move it; Page Up and Page Down change its height.`,
      );
      // Drawn faintly with the rest of its row while another row is pointed at in the list.
      h.wrap.dataset.faded = this.highlightId && this.highlightId !== row.id ? "1" : "";
    }
  }

  private makeHandle(id: string): Handle {
    const wrap = document.createElement("div");
    wrap.className = "g3d-handle";
    const stem = document.createElement("div");
    stem.className = "g3d-stem";
    stem.dataset.captureExclude = "";
    const grip = document.createElement("div");
    grip.className = "g3d-grip";
    grip.title = "Drag up or down to change the height (z)";
    grip.innerHTML = GRIP_ICON;
    grip.dataset.captureExclude = "";
    const dot = document.createElement("div");
    dot.className = "g3d-dot";
    dot.tabIndex = 0;
    dot.setAttribute("role", "slider");
    dot.title = "Drag to move · right-click or double-tap for options";
    const tip = document.createElement("div");
    tip.className = "g3d-tip";
    tip.dataset.captureExclude = "";
    wrap.append(stem, grip, dot, tip);
    this.handleHost.appendChild(wrap);
    const h: Handle = { wrap, dot, stem, grip, tip, x: 0, y: 0 };

    let tapDown: { x: number; y: number } | null = null;
    const start = (e: PointerEvent, grip: boolean) => {
      if (e.button !== 0) return;
      tapDown = !grip && e.pointerType !== "mouse" ? { x: e.clientX, y: e.clientY } : null;
      e.preventDefault();
      e.stopPropagation();
      dot.focus({ preventScroll: true });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      this.beginDrag(id, e, grip);
    };
    const move = (e: PointerEvent) => {
      if (this.drag?.id !== id) return;
      e.preventDefault();
      e.stopPropagation();
      this.dragTo(e.clientX, e.clientY, e.shiftKey);
    };
    const end = (e: PointerEvent) => {
      if (this.drag?.id !== id) return;
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      this.endDrag();
      // A double tap on a point opens its menu.
      const tapped = !!tapDown && Math.hypot(e.clientX - tapDown.x, e.clientY - tapDown.y) <= 10;
      tapDown = null;
      if (e.type === "pointerup" && tapped && this.isDoubleTap(e.clientX, e.clientY)) this.openHandleMenu(id, e.clientX, e.clientY);
    };
    dot.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.endDrag();
      this.openHandleMenu(id, e.clientX, e.clientY);
    });
    for (const el of [dot, grip, stem]) {
      el.addEventListener("pointerdown", (e) => start(e, el !== dot));
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      // The graph around must not scroll or zoom from a wheel over a handle either.
      el.addEventListener("wheel", (e) => this.renderer.domElement.dispatchEvent(new WheelEvent(e.type, e)), { passive: true });
    }
    const activate = (on: boolean) => {
      const next = on ? id : this.activeId === id ? null : this.activeId;
      if (next === this.activeId) return;
      this.activeId = next;
      this.buildGuides();
      this.requestRender();
    };
    wrap.addEventListener("pointerenter", () => activate(true));
    wrap.addEventListener("pointerleave", () => {
      if (document.activeElement !== dot) activate(false);
    });
    dot.addEventListener("focus", () => activate(true));
    dot.addEventListener("blur", () => activate(false));
    dot.addEventListener("keydown", (e) => this.onHandleKey(id, e));
    return h;
  }

  /** Puts each handle over its point, and its height grip along the z-axis as seen on screen. */
  private placeHandles() {
    this.placeAxisTipHandles();
    this.placeGizmos();
    if (this.handles.size === 0) return;
    const at = { x: 0, y: 0 };
    const up = { x: 0, y: 0 };
    const zUnit = 0.16 * this.domain.half;
    for (const [id, h] of this.handles) {
      const pos = this.rows.get(id)?.drag?.pos;
      if (!pos || !this.toScreen(pos[0], pos[1], pos[2], at)) {
        h.wrap.style.display = "none";
        continue;
      }
      h.wrap.style.display = "";
      h.x = at.x;
      h.y = at.y;
      h.wrap.style.translate = `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px`;
      if (h.wrap.dataset.faded) h.wrap.style.opacity = "0.15";
      else if (h.wrap.style.opacity === "0.15") h.wrap.style.opacity = "";

      // Up the z-axis on screen; straight up the screen when looking down the z-axis.
      let dx = 0;
      let dy = -1;
      const raised = this.toScreen(pos[0], pos[1], pos[2] + zUnit, up) || this.toScreen(pos[0], pos[1], pos[2] - zUnit, up);
      if (raised) {
        const sign = this.toScreen(pos[0], pos[1], pos[2] + zUnit, up) ? 1 : -1;
        const len = Math.hypot(up.x - at.x, up.y - at.y);
        if (len > 6) {
          dx = (sign * (up.x - at.x)) / len;
          dy = (sign * (up.y - at.y)) / len;
        }
      }
      const r0 = 10;
      const r1 = GRIP_DISTANCE - 13;
      h.grip.style.translate = `${(dx * GRIP_DISTANCE).toFixed(1)}px ${(dy * GRIP_DISTANCE).toFixed(1)}px`;
      h.stem.style.translate = `${(dx * r0).toFixed(1)}px ${(dy * r0).toFixed(1)}px`;
      h.stem.style.width = `${r1 - r0}px`;
      h.stem.style.rotate = `${Math.atan2(dy, dx)}rad`;
      // The readout sits on the side away from the grip.
      h.tip.style.top = dy < 0 ? "38px" : "-24px";
      h.tip.style.transform = dy < 0 ? "translate(-50%, 0)" : "translate(-50%, -100%)";
    }
  }

  private beginDrag(id: string, e: PointerEvent, grip: boolean) {
    const row = this.rows.get(id);
    const h = this.handles.get(id);
    if (!row?.drag || !h) return;
    this.tween = null;
    this.clearHover();
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.drag = {
      id,
      pos: [...row.drag.pos],
      start: [...row.drag.pos],
      startX: e.clientX,
      startY: e.clientY,
      offX: grip ? 0 : e.clientX - (rect.left + h.x),
      offY: grip ? 0 : e.clientY - (rect.top + h.y),
      mode: "floor",
      grip,
      zAxis: [0, -GRIP_DISTANCE],
      zUnit: 0.16 * this.domain.half,
    };
    this.setDragMode(e.clientX, e.clientY, this.wantedMode(e.shiftKey));
    // Turning the graph under a moving point would fight the hand moving it.
    this.controls.autoRotate = false;
    h.wrap.classList.add("dragging");
    this.updateTip();
    this.buildGuides();
    this.requestRender();
  }

  private endDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.controls.autoRotate = this.opts.autoRotate;
    const h = this.handles.get(drag.id);
    h?.wrap.classList.remove("dragging", "z");
    this.buildGuides();
    this.requestRender();
  }

  /**
   * Which way the point moves: up and down on the grip or with Shift; otherwise across
   * its horizontal plane, unless that plane is seen edge-on (a view from the side), when
   * it moves in the upright plane facing the camera and so follows the pointer anyway.
   */
  private wantedMode(shift: boolean): DragState["mode"] {
    const row = this.drag ? this.rows.get(this.drag.id) : undefined;
    if (!row?.drag?.translate && (this.drag?.grip || shift)) return "z";
    const viewDir = this.camera.getWorldDirection(new THREE.Vector3());
    return Math.abs(viewDir.z) < 0.3 ? "screen" : "floor";
  }

  /** Starts a new stretch of the drag, from where the point is now, in `mode`. */
  private setDragMode(clientX: number, clientY: number, mode: DragState["mode"]) {
    const d = this.drag!;
    d.mode = mode;
    d.start = [...d.pos];
    d.startX = clientX;
    d.startY = clientY;
    const at = { x: 0, y: 0 };
    const up = { x: 0, y: 0 };
    const [x, y, z] = d.pos;
    if (this.toScreen(x, y, z, at) && this.toScreen(x, y, z + d.zUnit, up) && Math.hypot(up.x - at.x, up.y - at.y) > 6) {
      d.zAxis = [up.x - at.x, up.y - at.y];
    } else {
      d.zAxis = [0, -GRIP_DISTANCE];
    }
    this.handles.get(d.id)?.wrap.classList.toggle("z", mode === "z");
  }

  private dragTo(clientX: number, clientY: number, shift: boolean) {
    const d = this.drag;
    const row = d ? this.rows.get(d.id) : undefined;
    if (!d || !row?.drag) return;
    if (row.drag.solver) {
      // The spot under the pointer, at the handle's depth; the graph then finds the
      // slider values that bring the handle as near to it as they can.
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((clientX - d.offX - rect.left) / rect.width) * 2 - 1,
        -((clientY - d.offY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const world = new THREE.Vector3(...d.pos).applyMatrix4(this.content.matrixWorld);
      const facing = this.camera.getWorldDirection(new THREE.Vector3());
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(facing, world);
      const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return;
      const local = this.content.worldToLocal(hit);
      this.getProps().onDragHandle?.(row.id, [local.x, local.y, local.z - (this.rows.get(row.id)?.group.position.z ?? 0)]);
      this.requestRender();
      return;
    }
    // Shift pressed or let go mid-drag switches between up-and-down and across.
    const wanted = this.wantedMode(shift);
    if ((wanted === "z") !== (d.mode === "z")) this.setDragMode(clientX, clientY, wanted);

    const { cx, cy, cz, half } = this.domain;
    const snap = niceStep(half) / 10;
    const settle = (v: number, centre: number) =>
      Number((Math.round(clamp(v, centre - half, centre + half) / snap) * snap).toFixed(8));
    let next: Vec3;
    if (d.mode === "z") {
      const [sx, sy] = d.zAxis;
      const along = ((clientX - d.startX) * sx + (clientY - d.startY) * sy) / (sx * sx + sy * sy);
      next = [d.start[0], d.start[1], settle(d.start[2] + along * d.zUnit, cz)];
    } else {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((clientX - d.offX - rect.left) / rect.width) * 2 - 1,
        -((clientY - d.offY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const world = new THREE.Vector3(...d.start).applyMatrix4(this.content.matrixWorld);
      const normal = new THREE.Vector3(0, 0, 1);
      if (d.mode === "screen") {
        this.camera.getWorldDirection(normal);
        normal.z = 0;
        if (normal.lengthSq() < 1e-6) return;
        normal.normalize();
      }
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world);
      const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return;
      const local = this.content.worldToLocal(hit);
      next =
        d.mode === "floor"
          ? [settle(local.x, cx), settle(local.y, cy), d.start[2]]
          : [settle(local.x, cx), settle(local.y, cy), settle(local.z, cz)];
    }
    this.commitPoint(row, next);
  }

  /** Arrow keys move a focused point across the floor; Page Up / Down (or Shift + Up / Down) raise it. */
  private onHandleKey(id: string, e: KeyboardEvent) {
    const row = this.rows.get(id);
    if (!row?.drag) return;
    const step = (niceStep(this.domain.half) / 10) * (e.altKey ? 0.1 : 1);
    const [x, y, z] = row.drag.pos;
    let next: Vec3 | null = null;
    if (e.key === "ArrowLeft") next = [x - step, y, z];
    else if (e.key === "ArrowRight") next = [x + step, y, z];
    else if (e.key === "ArrowUp") next = e.shiftKey ? [x, y, z + step] : [x, y + step, z];
    else if (e.key === "ArrowDown") next = e.shiftKey ? [x, y, z - step] : [x, y - step, z];
    else if (e.key === "PageUp") next = [x, y, z + step];
    else if (e.key === "PageDown") next = [x, y, z - step];
    else if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
    else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10") || e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const h = this.handles.get(id);
      const rect = this.renderer.domElement.getBoundingClientRect();
      if (h) this.openHandleMenu(id, rect.left + h.x, rect.top + h.y);
      return;
    }
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    if (row.drag.solver) {
      this.getProps().onDragHandle?.(id, next);
      return;
    }
    this.commitPoint(row, next.map((v) => Number(v.toFixed(8))) as Vec3);
  }

  private openHandleMenu(id: string, clientX: number, clientY: number) {
    const row = this.rows.get(id);
    // Only points have the menu (an arrow's handle is its tip, not a point row).
    if (row?.isPoint && row.drag) this.openMenu(id, row.drag.pos, 0, clientX, clientY);
  }

  /** Moves a point or shape handle and writes its new position / Origin shift back to its row. */
  private commitPoint(row: RowEntry, next: Vec3) {
    const d = row.drag!;
    if (next[0] === d.pos[0] && next[1] === d.pos[1] && next[2] === d.pos[2]) return;
    if (this.drag?.id === row.id) this.drag.pos = next;
    this.placeDrag(row, next);
    if (d.translate && d.baseTranslate && d.anchorStart) {
      const tx = Number((d.baseTranslate[0] + (next[0] - d.anchorStart[0])).toFixed(3));
      const ty = Number((d.baseTranslate[1] + (next[1] - d.anchorStart[1])).toFixed(3));
      this.getProps().onPatchRow?.(row.id, { transformTranslate: [tx, ty] });
    } else {
      const three = d.three || next[2] !== 0;
      this.getProps().onMovePoint?.(row.id, `${d.prefix}[${next[0]}, ${next[1]}${three ? `, ${next[2]}` : ""}]`);
    }
    this.updateTip();
    this.buildGuides();
    this.requestRender();
  }

  private updateTip() {
    const d = this.drag;
    const row = d ? this.rows.get(d.id) : undefined;
    const h = d ? this.handles.get(d.id) : undefined;
    if (!row?.drag || !h) return;
    if (row.drag.translate && row.drag.baseTranslate && row.drag.anchorStart) {
      const tx = row.drag.baseTranslate[0] + (row.drag.pos[0] - row.drag.anchorStart[0]);
      const ty = row.drag.baseTranslate[1] + (row.drag.pos[1] - row.drag.anchorStart[1]);
      h.tip.textContent = `Shift [${formatCoord(tx)}, ${formatCoord(ty)}]`;
      return;
    }
    const name = row.drag.name ? `${row.drag.name} ` : "";
    h.tip.textContent = `${name}(${row.drag.pos.map(formatCoord).join(", ")})`;
  }

  private placeDrag(row: RowEntry, pos: Vec3) {
    const d = row.drag;
    if (!d) return;
    d.pos = [...pos];
    const label = row.labels[0];
    if (label) {
      label.pos = [pos[0], pos[1], pos[2]];
      if (label.auto) label.text = `${d.name ? `${d.name} ` : ""}(${pos.map(formatCoord).join(", ")})`;
      this.labelsDirty = true;
    }
  }

  /**
   * While a point is pointed at or dragged: a line down to the floor, and from there to
   * the x- and y-axes, so its three coordinates can be read off the axes.
   */
  private buildGuides() {
    disposeGroup(this.guideGroup);
    this.guideGroup.clear();
    const id = this.drag?.id ?? this.activeId;
    const row = id ? this.rows.get(id) : undefined;
    if (!row?.drag) return;
    const [x, y, z] = row.drag.pos;
    const { cx, cy, cz, half } = this.domain;
    // The floor is the plane the grid and the x- and y-axes lie in.
    const floor = clamp(0, cz - half, cz + half);
    const ax = clamp(0, cx - half, cx + half);
    const ay = clamp(0, cy - half, cy + half);
    const segments = [
      [x, y, z, x, y, floor],
      [x, y, floor, x, ay, floor],
      [x, y, floor, ax, y, floor],
    ].filter((s) => Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2]) > 1e-9);
    const color = toColor(row.color);
    if (segments.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments.flat(), 3));
      const lines = new THREE.LineSegments(
        geometry,
        new THREE.LineDashedMaterial({
          color,
          dashSize: 0.045 * half,
          gapSize: 0.03 * half,
          transparent: true,
          opacity: 0.9,
          depthTest: false,
        }),
      );
      lines.computeLineDistances();
      lines.renderOrder = 5;
      this.guideGroup.add(lines);
    }
    // Where it stands on the floor, and where that meets each axis.
    const marks = [
      [x, y, floor],
      [x, ay, floor],
      [ax, y, floor],
    ];
    const markGeometry = new THREE.BufferGeometry();
    markGeometry.setAttribute("position", new THREE.Float32BufferAttribute(marks.flat(), 3));
    const dots = new THREE.Points(
      markGeometry,
      new THREE.PointsMaterial({
        color,
        size: 7,
        sizeAttenuation: false,
        map: this.disc,
        alphaTest: 0.5,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    dots.renderOrder = 5;
    this.guideGroup.add(dots);
    this.guideGroup.traverse((o) => {
      o.frustumCulled = false;
    });
  }

  // ── Transform gizmo (rows switched to "Transformable") ──
  //
  // The same transform as the flat graph (translate, rotate and scale about a pivot, in
  // the plane), with handles to match: a yellow ring to turn, a green square to resize,
  // a blue pivot. In space it also gets red, green and blue arrows that move the shape
  // along x, y and z: the last is a height shift only the 3D view uses.

  /** Handles for every transformable row; made and removed as rows change. */
  private syncGizmos() {
    disposeGroup(this.gizmoGroup);
    this.gizmoGroup.clear();
    const live = new Set<string>();
    for (const row of this.rows.values()) {
      const g = row.gizmo;
      if (!g) continue;
      const kinds: GizmoKind[] = ["center", "x", "y", "z"];
      if (g.rotatable) kinds.push("rotate");
      if (g.resizable) kinds.push("scale");
      for (const kind of kinds) {
        const key = `${row.id}:${kind}`;
        live.add(key);
        let el = this.gizmoEls.get(key);
        if (!el) {
          el = this.makeGizmoHandle(row.id, kind);
          this.gizmoEls.set(key, el);
        }
        const color = GIZMO_COLORS[kind] ?? (g.pivot ? "#3b82f6" : `#${toColor(row.color).getHexString()}`);
        el.style.setProperty("--c", color);
        const dot = el.firstElementChild as HTMLElement;
        dot.title = GIZMO_TITLES[kind === "center" ? (g.pivot ? "pivot" : "move") : kind];
      }
      this.buildGizmoScene(row, g);
    }
    for (const [key, el] of this.gizmoEls) {
      if (live.has(key)) continue;
      el.remove();
      this.gizmoEls.delete(key);
    }
    if (this.gz && !this.rows.get(this.gz.id)?.gizmo) this.endGizmoDrag();
  }

  /** Where a gizmo's handles are, in graph units. */
  private gizmoSpots(g: GizmoFrame): Record<GizmoKind, Vec3> {
    const c: Vec3 = [g.px + g.tx, g.py + g.ty, g.cz];
    const L = g.radius * 0.85;
    const turn = g.rot + g.base;
    const cosT = Math.cos(turn);
    const sinT = Math.sin(turn);
    // A point of the shape's own (PCA) frame, as the transform places it. The resize
    // handle keeps some distance from the middle, so a tiny shape can still be grabbed
    // (its maths reads the real scale, so it only stops moving inwards).
    const MIN = 0.25;
    const place = (u: number, v: number): Vec3 => {
      const x = u * Math.max(Math.abs(g.sx), MIN);
      const y = v * Math.max(Math.abs(g.sy), MIN);
      return [c[0] + x * cosT - y * sinT, c[1] + x * sinT + y * cosT, c[2]];
    };
    const a = (g.radius * 1.2) / Math.SQRT2;
    return {
      center: c,
      x: [c[0] + L, c[1], c[2]],
      y: [c[0], c[1] + L, c[2]],
      z: [c[0], c[1], c[2] + L],
      // Turning only reads the angle: the ring keeps its size whatever the scale.
      rotate: [c[0] + g.radius * cosT, c[1] + g.radius * sinT, c[2]],
      scale: place(a, -a),
    };
  }

  /** The ring, the arrows and the line to the resize handle. */
  private buildGizmoScene(row: RowEntry, g: GizmoFrame) {
    const spots = this.gizmoSpots(g);
    const [cx, cy, cz] = spots.center;
    const over = (m: THREE.Material) => {
      m.depthTest = false;
      m.transparent = true;
      return m;
    };
    const lines = (pts: number[], color: string, opacity: number, dashed = false) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const material = dashed
        ? new THREE.LineDashedMaterial({ color, opacity, dashSize: 0.03 * this.domain.half, gapSize: 0.025 * this.domain.half })
        : new THREE.LineBasicMaterial({ color, opacity });
      const obj = new THREE.LineSegments(geometry, over(material));
      if (dashed) obj.computeLineDistances();
      obj.renderOrder = 6;
      this.gizmoGroup.add(obj);
    };
    const active = this.gz?.id === row.id ? this.gz.kind : null;

    if (g.rotatable) {
      // The ring the turn handle runs round, through the handle itself.
      const r = Math.hypot(spots.rotate[0] - cx, spots.rotate[1] - cy);
      const ring: number[] = [];
      const n = 96;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TWO_PI;
        const a1 = ((i + 1) / n) * TWO_PI;
        ring.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), cz, cx + r * Math.cos(a1), cy + r * Math.sin(a1), cz);
      }
      lines(ring, GIZMO_COLORS.rotate!, active === "rotate" ? 0.95 : 0.55);
      if (active === "rotate") {
        // The angle turned so far, from where the shape started.
        const start = this.gz!.start.rot + g.base;
        const end = g.rot + g.base;
        const fan: number[] = [];
        const steps = Math.max(2, Math.ceil(Math.abs(end - start) / 0.05));
        for (let i = 0; i < steps; i++) {
          const a0 = start + ((end - start) * i) / steps;
          const a1 = start + ((end - start) * (i + 1)) / steps;
          fan.push(cx, cy, cz, cx + r * Math.cos(a0), cy + r * Math.sin(a0), cz);
          fan.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), cz, cx + r * Math.cos(a1), cy + r * Math.sin(a1), cz);
        }
        lines(fan, GIZMO_COLORS.rotate!, 0.35);
      }
    }
    if (g.resizable) lines([cx, cy, cz, ...spots.scale], GIZMO_COLORS.scale!, 0.6, true);

    // Arrows along the axes, with heads.
    (["x", "y", "z"] as const).forEach((kind, axis) => {
      const tip = spots[kind];
      const color = AXIS_COLORS[axis];
      lines([cx, cy, cz, ...tip], color, active === kind ? 1 : 0.75);
      const dir = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.025 * this.domain.half, 0.07 * this.domain.half, 12),
        over(new THREE.MeshBasicMaterial({ color, opacity: 0.9 })),
      );
      head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      head.position.set(tip[0], tip[1], tip[2]).addScaledVector(dir, 0.035 * this.domain.half);
      head.renderOrder = 6;
      this.gizmoGroup.add(head);
    });
    this.gizmoGroup.traverse((o) => {
      o.frustumCulled = false;
    });
  }

  private makeGizmoHandle(id: string, kind: GizmoKind): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.className = `g3d-handle g3d-gz g3d-gz-${kind}`;
    wrap.dataset.captureExclude = "";
    const dot = document.createElement("div");
    dot.className = "g3d-dot";
    dot.tabIndex = -1;
    wrap.appendChild(dot);
    this.handleHost.appendChild(wrap);
    dot.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dot.setPointerCapture(e.pointerId);
      this.beginGizmoDrag(id, kind, e);
    });
    dot.addEventListener("pointermove", (e) => {
      if (this.gz?.id !== id || this.gz.kind !== kind) return;
      e.preventDefault();
      e.stopPropagation();
      this.stepGizmoDrag(e.clientX, e.clientY, e.shiftKey, e.altKey);
    });
    const end = (e: PointerEvent) => {
      if (this.gz?.id !== id || this.gz.kind !== kind) return;
      e.stopPropagation();
      try {
        dot.releasePointerCapture(e.pointerId);
      } catch {}
      this.endGizmoDrag();
    };
    dot.addEventListener("pointerup", end);
    dot.addEventListener("pointercancel", end);
    dot.addEventListener("wheel", (e) => this.renderer.domElement.dispatchEvent(new WheelEvent(e.type, e)), { passive: true });
    return wrap;
  }

  /** Each frame: every gizmo handle over its spot, and the readout by the one being dragged. */
  private placeGizmos() {
    if (this.gizmoEls.size === 0) {
      this.gizmoTip.style.display = "none";
      return;
    }
    const at = { x: 0, y: 0 };
    const spots = new Map<string, Record<GizmoKind, Vec3>>();
    for (const [key, el] of this.gizmoEls) {
      const i = key.lastIndexOf(":");
      const id = key.slice(0, i);
      const kind = key.slice(i + 1) as GizmoKind;
      const g = this.rows.get(id)?.gizmo;
      if (!g) {
        el.style.display = "none";
        continue;
      }
      let s = spots.get(id);
      if (!s) spots.set(id, (s = this.gizmoSpots(g)));
      const p = s[kind];
      if (!this.toScreen(p[0], p[1], p[2], at)) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "";
      el.style.translate = `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px`;
      el.classList.toggle("dragging", this.gz?.id === id && this.gz.kind === kind);
      // While one handle is held, the others step back.
      el.style.opacity = this.gz && !(this.gz.id === id && this.gz.kind === kind) ? "0.35" : "";
    }
    const gz = this.gz;
    const g = gz ? this.rows.get(gz.id)?.gizmo : undefined;
    if (gz && g) {
      const c = this.gizmoSpots(g).center;
      if (this.toScreen(c[0], c[1], c[2], at)) {
        this.gizmoTip.style.display = "block";
        this.gizmoTip.style.translate = `${at.x.toFixed(1)}px ${(at.y + 34).toFixed(1)}px`;
        this.gizmoTip.style.setProperty("--c", GIZMO_COLORS[gz.kind] ?? "#3b82f6");
        this.gizmoTip.textContent = this.gizmoReadout(gz.kind, g);
        return;
      }
    }
    this.gizmoTip.style.display = "none";
  }

  private gizmoReadout(kind: GizmoKind, g: GizmoFrame): string {
    const f = (v: number) => formatCoord(v);
    if (kind === "rotate") {
      let deg = (g.rot * 180) / Math.PI;
      deg = ((((deg + 180) % 360) + 360) % 360) - 180;
      return `Turn ${Math.round(deg)}°`;
    }
    if (kind === "scale") {
      return Math.abs(g.sx - g.sy) < 1e-3 ? `Scale ${g.sx.toFixed(2)}×` : `Scale ${g.sx.toFixed(2)} × ${g.sy.toFixed(2)}  (Shift: keep shape)`;
    }
    if (kind === "center" && g.pivot) return `Pivot (${f(g.px + g.tx)}, ${f(g.py + g.ty)})`;
    return `Shift (${f(g.tx)}, ${f(g.ty)}, ${f(g.tz)})`;
  }

  /** The pointer's ray in graph units: [origin, unit direction]. */
  private localRay(clientX: number, clientY: number): [THREE.Vector3, THREE.Vector3] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const o = this.content.worldToLocal(this.raycaster.ray.origin.clone());
    const d = this.content.worldToLocal(this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction)).sub(o).normalize();
    return [o, d];
  }

  /** Where the pointer meets the horizontal plane at height z; null when the plane is seen edge-on. */
  private hitHeight(clientX: number, clientY: number, z: number): THREE.Vector3 | null {
    const [o, d] = this.localRay(clientX, clientY);
    if (Math.abs(d.z) < 0.03) return null;
    const t = (z - o.z) / d.z;
    if (t <= 0) return null;
    const p = o.addScaledVector(d, t);
    // Far off in a near-flat view: no sensible answer.
    const r = 6 * this.domain.half;
    if (Math.abs(p.x - this.domain.cx) > r || Math.abs(p.y - this.domain.cy) > r) return null;
    return p;
  }

  /** How far along the line through `origin` in direction `axis` the pointer is; null if looking along it. */
  private alongAxis(clientX: number, clientY: number, origin: Vec3, axis: 0 | 1 | 2): number | null {
    const [o, d] = this.localRay(clientX, clientY);
    const u = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
    const w = new THREE.Vector3(origin[0], origin[1], origin[2]).sub(o);
    const b = u.dot(d);
    const denom = 1 - b * b;
    if (denom < 1e-4) return null;
    return (b * d.dot(w) - u.dot(w)) / denom;
  }

  private beginGizmoDrag(id: string, kind: GizmoKind, e: PointerEvent) {
    const g = this.rows.get(id)?.gizmo;
    if (!g) return;
    this.tween = null;
    this.clearHover();
    const center = this.gizmoSpots(g).center;
    this.gz = {
      id,
      kind,
      start: { ...g },
      hit0: this.hitHeight(e.clientX, e.clientY, g.cz),
      along0: kind === "x" || kind === "y" || kind === "z" ? this.alongAxis(e.clientX, e.clientY, center, kind === "x" ? 0 : kind === "y" ? 1 : 2) : null,
    };
    // Heavy rows are redrawn coarsely while they move, then refined.
    this.coarse = true;
    window.clearTimeout(this.coarseTimer);
    this.controls.autoRotate = false;
    this.syncGizmos();
    this.requestRender();
  }

  private stepGizmoDrag(clientX: number, clientY: number, shift: boolean, alt: boolean) {
    const gz = this.gz;
    if (!gz) return;
    const s = gz.start;
    const half = this.domain.half;
    const snapStep = (niceStep(half) / 10) * (alt ? 0.1 : 1);
    const snap = (v: number) => Number((Math.round(v / snapStep) * snapStep).toFixed(6));
    const round = (v: number, places = 4) => Number(v.toFixed(places));
    let patch: Partial<MathFunction> | null = null;

    if (gz.kind === "x" || gz.kind === "y" || gz.kind === "z") {
      const axis = gz.kind === "x" ? 0 : gz.kind === "y" ? 1 : 2;
      const startCenter: Vec3 = [s.px + s.tx, s.py + s.ty, s.cz];
      const now = this.alongAxis(clientX, clientY, startCenter, axis);
      if (now === null || gz.along0 === null) return;
      const delta = now - gz.along0;
      if (axis === 2) patch = { transformTranslateZ: snap(s.tz + delta) };
      else patch = { transformTranslate: axis === 0 ? [snap(s.tx + delta), s.ty] : [s.tx, snap(s.ty + delta)] };
    } else {
      const hit = this.hitHeight(clientX, clientY, s.cz);
      if (!hit) return;
      const cx = s.px + s.tx;
      const cy = s.py + s.ty;
      if (gz.kind === "center" && !s.pivot) {
        if (!gz.hit0) return;
        patch = { transformTranslate: [snap(s.tx + hit.x - gz.hit0.x), snap(s.ty + hit.y - gz.hit0.y)] };
      } else if (gz.kind === "center") {
        // Move the pivot, keeping the shape where it is (as on the flat graph).
        const px = snap(hit.x);
        const py = snap(hit.y);
        const dx = px - cx;
        const dy = py - cy;
        const inv = -(s.rot + s.base);
        let vx = dx * Math.cos(inv) - dy * Math.sin(inv);
        let vy = dx * Math.sin(inv) + dy * Math.cos(inv);
        vx /= s.sx || 1;
        vy /= s.sy || 1;
        const lx = vx * Math.cos(s.base) - vy * Math.sin(s.base);
        const ly = vx * Math.sin(s.base) + vy * Math.cos(s.base);
        const pNew: [number, number] = [round(s.px + lx), round(s.py + ly)];
        patch = { transformPivot: pNew, transformTranslate: [round(px - pNew[0]), round(py - pNew[1])] };
      } else if (gz.kind === "rotate") {
        let rot = Math.atan2(hit.y - cy, hit.x - cx) - s.base;
        const unit = ((shift ? 15 : 1) * Math.PI) / 180;
        rot = Math.round(rot / unit) * unit;
        patch = { transformRotate: round(rot, 6) };
      } else if (gz.kind === "scale") {
        const a = (s.radius * 1.2) / Math.SQRT2;
        const dx = hit.x - cx;
        const dy = hit.y - cy;
        let sx: number;
        let sy: number;
        if (shift) {
          const k = Math.max(0.05, Math.hypot(dx, dy) / Math.hypot(a * s.sx, a * s.sy) );
          sx = s.sx * k;
          sy = s.sy * k;
        } else {
          // Into the shape's own frame: the handle sits at (a, -a) there, times the scale.
          const t = -(s.rot + s.base);
          const u = dx * Math.cos(t) - dy * Math.sin(t);
          const v = dx * Math.sin(t) + dy * Math.cos(t);
          sx = Math.max(0.05, u / a);
          sy = Math.max(0.05, -v / a);
        }
        patch = { transformScale: [round(sx, 3), round(sy, 3)] };
      }
    }
    if (!patch) return;
    const p = this.getProps();
    (p.onTransformRow ?? p.onPatchRow)?.(gz.id, patch);
    this.requestRender();
  }

  private endGizmoDrag() {
    if (!this.gz) return;
    this.gz = null;
    this.controls.autoRotate = this.opts.autoRotate;
    // Now at rest: draw everything at full quality again.
    this.coarse = false;
    this.syncGizmos();
    this.sync();
  }

  /** Marks the labels a surface hides, so they are drawn faintly. */
  private computeOcclusion = () => {
    if (this.disposed || this.labelsDirty || this.labelEls.length !== this.labelSpecs.length) return;
    const surfaces: THREE.Object3D[] = [];
    let triangles = 0;
    this.rowsGroup.traverse((o: any) => {
      if (!o.userData.surface) return;
      surfaces.push(o);
      triangles += (o.geometry.index?.count ?? 0) / 3;
    });
    // Too much to test without a pause the user would notice: leave the labels be.
    const affordable = triangles * this.labelSpecs.length < 6e6;
    const eye = this.camera.position;
    const direction = new THREE.Vector3();
    this.labelSpecs.forEach((spec, i) => {
      let hidden = false;
      if (surfaces.length > 0 && affordable) {
        const [x, y, z] = spec.pos;
        direction.set(x, y, z).applyMatrix4(this.content.matrixWorld).sub(eye);
        const distance = direction.length();
        this.occluder.set(eye, direction.divideScalar(distance));
        this.occluder.far = distance - 0.04;
        hidden = this.occluder.intersectObjects(surfaces, false).some((h) => this.inBox(h.point));
      }
      if (hidden !== !!spec.dim) {
        spec.dim = hidden;
        this.labelEls[i].style.opacity = hidden ? "0.2" : "";
      }
    });
    // A point behind a surface is drawn faintly too; it can still be dragged.
    for (const [id, h] of this.handles) {
      if (h.wrap.dataset.faded) continue;
      const pos = this.rows.get(id)?.drag?.pos;
      let hidden = false;
      if (pos && surfaces.length > 0 && affordable && this.drag?.id !== id) {
        direction.set(pos[0], pos[1], pos[2]).applyMatrix4(this.content.matrixWorld).sub(eye);
        const distance = direction.length();
        this.occluder.set(eye, direction.divideScalar(distance));
        this.occluder.far = distance - 0.04;
        hidden = this.occluder.intersectObjects(surfaces, false).some((hit) => this.inBox(hit.point));
      }
      h.wrap.style.opacity = hidden ? "0.45" : "";
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.coarseTimer);
    window.clearTimeout(this.fineTimer);
    window.clearTimeout(this.occlusionTimer);
    this.hoverDot.remove();
    this.hoverTip.remove();
    this.pinnedEl.remove();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("wheel", this.onWheel);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.controls.dispose();
    disposeGroup(this.scene);
    this.disc.dispose();
    this.renderer.dispose();
    canvas.remove();
    this.labelEls.forEach((el) => el.remove());
    this.handles.forEach((h) => h.wrap.remove());
    this.handles.clear();
    this.gizmoEls.forEach((el) => el.remove());
    this.gizmoEls.clear();
    this.gizmoTip.remove();
    this.axisHandles.forEach((h) => h.wrap.remove());
    this.axisHandles = [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const BUTTON =
  "size-8 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";
const CHIP =
  "flex-1 px-1.5 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors";
const CHIP_ON = "flex-1 px-1.5 py-1 rounded-md text-[11px] font-semibold text-white bg-blue-600 transition-colors";
const HEADING = "px-1 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

/** Rows that show what the third axis is for. */
const EXAMPLES: { name: string; expr: string; patch?: Partial<MathFunction> }[] = [
  { name: "Paraboloid", expr: "z = (x^2 + y^2)/4 - 3" },
  { name: "Saddle", expr: "z = (x^2 - y^2)/5" },
  { name: "Ripples", expr: "z = 2*sin(sqrt(x^2 + y^2))" },
  { name: "Sphere", expr: "x^2 + y^2 + z^2 = 16" },
  { name: "Torus", expr: "[(3 + cos(v))*cos(u), (3 + cos(v))*sin(u), sin(v)]" },
  { name: "Helix", expr: "[3cos(t), 3sin(t), t/2 - 3]", patch: { tRange: [0, 4 * Math.PI] } },
];

const VIEWS: { id: ViewName; label: string; title: string }[] = [
  { id: "home", label: "3D", title: "The starting view" },
  { id: "top", label: "Top", title: "From above: the flat graph, x across and y up" },
  { id: "front", label: "Front", title: "From the front: x across and z up" },
  { id: "side", label: "Side", title: "From the side: y across and z up" },
];

const Switch: React.FC<{ label: string; title: string; on: boolean; onChange: (on: boolean) => void }> = ({
  label,
  title,
  on,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    title={title}
    onClick={() => onChange(!on)}
    className="flex items-center justify-between gap-3 w-full px-1 py-1.5 rounded-md text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
  >
    <span>{label}</span>
    <span className={`relative w-7 h-4 shrink-0 rounded-full transition-colors ${on ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}`}>
      <i className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-all ${on ? "left-3.5" : "left-0.5"}`} />
    </span>
  </button>
);

const Graph3D: React.FC<Graph3DProps> = (props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [failed, setFailed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [domain, setDomain] = useState<Domain | null>(null);

  const optionsKey = JSON.stringify(props.options ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => readOptions(props.options), [optionsKey]);
  const setOptions = (patch: Partial<Graph3DOptions>) => props.onOptionsChange?.({ ...options, ...patch });

  useEffect(() => {
    let engine: Engine;
    try {
      engine = new Engine(hostRef.current!, labelRef.current!, handleRef.current!, () => propsRef.current);
    } catch (e) {
      console.error("3D graph could not start", e);
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    engine.onDomain = setDomain;
    // The graph's screenshot button asks the 3D view for its own picture.
    (rootRef.current as any).__capture3d = (scale: number) => engine.capture(scale);
    setDomain(engine.getDomain());
    // Pointing at a row in the list fades the others here, as it does on the flat graph.
    const root = rootRef.current!;
    const onRowHover = (e: Event) => engine.highlight((e as CustomEvent).detail ?? null);
    root.addEventListener("math-row-hover", onRowHover);
    return () => {
      root.removeEventListener("math-row-hover", onRowHover);
      delete (root as any).__capture3d;
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

  useEffect(() => {
    engineRef.current?.setOptions(options);
  }, [options]);

  // Every render may carry new rows, slider values or time. The engine compares each
  // row's key and rebuilds only what changed, once per frame.
  useEffect(() => {
    engineRef.current?.sync();
  });

  const slice = options.slice;
  const sliceValue = slice && domain ? [domain.cx, domain.cy, domain.cz][slice.axis] + slice.at * domain.half : 0;

  return (
    <div
      ref={rootRef}
      data-graph-3d
      className="absolute inset-0 nodrag nopan nowheel cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={labelRef}
        className="absolute inset-0 overflow-hidden pointer-events-none select-none font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300"
      />
      {/* Draggable points: above the labels, and taking the pointer from the view. */}
      <div ref={handleRef} className="absolute inset-0 overflow-hidden pointer-events-none select-none font-mono" />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-500 dark:text-slate-400">
          The 3D view needs WebGL, which this browser or device has turned off. Switch back to 2D to keep working.
        </div>
      )}

      {/* What the colours mean, when surfaces are coloured by height. */}
      {!failed && options.colorMode === "height" && domain && (
        <div
          data-capture-exclude
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 font-mono text-[10px] text-slate-600 dark:text-slate-300"
        >
          <span>{formatCoord(domain.cz + domain.half)}</span>
          <span
            className="w-2.5 h-24 rounded-full ring-1 ring-black/10 dark:ring-white/15"
            style={{ background: `linear-gradient(to top, ${HEIGHT_STOPS.join(", ")})` }}
          />
          <span>{formatCoord(domain.cz - domain.half)}</span>
          <span className="font-sans font-semibold text-blue-500">z</span>
        </div>
      )}

      {!props.compact && !failed && (
        <>
          <div
            data-capture-exclude
            className="hidden md:block absolute bottom-3 left-3 z-30 pointer-events-none px-2 py-1 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400"
          >
            Drag to turn · scroll to zoom · right-drag to move · drag a point, or its ↕ grip for height
          </div>

          {/* Phones: top left, under the graph toolbar (the Inspector sits bottom right there). */}
          <div
            data-capture-exclude
            className="absolute top-14 left-2 md:top-auto md:left-auto md:bottom-3 md:right-3 z-30 cursor-default"
          >
            <div className="flex flex-col overflow-hidden rounded-lg bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/5 dark:shadow-black/30">
              <button
                type="button"
                className={`${BUTTON} ${panelOpen ? "bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-600 dark:text-white" : ""}`}
                title="3D view options"
                aria-label="3D view options"
                aria-expanded={panelOpen}
                onClick={() => setPanelOpen((v) => !v)}
              >
                <SlidersHorizontal size={14} />
              </button>
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

            {panelOpen && (
              <div className="absolute left-full top-0 ml-2 md:left-auto md:top-auto md:right-full md:bottom-0 md:ml-0 md:mr-2 w-56 max-h-[min(26rem,70vh)] overflow-y-auto no-scrollbar p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-xl shadow-slate-900/10 dark:shadow-black/40">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">3D view</span>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setPanelOpen(false)}
                    className="size-6 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className={HEADING}>Look from</div>
                <div className="flex gap-1">
                  {VIEWS.map((v) => (
                    <button key={v.id} type="button" title={v.title} className={CHIP} onClick={() => (v.id === "home" ? engineRef.current?.resetView() : engineRef.current?.flyTo(v.id))}>
                      {v.label}
                    </button>
                  ))}
                </div>

                <div className={HEADING}>Surfaces</div>
                <Switch
                  label="Colour by height"
                  title="Colour surfaces from low (blue) to high (red) instead of in their row's colour"
                  on={options.colorMode === "height"}
                  onChange={(on) => setOptions({ colorMode: on ? "height" : "row" })}
                />
                <Switch
                  label="Contour lines"
                  title="Draw level curves on surfaces, and their shadows on the floor of the box"
                  on={options.contours}
                  onChange={(on) => setOptions({ contours: on })}
                />
                <Switch
                  label="Tangent plane"
                  title="Show the tangent plane and normal where the pointer touches a surface"
                  on={options.tangent}
                  onChange={(on) => setOptions({ tangent: on })}
                />
                <Switch
                  label="Auto-rotate"
                  title="Turn the graph slowly"
                  on={options.autoRotate}
                  onChange={(on) => setOptions({ autoRotate: on })}
                />

                <div className={HEADING}>Slice</div>
                <div className="flex gap-1" role="radiogroup" aria-label="Slice plane">
                  <button type="button" role="radio" aria-checked={!slice} className={!slice ? CHIP_ON : CHIP} onClick={() => setOptions({ slice: null })}>
                    Off
                  </button>
                  {([0, 1, 2] as const).map((axis) => (
                    <button
                      key={axis}
                      type="button"
                      role="radio"
                      aria-checked={slice?.axis === axis}
                      title={`Cut every surface with a plane ${AXIS_NAMES[axis]} = constant`}
                      className={slice?.axis === axis ? CHIP_ON : CHIP}
                      onClick={() => setOptions({ slice: { axis, at: slice?.at ?? 0 } })}
                    >
                      {AXIS_NAMES[axis]}
                    </button>
                  ))}
                </div>
                {slice && domain && (() => {
                  const color = AXIS_COLORS[slice.axis];
                  const centre = [domain.cx, domain.cy, domain.cz][slice.axis];
                  const fill = ((slice.at + 1) / 2) * 100;
                  return (
                    <div className="flex flex-col gap-1.5 px-1 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
                          {AXIS_NAMES[slice.axis]} = {formatCoord(sliceValue)}
                        </span>
                        {slice.at !== 0 && (
                          <button
                            type="button"
                            onClick={() => setOptions({ slice: { axis: slice.axis, at: 0 } })}
                            title="Back to the middle of the box"
                            className="text-[10px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            Centre
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-right font-mono text-[10px] text-slate-500 select-none tabular-nums">
                          {formatCoord(centre - domain.half)}
                        </span>
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={slice.at}
                          onChange={(e) => setOptions({ slice: { axis: slice.axis, at: Number(e.target.value) } })}
                          aria-label="Slice position"
                          className="flex-1 min-w-0 h-1.5 rounded-lg appearance-none cursor-pointer transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[currentColor] [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-125 active:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[currentColor] [&::-moz-range-thumb]:shadow-sm hover:[&::-moz-range-thumb]:scale-125 active:[&::-moz-range-thumb]:scale-110 [&::-moz-range-thumb]:transition-transform"
                          style={{
                            color,
                            accentColor: color,
                            // The part up to the thumb in the axis colour.
                            background: `linear-gradient(to right, ${color}99 ${fill}%, ${props.dark ? "#334155" : "#e2e8f0"} ${fill}%)`,
                          }}
                        />
                        <span className="w-7 font-mono text-[10px] text-slate-500 select-none tabular-nums">
                          {formatCoord(centre + domain.half)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {props.onAddExample && (
                  <>
                    <div className={HEADING}>Add an example</div>
                    <div className="grid grid-cols-2 gap-1">
                      {EXAMPLES.map((ex) => (
                        <button key={ex.name} type="button" title={ex.expr} className={CHIP} onClick={() => props.onAddExample?.(ex.expr, ex.patch)}>
                          {ex.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Graph3D;
