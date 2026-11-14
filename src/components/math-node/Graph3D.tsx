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
import { computePCA, parseAndAdjustForCompile } from "./mathHelpers";
import { pointDraggable, type PointMenuTarget } from "./PointMenu";
import { DRAW_TOOL_CLICKS, type DrawPick, type DrawSolid, type DrawToolKind, type SolidMode } from "./DrawTool";
import type { Motion } from "./selection";
import { dependencyKey } from "./dependencyKeys";
import { objectId } from "./SmoothCurve";
import { getFamilyCurveColor } from "./familyPlot";
import { DEGREE_TRIG, isDefinitionRow, isTailTipVector, odeRange, odeSolveKey, rowInDegrees } from "./scope";
import { evaluateFamilyValues, parseFamilyExpression } from "../../lib/math/familyPlot";
import { splitRelation } from "../../lib/math/splitRelation";
import { clipSegmentToBox, clipToBox } from "../../lib/math/clip3d";
import { surfaceAreaOf } from "../../lib/math/geometryHelpers";
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
  /** The drawing tool in hand (as on the flat graph), or none. */
  drawTool?: DrawToolKind | null;
  /** Height of the level plane drawing clicks land on. */
  drawHeight?: number;
  onDrawHeight?: (h: number) => void;
  /** Which plane clicks land on, by the axis it is square to: 2 XY (level), 1 XZ, 0 YZ. */
  drawPlane?: 0 | 1 | 2;
  onDrawPlane?: (plane: 0 | 1 | 2) => void;
  /** Named points to snap to, where they are in space. */
  drawPoints?: { name: string; x: number; y: number; z: number }[];
  drawColor?: string;
  /** What a drawn polygon or circle becomes: flat, or a solid. */
  drawSolid?: SolidMode;
  /** All the clicks for one shape are in (each with its height), and its solid's top if any. */
  onDrawComplete?: (tool: DrawToolKind, picks: DrawPick[], solid?: DrawSolid) => void;
  /** Escape with nothing pending: put the tool down. */
  onDrawExit?: () => void;
  /** The Select tool is in hand: a click picks the shape under it (a drag still turns the view). */
  selectTool?: boolean;
  /** What is selected, and how it may be moved. */
  selection?: Selection3D | null;
  /**
   * What was picked: one row by a click, none by a click on empty space. `add` (Shift)
   * adds to or takes from what's selected. `middle` is the middle of what shows of the
   * row, for one that needs a point to turn about.
   */
  onSelect?: (fnIds: string[], middle: [number, number] | null, add: boolean) => void;
  /** A handle of a selection built on points was dragged a step. */
  onSelectionMotion?: (motion: Motion) => void;
  /** Which axes the turning handles turn about (all three when left out). */
  rotateAxes?: RotateAxes;
}

/** What the Select tool has hold of in the 3D view. */
export interface Selection3D {
  rowIds: string[];
  /**
   * The centre of the points the selection is built on: its handles stand here, and it
   * turns and resizes about it. Null for rows with no points behind them: one such row
   * shows its own transform gizmo, several can only be deleted.
   */
  centre: [number, number, number] | null;
  /** Its points can be given a height (see canLiftPoints). */
  canLift: boolean;
  canRotate: boolean;
  canResize: boolean;
  /** It can be turned about the x- and y-axes (see canTiltInSpace). */
  canTilt?: boolean;
}

/** The gizmo of a selection built on points (no row has this id). */
const SELECTION_ID = "__selection__";
const SELECT_COLOR = "#3b82f6";
const SELECT_HANDLE_ANGLE = (5 * Math.PI) / 4;
/** How far round the z ring its handle sits from the shape's own direction. */
const Z_HANDLE_OFFSET = Math.PI / 4;
/** The free-turn handle's place on screen, from the middle of the gizmo (pixels). */
const FREE_HANDLE_PX = { x: -64, y: -64 };
/** Where the x and y rings' handles rest, round their rings. */
const REST_TILT = (-3 * Math.PI) / 4;
/** Kinds of row whose drawing follows the in-plane transform (move, turn, resize across the floor). */
const PLANAR_KINDS = new Set(["function", "parametric", "polar", "point3", "geometry", "ode", "surface", "surface-rhs", "surface-uv", "iso", "curve2d", "region2d"]);

/** "rotate" turns about z (the yellow ring), rotX and rotY about x and y, "free" about any of them. */
type GizmoKind = "center" | "x" | "y" | "z" | "rotate" | "rotX" | "rotY" | "free" | "scale";

/** Which axes the turning handles turn about (the X, Y, Z switches). */
export interface RotateAxes {
  x: boolean;
  y: boolean;
  z: boolean;
}
const ALL_AXES: RotateAxes = { x: true, y: true, z: true };

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
  /** It can be moved, turned and resized across the floor (not every kind of row can). */
  planar: boolean;
  /** It can be moved up and down. */
  liftable: boolean;
  /** It can be turned about the x- and y-axes too. */
  tiltable: boolean;
  /** Its turn about x and y now (radians). */
  rx: number;
  ry: number;
}

/** The two axes that run along each drawing plane (by the axis it is square to). */
const PLANE_AXES: Record<0 | 1 | 2, [number, number]> = { 2: [0, 1], 1: [0, 2], 0: [1, 2] };

/** A finished base, waiting for its solid's top. */
interface SolidBase {
  tool: DrawToolKind;
  picks: DrawPick[];
  pts: Vec3[];
  centre: Vec3;
  /** Unit normal: which way "up" is for this base. */
  normal: Vec3;
  /** A circle's radius (across its plane). */
  radius?: number;
  plane: 0 | 1 | 2;
}

const SOLID_NAMES = { polygon: ["Prism", "Pyramid"], circle: ["Cylinder", "Cone"] } as const;

const DRAW_PLANES: { plane: 0 | 1 | 2; label: string; title: string }[] = [
  { plane: 2, label: "XY", title: "Level plane: z stays the same" },
  { plane: 1, label: "XZ", title: "Upright plane facing the front: y stays the same" },
  { plane: 0, label: "YZ", title: "Upright plane facing the side: x stays the same" },
];

/** The handles a gizmo has: only what its row (or selection) can do. */
const gizmoKinds = (g: GizmoFrame, axes: RotateAxes = ALL_AXES): GizmoKind[] => {
  const kinds: GizmoKind[] = [];
  if (g.planar) kinds.push("center", "x", "y");
  if (g.liftable) kinds.push("z");
  const turns = g.planar && g.rotatable;
  const about = [turns && g.tiltable && axes.x, turns && g.tiltable && axes.y, turns && axes.z];
  if (about[2]) kinds.push("rotate");
  if (about[0]) kinds.push("rotX");
  if (about[1]) kinds.push("rotY");
  // Free turning needs two axes or more to mean anything a ring can't do.
  if (about.filter(Boolean).length >= 2) kinds.push("free");
  if (g.planar && g.resizable) kinds.push("scale");
  return kinds;
};

const GIZMO_COLORS: Partial<Record<GizmoKind, string>> = {
  x: "#ef4444",
  y: "#22c55e",
  z: "#3b82f6",
  rotate: "#3b82f6",
  rotX: "#ef4444",
  rotY: "#22c55e",
  free: "#a855f7",
  scale: "#10b981",
};

/** The word by each handle while it is pointed at. */
const GIZMO_LABELS: Record<GizmoKind | "pivot" | "move", string> = {
  center: "Move",
  move: "Move",
  pivot: "Move the pivot",
  x: "Move along x",
  y: "Move along y",
  z: "Move up or down (z)",
  rotate: "Turn about z",
  rotX: "Turn about x",
  rotY: "Turn about y",
  free: "Turn freely",
  scale: "Resize",
};

/** What each handle shows: an arrow to move, a curved arrow to turn, and so on (lucide shapes). */
const GIZMO_ICONS: Record<GizmoKind, string> = {
  center: '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
  x: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  y: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  z: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  rotX: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  rotY: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  free: '<path d="M16.47 7.5C15.64 4.24 13.95 2 12 2 9.24 2 7 6.48 7 12s2.24 10 5 10c.34 0 .68-.07 1-.2"/><path d="m15.19 13.71 3.82 1.86-1.86 3.81"/><path d="M19 15.57c-1.8.89-4.27 1.43-7 1.43-5.52 0-10-2.24-10-5s4.48-5 10-5c4.84 0 8.87 1.72 9.8 4"/>',
  scale: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
};

const GIZMO_TITLES: Record<GizmoKind | "pivot" | "move", string> = {
  center: "",
  move: "Drag to move it across the floor",
  pivot: "Drag to move the pivot it turns and scales about",
  x: "Drag along x",
  y: "Drag along y",
  z: "Drag up or down (z)",
  rotate: "Drag round to turn it about z (Shift: steps of 15°)",
  rotX: "Drag round to turn it about x (Shift: steps of 15°)",
  rotY: "Drag round to turn it about y (Shift: steps of 15°)",
  free: "Drag to turn it freely, about the axes switched on",
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
  /** The x, y and z axes, with their numbers, names and spin handles. */
  showAxes: boolean;
  /** The grid on the floor of the box. */
  showGrid: boolean;
  /** The outline of the box. */
  showBox: boolean;
  /** The curves where surfaces meet (and the line where two planes meet). */
  intersections: boolean;
  /** A parallel (orthographic) view: no perspective, so parallel lines stay parallel. */
  ortho: boolean;
  /** The dashed box drawn round what the Select tool has selected. */
  selectionBox: boolean;
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
    // Shown unless switched off (older saves have none of these).
    showAxes: o?.showAxes !== false,
    showGrid: o?.showGrid !== false,
    showBox: o?.showBox !== false,
    intersections: o?.intersections !== false,
    ortho: !!o?.ortho,
    selectionBox: o?.selectionBox !== false,
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
.g3d-gz{z-index:4}
.g3d-gz-center{z-index:5}
.g3d-gz .g3d-dot{left:-18px;top:-18px;width:36px;height:36px;display:flex;align-items:center;justify-content:center}
.g3d-gz .g3d-dot::before,.g3d-gz .g3d-dot::after{content:none}
.g3d-gzf{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#fff;color:var(--c);border:2.5px solid var(--c);box-shadow:0 2px 6px rgba(0,0,0,.45);transition:transform .14s ease,box-shadow .14s ease;pointer-events:none;box-sizing:border-box}
.g3d-gzf svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.g3d-gz-x .g3d-gzf,.g3d-gz-y .g3d-gzf,.g3d-gz-z .g3d-gzf{width:22px;height:22px;background:var(--c);color:#fff;border:2px solid #fff}
.g3d-gz-x .g3d-gzf svg,.g3d-gz-y .g3d-gzf svg,.g3d-gz-z .g3d-gzf svg{transform:rotate(var(--a,0deg))}
.g3d-gz-center .g3d-gzf{width:26px;height:26px;background:#0f172a;color:#fff;border:2.5px solid var(--c)}
.g3d-gz-scale .g3d-gzf{border-radius:7px;width:22px;height:22px}
.g3d-gz:hover .g3d-gzf,.g3d-gz.dragging .g3d-gzf{transform:scale(1.18);box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 32%,transparent),0 2px 8px rgba(0,0,0,.5)}
.g3d-gzl{position:absolute;left:18px;top:-32px;padding:3px 8px;border-radius:7px;font-size:11px;font-weight:600;white-space:nowrap;text-shadow:none;background:var(--g3d-tip);color:var(--g3d-fg);border:1.5px solid var(--c);box-shadow:0 3px 10px rgba(0,0,0,.3);pointer-events:none;opacity:0;transform:translateY(3px);transition:opacity .12s ease .2s,transform .12s ease .2s}
.g3d-gz:hover .g3d-gzl{opacity:1;transform:none}
.g3d-gz.dragging .g3d-gzl{opacity:0;transition:none}
.g3d-drawing .g3d-dot,.g3d-drawing .g3d-grip,.g3d-drawing .g3d-stem{pointer-events:none}
.g3d-gz-center .g3d-dot{cursor:move}
.g3d-gz-x .g3d-dot,.g3d-gz-y .g3d-dot{cursor:grab}
.g3d-gz-z .g3d-dot{cursor:ns-resize}
.g3d-gz-x .g3d-dot::after,.g3d-gz-y .g3d-dot::after,.g3d-gz-z .g3d-dot::after{inset:12.5px}
.g3d-gz-scale .g3d-dot{cursor:nwse-resize}
.g3d-gz-scale .g3d-dot::after{border-radius:3px}
.g3d-gz-rotate .g3d-dot,.g3d-gz-rotX .g3d-dot,.g3d-gz-rotY .g3d-dot{cursor:grab}
.g3d-gz-free .g3d-dot{cursor:move}
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
  /**
   * Which side of the row's surface a point is on (0 on it), when the row can say:
   * z = f(x, y) and F(x, y, z) = 0. Used to find where surfaces meet.
   */
  implicit?: (x: number, y: number, z: number) => number;
  /** Drawn as one flat plane: another surface's finer mesh finds where they meet. */
  flat?: boolean;
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
  /** Its gizmo was set up by the Select tool: shown only while the row is selected. */
  gizmoOnSelect?: boolean;
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
const HEAVY_KINDS = new Set(["surface", "surface-rhs", "surface-uv", "iso", "curve2d", "region2d", "field", "revolve", "volume", "spherical", "cylindrical"]);

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

/** How many cells across the grid an implicit surface is found on, at each tier. */
function isoCellsFor(tier: number, quality: number | undefined): number {
  const q = clamp(quality || 14, 1, 30);
  return Math.min(64, Math.round(clamp(q * 2.6, 14, 52) * [0.6, 1, 1.3][tier]));
}

/** Saves a file the graph made (a model, a video) to the user's downloads. */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The curves where surfaces meet: bright, to stand out on any surface colour. */
const CROSS_COLOR = "#facc15";

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

/** The top-level arguments of `name(…)`, the whole of a row's expression (after any `F = `). */
function callArgs(expr: string, name: string): string[] | null {
  const body = expr.replace(/^\s*[A-Za-z_]\w*\s*=(?!=)\s*/, "").trim();
  if (!body.startsWith(name)) return null;
  const open = body.indexOf("(", name.length);
  if (open < 0 || body.slice(name.length, open).trim() !== "" || !body.endsWith(")")) return null;
  const inner = body.slice(open + 1, -1);
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      out.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(inner.slice(start).trim());
  return out.filter((a) => a.length > 0);
}

const compiledParts = new Map<string, { evaluate: (scope: any) => any } | null>();
/** A piece of a row's expression, compiled once. */
function compileCached(expr: string): { evaluate: (scope: any) => any } | null {
  if (compiledParts.has(expr)) return compiledParts.get(expr)!;
  let out: { evaluate: (scope: any) => any } | null = null;
  try {
    out = parseAndAdjustForCompile(expr).compile();
  } catch {
    out = null;
  }
  if (compiledParts.size > 400) compiledParts.clear();
  compiledParts.set(expr, out);
  return out;
}

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
  /** Where surfaces meet (see buildIntersections). */
  private crossGroup = new THREE.Group();
  private crossDirty = false;
  /** The orthographic view is on (see applyOrtho). */
  private ortho = false;
  /** Implicit surfaces being sampled between frames, and the grids done. */
  private isoJobs = new Map<
    string,
    { id: string; key: string; n: number; k: number; values: Float32Array; value: () => number; s: any; axf: AffineTransform2 | null; dom: Domain }
  >();
  private isoValues = new Map<string, { key: string; n: number; values: Float32Array }>();
  /** Rows (by their drawing key) that turned out to be planes: drawn exactly, no grid needed. */
  private flatKeys = new Set<string>();
  private isoTimer = 0;
  /** A spin being recorded (see recordSpin), and what to do after each frame meanwhile. */
  private spin: { t0: number; seconds: number; target: THREE.Vector3; start: THREE.Vector3; progress: (f: number) => void; done: () => void } | null = null;
  private afterFrame: (() => void) | null = null;
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
  /** Whether the pinned notes are open; null until toggled: open on a wide graph, folded on a narrow one. */
  private notesOpen: boolean | null = null;
  private hoverTip = document.createElement("div");
  private tangentGroup = new THREE.Group();
  private tangentPlane: THREE.Mesh;
  private tangentArrow: THREE.ArrowHelper;
  private drag: DragState | null = null;
  // Drawing tools
  private drawTool: DrawToolKind | null = null;
  private drawPicks: DrawPick[] = [];
  private drawHover: DrawPick | null = null;
  private drawHeight = 0;
  private drawPlane: 0 | 1 | 2 = 2;
  private drawSolid: SolidMode = "flat";
  private solidBase: SolidBase | null = null;
  private solidTip: DrawPick | null = null;
  /** The height (along the base's normal) the top was last set to, for slanting. */
  private solidH = 0;
  private drawGroup = new THREE.Group();
  private drawTip = document.createElement("div");
  private drawDown: { x: number; y: number } | null = null;
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
    /** A selection's drag: how far it has been taken so far (each step reports the rest). */
    applied: {
      move: Vec3;
      angle: number;
      rawAngle: number;
      lastAngle: number | null;
      factor: number;
      dist0: number | null;
      /** Where the pointer was last, in screen pixels. */
      last: { x: number; y: number };
      /** A typed row's turn when the drag began, and the free turn made since. */
      q0: THREE.Quaternion;
      qFree: THREE.Quaternion;
      freeAngle: number;
    };
    /** The height a selection is resized and turned about. */
    centreZ: number;
  } | null = null;
  private rotateAxes: RotateAxes = { ...ALL_AXES };
  /** The gizmo handle pointed at ("id:kind"): its ring or arrow is drawn brighter. */
  private gzHover: string | null = null;
  // Select tool
  private selectTool = false;
  private selection: Selection3D | null = null;
  private selKey = "";
  private selDown: { x: number; y: number } | null = null;
  /** How far the selection has been turned since it was picked: where its turn handle sits. */
  private selTurn = 0;
  /** The resize under way (1 at rest): where its resize handle sits. */
  private selScale = 1;
  private selFrame: GizmoFrame | null = null;
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
    // Taking hold of the view (turn, pan, scroll to zoom) stops auto-rotate.
    this.controls.addEventListener("start", this.stopAutoRotate);

    // A headlight, so a surface is lit from wherever it is looked at.
    const light = new THREE.DirectionalLight(0xffffff, 1.7);
    light.position.set(0.6, 0.8, 1);
    this.camera.add(light);
    this.scene.add(this.camera, new THREE.AmbientLight(0xffffff, 2), this.content);
    this.content.add(this.decor, this.rowsGroup, this.crossGroup, this.sliceGroup, this.guideGroup, this.gizmoGroup, this.drawGroup);

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
    // A card, so they read over whatever is behind them; it takes the pointer (to fold).
    this.pinnedEl.style.cssText =
      "position:absolute;top:58px;right:34px;display:none;flex-direction:column;align-items:flex-end;text-align:right;line-height:1.25;pointer-events:auto;border-radius:12px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:default";
    this.gizmoTip.className = "g3d-gz-tip";
    this.gizmoTip.dataset.captureExclude = "";
    this.handleHost.appendChild(this.gizmoTip);
    this.drawTip.className = "g3d-gz-tip";
    this.drawTip.dataset.captureExclude = "";
    this.handleHost.appendChild(this.drawTip);
    window.addEventListener("keydown", this.onDrawKey);
    // The pointer's readout isn't part of the graph: left out of screenshots.
    this.hoverDot.dataset.captureExclude = "";
    this.hoverTip.dataset.captureExclude = "";
    labelHost.append(this.hoverDot, this.hoverTip, this.pinnedEl);
    this.pinnedEl.dataset.pinnedNotes = "1";
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
    this.buildDrawPreview();
    this.onDomain?.({ ...this.domain });
    this.sync();
  }

  getDomain(): Domain {
    return { ...this.domain };
  }

  setOptions(options: Graph3DOptions) {
    const decorChanged =
      options.showAxes !== this.opts.showAxes || options.showGrid !== this.opts.showGrid || options.showBox !== this.opts.showBox;
    if (options.intersections !== this.opts.intersections) this.crossDirty = true;
    if (options.ortho !== this.ortho) {
      this.ortho = options.ortho;
      if (!this.ortho) this.camera.updateProjectionMatrix();
      this.labelsDirty = true;
    }
    const boxChanged = options.selectionBox !== this.opts.selectionBox;
    this.opts = options;
    if (boxChanged) this.syncGizmos();
    if (decorChanged) this.buildDecor();
    this.controls.autoRotate = options.autoRotate;
    this.sliceDirty = true;
    if (!options.tangent) this.tangentGroup.visible = false;
    this.sync();
  }

  /**
   * The notes pinned to the corner, as a card. On a narrow graph (a phone) it starts
   * folded to its first line, so it doesn't cover the picture; a tap opens the rest.
   */
  private buildPinnedNotes(pinned: LabelSpec[]) {
    const card = this.pinnedEl;
    if (!pinned.length) {
      card.style.display = "none";
      card.replaceChildren();
      return;
    }
    const narrow = this.width < 640;
    const open = this.notesOpen ?? !narrow;
    const size = narrow ? 0.8 : 1;
    card.style.display = "flex";
    card.style.top = narrow ? "52px" : "58px";
    card.style.right = narrow ? "8px" : "34px";
    card.style.maxWidth = narrow ? "calc(100% - 72px)" : "min(62%, 27rem)";
    card.style.gap = narrow ? "4px" : "6px";
    card.style.padding = narrow ? "6px 9px" : "8px 12px";
    card.style.background = this.dark ? "rgba(2, 6, 23, 0.72)" : "rgba(255, 255, 255, 0.82)";
    card.style.border = `1px solid ${this.dark ? "rgba(51, 65, 85, 0.7)" : "rgba(203, 213, 225, 0.9)"}`;
    card.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.18)";

    const line = (spec: LabelSpec) => {
      const el = document.createElement("div");
      if (spec.html) el.innerHTML = spec.html;
      else el.textContent = spec.text;
      el.style.color = spec.color || "";
      el.style.fontSize = `${Math.round(14 * size * (spec.scale ?? 1))}px`;
      return el;
    };
    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:flex-end;gap:8px;max-width:100%";
    const title = line(pinned[0]);
    title.style.minWidth = "0";
    head.append(title);
    if (pinned.length > 1) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.dataset.captureExclude = "";
      toggle.textContent = open ? "Hide" : `+${pinned.length - 1} more`;
      toggle.title = open ? "Fold the notes away" : "Show all the notes";
      toggle.style.cssText = `flex-shrink:0;font:600 ${narrow ? 10 : 11}px system-ui,sans-serif;padding:2px 7px;border-radius:999px;border:1px solid currentColor;opacity:.75;cursor:pointer;background:transparent;color:${this.dark ? "#cbd5e1" : "#475569"};text-shadow:none`;
      toggle.addEventListener("pointerdown", (e) => e.stopPropagation());
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        this.notesOpen = !open;
        this.labelsDirty = true;
        this.requestRender();
      });
      // The fold button sits first, at the far side from the text's right edge.
      head.prepend(toggle);
    }
    const rest = open ? pinned.slice(1).map(line) : [];
    card.replaceChildren(head, ...rest);
    // Typeset maths can't wrap: a line too long for the card is drawn just small enough to fit.
    const room = (narrow ? this.width - 72 : Math.min(this.width * 0.62, 432)) - (narrow ? 18 : 24);
    const fit = (el: HTMLElement, avail: number) => {
      const w = el.scrollWidth;
      if (w <= avail || w === 0) return;
      const px = parseFloat(el.style.fontSize) || 14;
      el.style.fontSize = `${Math.max(8, Math.floor(px * (avail / w) * 10) / 10)}px`;
    };
    const toggleWidth = head.firstElementChild !== title ? (head.firstElementChild as HTMLElement).offsetWidth + 8 : 0;
    fit(title, room - toggleWidth);
    for (const el of rest) fit(el, room);
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
      this.drawGroup.visible = false;
      this.applyOrtho();
      this.renderer.render(this.scene, this.camera);
      ctx.drawImage(this.renderer.domElement, 0, 0, out.width, out.height);
    } finally {
      this.gizmoGroup.visible = true;
      this.drawGroup.visible = true;
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
  private async drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, s: number, notesOnly = false) {
    const css = await overlayCss();
    const wrap = document.createElement("div");
    wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrap.style.cssText = `position:relative;width:${w}px;height:${h}px;overflow:hidden;margin:0`;
    const style = document.createElement("style");
    style.textContent = css;
    wrap.appendChild(style);
    for (const host of notesOnly ? [this.labelHost] : [this.labelHost, this.handleHost]) {
      const cs = getComputedStyle(host);
      const clone = host.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[data-capture-exclude]").forEach((n) => n.remove());
      if (notesOnly) {
        for (const c of [...clone.children]) if (!(c as HTMLElement).dataset?.pinnedNotes) c.remove();
      }
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
  private drawOverlayText(ctx: CanvasRenderingContext2D, s: number, withNotes = true) {
    const box = this.labelHost.getBoundingClientRect();
    const els = [...this.labelEls, ...(withNotes ? Array.from(this.pinnedEl.children) : [])] as HTMLElement[];
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
    if ((width < 640) !== (this.width < 640)) this.labelsDirty = true;
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
    this.applyOrtho();
    this.requestRender();
  }

  setTheme(dark: boolean) {
    if (dark === this.dark) return;
    this.dark = dark;
    this.applyTheme();
    this.buildDecor();
    // Surface mesh lines are tinted for the theme; the notes card too.
    this.labelsDirty = true;
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

  /**
   * The user has taken hold of the graph: auto-rotate stops, and stays off (its switch
   * in the options shows it) until they turn it on again.
   */
  private stopAutoRotate = () => {
    if (!this.opts.autoRotate) return;
    this.opts = { ...this.opts, autoRotate: false };
    this.controls.autoRotate = false;
    this.getProps().onOptionsChange?.(this.opts);
  };

  private onPointerDown = (e: PointerEvent) => {
    this.tween = null; // taking hold of the view stops a glide
    this.stopAutoRotate();
    this.setPointer(e);
    // With a drawing tool, a click (not a drag, which still turns the view) places a point.
    if (this.drawTool) {
      this.drawDown = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
      return;
    }
    if (this.selectTool) this.selDown = e.button === 0 && e.isPrimary ? { x: e.clientX, y: e.clientY } : null;
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
    if (this.drawTool) {
      if (e.pointerType === "mouse" && e.buttons === 0) {
        if (this.solidBase) this.solidTip = this.solidTipAt(e.clientX, e.clientY, e.shiftKey);
        else this.drawHover = this.drawSnap(e.clientX, e.clientY);
        this.buildDrawPreview();
        this.requestRender();
      }
      return;
    }
    if (e.pointerType !== "mouse") return;
    if (e.buttons === 0) {
      this.hoverDirty = true;
      this.requestRender();
    } else if (this.hover) this.clearHover();
  };

  private onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse") this.clearHover();
    if (this.drawHover) {
      this.drawHover = null;
      this.buildDrawPreview();
      this.requestRender();
    }
  };

  // ── Point menu: right-click a point, or double-tap it, as on the 2D graph ──

  private tapDown: { x: number; y: number } | null = null;
  private lastTap: { t: number; x: number; y: number } | null = null;

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (this.drawTool) return;
    this.openMenuFromCanvas(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.drawTool) {
      const from = this.drawDown;
      this.drawDown = null;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) <= 8) {
        // A finger has no hover: show where it landed until the next tap.
        if (e.pointerType !== "mouse") this.drawHover = this.drawSnap(e.clientX, e.clientY);
        this.drawClick(e.clientX, e.clientY, e.shiftKey);
      }
      return;
    }
    if (this.selectTool) {
      // A click (not a drag, which turns the view) picks what is under it.
      const from = this.selDown;
      this.selDown = null;
      this.tapDown = null;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) <= (e.pointerType === "mouse" ? 5 : 10)) {
        this.selectClick(e.clientX, e.clientY, e.shiftKey);
      }
      return;
    }
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
    this.castRay();
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
    if (this.spin) this.stepSpin();
    else if (this.tween) this.stepTween();
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
      if (!this.drawTool) this.pick();
    }
    this.applyOrtho();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    this.afterFrame?.();
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
      this.buildPinnedNotes(pinned);
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

    const { showAxes, showGrid, showBox } = this.opts;

    // Grid on the horizontal plane the axes lie in.
    if (showGrid) {
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
    }

    // The box.
    if (showBox) {
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
    }

    // Axes, arrowheads, names and tick numbers.
    if (!showAxes) {
      this.decorLabels = labels;
      this.labelsDirty = true;
      this.requestRender();
      return;
    }
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
        f.transformRotateX,
        f.transformRotateY,
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
      let tier = !heavy ? 1 : moving ? 0 : same ? (this.fineReady ? 2 : Math.max(1, existing!.tier)) : 1;
      if (same && existing!.tier === tier) continue;
      // A fine implicit surface is sampled a slice at a time between frames; meanwhile
      // the one already drawn stays, or a coarse one is drawn straight away.
      if (kind === "iso" && tier >= 1 && !this.flatKeys.has(baseKey)) {
        const cells = isoCellsFor(tier, p.quality);
        if (!this.isoReady(f.id, baseKey, cells)) {
          this.queueIso(f, scope, baseKey, cells);
          if (same) continue;
          tier = 0;
        }
      }
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
      this.makeGizmoFrame(entry, f, kind);
      this.applyRowTilt(entry, f);
      entry.group.traverse((o) => {
        o.frustumCulled = false;
      });
      if (this.highlightId && this.highlightId !== f.id) dimGroup(entry.group, true);
      this.rowsGroup.add(entry.group);
      this.rows.set(f.id, entry);
      this.labelsDirty = true;
      this.sliceDirty = true;
      this.crossDirty = true;
      if (heavy && tier === 1) this.scheduleFine();
    }

    for (const id of [...this.rows.keys()]) if (!seen.has(id)) this.removeRow(id);
    for (const id of [...this.isoValues.keys()]) if (!seen.has(id)) this.isoValues.delete(id);
    for (const id of [...this.isoJobs.keys()]) if (!seen.has(id)) this.isoJobs.delete(id);

    // A row rebuilt from the graph's state mid-drag is a step behind the pointer.
    if (this.drag) {
      const row = this.rows.get(this.drag.id);
      // A slider-driven handle is wherever its sliders now put it.
      if (row?.drag?.solver) {
        this.drag.pos = [...row.drag.pos];
        this.updateTip();
      } else if (row?.drag) this.placeDrag(row, this.drag.pos);
    }
    if (this.crossDirty) this.buildIntersections();
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
  private makeGizmoFrame(entry: RowEntry, f: MathFunction, kind: string) {
    if (!f.isTransformable) return;
    // Set up by the Select tool: shown while selected, with every handle the row can use.
    const onSelect = !!f.handlesOnSelect;
    entry.gizmoOnSelect = onSelect;
    const planar = PLANAR_KINDS.has(kind);
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
      // The Select tool's middle handle moves the shape, not the point it turns about.
      pivot: !!f.isPivotEnabled && !onSelect,
      rotatable: onSelect || !!f.isRotatable,
      resizable: onSelect || !!f.isResizable,
      planar,
      liftable: true,
      tiltable: planar,
      rx: f.transformRotateX || 0,
      ry: f.transformRotateY || 0,
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
    this.crossDirty = true;
  }

  /** How a row is drawn in space; null if it isn't drawn at all. */
  private kindOf(f: MathFunction, scope: any, functions: MathFunction[]): string | null {
    if (f.type === "differential") return f.compiledOde ? "ode" : null;
    if (!f.compiled) return null;
    if (f.type === "point" || f.type === "vector" || f.type === "line" || f.type === "polygon") return "geometry";
    if (callArgs(f.expr, "field")) return "field";
    if (callArgs(f.expr, "revolve")) return "revolve";
    if (callArgs(f.expr, "volumeUnder")) return "volume";
    if (f.type === "polar") {
      const symbols = symbolsOf(f.expr);
      // ρ = f(θ, φ): spherical. r = f(θ, z): cylindrical. Otherwise a curve on the floor.
      if (/^\s*(rho|ρ)\s*=(?!=)/.test(f.expr) || ((symbols.has("phi") || symbols.has("φ")) && scope.phi === undefined)) return "spherical";
      if (symbols.has("z") && scope.z === undefined) return "cylindrical";
      return "polar";
    }
    if (f.type === "parametric") return f.type;

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
    const isoCells = isoCellsFor(tier, p.quality);
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
        {
          // Points tested where the row was before it was moved, turned or resized.
          const own = Object.create(s);
          entry.implicit = (gx, gy, z) => {
            const [x, y] = axf ? axf.inverse(gx, gy) : [gx, gy];
            own.x = x;
            own.y = y;
            try {
              return z - toReal(compiled.evaluate(own));
            } catch {
              return NaN;
            }
          };
        }
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

      case "field": {
        this.addVectorField(entry, f, s, tier);
        break;
      }

      case "revolve": {
        this.addRevolution(entry, f, s, surfaceCells);
        break;
      }

      case "volume": {
        this.addVolumeUnder(entry, f, s, surfaceCells);
        break;
      }

      case "spherical":
      case "cylindrical": {
        // ρ = f(θ, φ) on spheres round the origin, or r = f(θ, z) round the z-axis.
        const spherical = kind === "spherical";
        const out3: Vec3 = [0, 0, 0];
        const anchor = this.addSurface(
          group,
          (a, b, out) => {
            const angle = a * angleUnit;
            s.theta = s["θ"] = angle;
            s.t = angle;
            s.x = angle;
            if (spherical) {
              s.phi = s["φ"] = b * angleUnit;
            } else {
              s.z = b;
            }
            let rho = NaN;
            try {
              rho = toReal(f.compiled.evaluate(s));
            } catch {}
            if (!Number.isFinite(rho)) return false;
            if (spherical) {
              out3[0] = rho * Math.sin(b) * Math.cos(a);
              out3[1] = rho * Math.sin(b) * Math.sin(a);
              out3[2] = rho * Math.cos(b);
            } else {
              out3[0] = rho * Math.cos(a);
              out3[1] = rho * Math.sin(a);
              out3[2] = b;
            }
            out[0] = out3[0];
            out[1] = out3[1];
            out[2] = out3[2];
            return true;
          },
          [0, TWO_PI],
          spherical ? [0, Math.PI] : [cz - half, cz + half],
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
        const region = f.type === "inequality" ? f.operator || f.expr2 || "<" : undefined;
        const isoXf = this.affineTransformOf(f, () => [[0, 0]]);
        let implicit: ((x: number, y: number, z: number) => number) | undefined;
        {
          // Points tested where the row was before it was moved, turned or resized.
          const own = Object.create(s);
          const value = this.relation(f, own);
          implicit = (gx, gy, z) => {
            const [x, y] = isoXf ? isoXf.inverse(gx, gy) : [gx, gy];
            own.x = x;
            own.y = y;
            own.z = z;
            return value();
          };
        }
        // A plane (a·x + b·y + c·z = d, or one drawn through three points): exact and flat.
        const flat = !region && implicit ? this.affineOf(implicit) : null;
        let anchor: Vec3 | null;
        if (flat) {
          const { n, d } = flat;
          anchor = this.addFlatPlane(group, f, n, d);
          entry.implicit = (x, y, z) => n[0] * x + n[1] * y + n[2] * z + d;
          entry.flat = true;
          if (this.flatKeys.size > 500) this.flatKeys.clear();
          this.flatKeys.add(entry.baseKey);
        } else {
          anchor = this.addIsoSurface(group, f, s, isoCells, region);
          entry.implicit = implicit;
        }
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
      !!f.transformRotateX ||
      !!f.transformRotateY ||
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

  /**
   * g(x, y, z) as a·x + b·y + c·z + d, when it is one (to rounding) across the box:
   * a plane. Checked at the box's middle, along each axis, and at a few more places.
   */
  private affineOf(g: (x: number, y: number, z: number) => number): { n: Vec3; d: number } | null {
    const { cx, cy, cz, half } = this.domain;
    const g0 = g(cx, cy, cz);
    const gx = g(cx + half, cy, cz) - g0;
    const gy = g(cx, cy + half, cz) - g0;
    const gz = g(cx, cy, cz + half) - g0;
    if (!Number.isFinite(g0 + gx + gy + gz)) return null;
    const scale = Math.abs(gx) + Math.abs(gy) + Math.abs(gz);
    if (!(scale > 0)) return null;
    for (const [a, b, c] of [[0.7, -0.4, 0.3], [-0.9, 0.8, -0.6], [0.2, 0.9, 0.95], [-0.5, -0.75, -0.85]]) {
      const want = g0 + gx * a + gy * b + gz * c;
      const got = g(cx + a * half, cy + b * half, cz + c * half);
      if (!(Math.abs(got - want) <= 1e-7 * (scale + Math.abs(g0)))) return null;
    }
    const n: Vec3 = [gx / half, gy / half, gz / half];
    return { n, d: g0 - n[0] * cx - n[1] * cy - n[2] * cz };
  }

  /** The plane n·p + d = 0 where it crosses the box: one flat polygon, edged in the row's colour. */
  private addFlatPlane(group: THREE.Group, f: MathFunction, n: Vec3, d: number): Vec3 | null {
    const { cx, cy, cz, half } = this.domain;
    const lo = [cx - half, cy - half, cz - half];
    const hi = [cx + half, cy + half, cz + half];
    const pts: Vec3[] = [];
    const val = (p: number[]) => n[0] * p[0] + n[1] * p[1] + n[2] * p[2] + d;
    // Where it crosses each of the box's 12 edges.
    for (let axis = 0; axis < 3; axis++) {
      const [ua, va] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
      for (const bu of [lo[ua], hi[ua]]) {
        for (const bv of [lo[va], hi[va]]) {
          const p0 = [0, 0, 0];
          const p1 = [0, 0, 0];
          p0[axis] = lo[axis];
          p1[axis] = hi[axis];
          p0[ua] = p1[ua] = bu;
          p0[va] = p1[va] = bv;
          const v0 = val(p0);
          const v1 = val(p1);
          if ((v0 < 0) === (v1 < 0) && v0 !== 0) continue;
          const t = v0 === v1 ? 0 : v0 / (v0 - v1);
          if (t < 0 || t > 1) continue;
          pts.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t]);
        }
      }
    }
    if (pts.length < 3) return null;
    const mid: Vec3 = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length) as Vec3;
    // Round the middle, in order: by angle in the plane.
    const nv = new THREE.Vector3(...n).normalize();
    const e1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(nv.x) > 0.9) e1.set(0, 1, 0);
    e1.sub(nv.clone().multiplyScalar(e1.dot(nv))).normalize();
    const e2 = nv.clone().cross(e1);
    const angle = (p: Vec3) => {
      const q = new THREE.Vector3(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]);
      return Math.atan2(q.dot(e2), q.dot(e1));
    };
    pts.sort((a, b) => angle(a) - angle(b));
    // A fan of triangles, split finely enough for smooth shading and clean cuts.
    const rings = 8;
    const positions: number[] = [];
    const index: number[] = [];
    positions.push(...mid);
    for (let k = 1; k <= rings; k++) {
      for (const p of pts) {
        const s = k / rings;
        positions.push(mid[0] + (p[0] - mid[0]) * s, mid[1] + (p[1] - mid[1]) * s, mid[2] + (p[2] - mid[2]) * s);
      }
    }
    const m = pts.length;
    const at = (k: number, i: number) => (k === 0 ? 0 : 1 + (k - 1) * m + (i % m));
    for (let k = 0; k < rings; k++) {
      for (let i = 0; i < m; i++) {
        if (k === 0) index.push(at(0, 0), at(1, i), at(1, i + 1));
        else index.push(at(k, i), at(k + 1, i), at(k + 1, i + 1), at(k, i), at(k + 1, i + 1), at(k, i + 1));
      }
    }
    group.add(this.surfaceMesh(new Float32Array(positions), index, f));
    const edge = this.line([...pts.flat(), ...pts[0]], f.color, { ...f, outlineWidth: f.outlineWidth ?? 2.5 });
    if (edge) group.add(edge);
    return mid;
  }

  /** The surface where a relation in x, y and z holds (marching cubes). */
  private addIsoSurface(group: THREE.Group, f: MathFunction, s: any, n: number, region?: string): Vec3 | null {
    const { cx, cy, cz, half } = this.domain;
    const axf = this.affineTransformOf(f, () => [[0, 0]]);
    const size = n + 1;
    const stepSize = (2 * half) / n;
    const x0 = cx - half;
    const y0 = cy - half;
    const z0 = cz - half;
    // Sampled already between frames (see queueIso), or here and now.
    const ready = this.isoValues.get(f.id);
    let values: Float32Array;
    if (ready && this.building && ready.key === this.building.baseKey && ready.n === n) {
      values = ready.values;
    } else {
      const value = this.relation(f, s);
      values = new Float32Array(size * size * size);
      for (let k = 0; k < size; k++) this.sampleIsoSlice(values, k, n, value, s, axf, this.domain);
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
    if (index.length === 0 && !region) return null;
    if (index.length > 0) group.add(this.surfaceMesh(new Float32Array(positions), index, f));

    // An inequality fills the part of space where it holds: its boundary (above), and
    // where that part meets the walls of the box, shaded, so it reads as a solid.
    let capCount = 0;
    let capSum: Vec3 = [0, 0, 0];
    if (region) {
      const flip = region === ">" || region === ">=" ? -1 : 1;
      const caps: number[] = [];
      const inset = 2e-3 * half;
      const base = [x0, y0, z0];
      const g = [0, 0, 0];
      const corner: Vec3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const h = [0, 0, 0, 0];
      const poly: number[][] = [];
      for (let axis = 0; axis < 3; axis++) {
        const [ua, va] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
        for (const side of [0, n]) {
          const wall = base[axis] + side * stepSize + (side === 0 ? inset : -inset);
          for (let w = 0; w < n; w++) {
            for (let u = 0; u < n; u++) {
              let defined = true;
              for (let c = 0; c < 4; c++) {
                const cu = u + (c === 1 || c === 2 ? 1 : 0);
                const cw = w + (c >= 2 ? 1 : 0);
                g[axis] = side;
                g[ua] = cu;
                g[va] = cw;
                const v = values[at(g[0], g[1], g[2])];
                if (v !== v) defined = false;
                h[c] = flip * v;
                const p = corner[c];
                p[axis] = wall;
                p[ua] = base[ua] + cu * stepSize;
                p[va] = base[va] + cw * stepSize;
              }
              if (!defined) continue;
              // The part of this square where it holds (h ≤ 0), cut along h = 0.
              poly.length = 0;
              for (let c = 0; c < 4; c++) {
                const d = (c + 1) % 4;
                const inC = h[c] <= 0;
                if (inC) poly.push([corner[c][0], corner[c][1], corner[c][2]]);
                if (inC !== h[d] <= 0) {
                  const t = h[c] / (h[c] - h[d]);
                  poly.push([
                    corner[c][0] + (corner[d][0] - corner[c][0]) * t,
                    corner[c][1] + (corner[d][1] - corner[c][1]) * t,
                    corner[c][2] + (corner[d][2] - corner[c][2]) * t,
                  ]);
                }
              }
              for (let k = 1; k + 1 < poly.length; k++) caps.push(...poly[0], ...poly[k], ...poly[k + 1]);
              if (poly.length >= 3) {
                capCount++;
                capSum = [capSum[0] + poly[0][0], capSum[1] + poly[0][1], capSum[2] + poly[0][2]];
              }
            }
          }
        }
      }
      if (caps.length) {
        const capIndex = Array.from({ length: caps.length / 3 }, (_, i) => i);
        group.add(this.buildRegionMesh(new Float32Array(caps), capIndex, f, 0.3, "solid", false));
      }
      if (index.length === 0 && capCount === 0) return null;
      if (index.length === 0) return [capSum[0] / capCount, capSum[1] / capCount, capSum[2] / capCount];
    }
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

  /** The row under the pointer, and where on it: nearest first, what is clipped away left out. */
  private rowHit(): { best: { hit: THREE.Intersection; point: THREE.Vector3; rank: number }; row: RowEntry } | null {
    const targets: THREE.Object3D[] = [];
    this.rowsGroup.traverse((o: any) => {
      if (o.isMesh || o.isPoints) targets.push(o);
    });
    if (targets.length === 0) return null;
    this.castRay();
    this.raycaster.params.Points.threshold = 0.035;
    let hits: THREE.Intersection[];
    try {
      hits = this.raycaster.intersectObjects(targets, false);
    } catch {
      return null;
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
    if (!best) return null;

    let owner: THREE.Object3D | null = best.hit.object;
    while (owner && !owner.userData.rowId) owner = owner.parent;
    const row = owner ? this.rows.get(owner.userData.rowId) : undefined;
    return row ? { best, row } : null;
  }

  /** Finds what is under the pointer and shows its coordinates there. */
  private pick() {
    const found = this.rowHit();
    if (!found) return this.clearHover();
    const { best, row } = found;

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
    let pressed: { x: number; y: number } | null = null;
    const start = (e: PointerEvent, grip: boolean) => {
      if (e.button !== 0) return;
      tapDown = !grip && e.pointerType !== "mouse" ? { x: e.clientX, y: e.clientY } : null;
      pressed = grip ? null : { x: e.clientX, y: e.clientY };
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
      // With the Select tool, a click on a point (not a drag of it) selects it.
      const clicked = !!pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) <= 5;
      pressed = null;
      if (this.selectTool && e.type === "pointerup" && clicked) {
        this.getProps().onSelect?.([id], null, e.shiftKey);
        return;
      }
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
    this.placeDrawTip();
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
    this.stopAutoRotate();
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
      this.castRay();
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
      this.castRay();
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

  // ── Drawing tools ──
  //
  // The same tools as on the flat graph. A click lands on the drawing plane, a level
  // floor at the drawing height (Page Up / Page Down move it), or on a point already
  // in space, so shapes can join points at different heights.

  /** Picks up a drawing tool (or puts it down). */
  setDrawTool(tool: DrawToolKind | null) {
    if (tool === this.drawTool) return;
    this.drawTool = tool;
    this.drawPicks = [];
    this.drawHover = null;
    this.solidBase = null;
    this.solidTip = null;
    // While drawing, a click on a point's handle picks that point instead of dragging it.
    this.handleHost.classList.toggle("g3d-drawing", !!tool);
    if (tool) this.clearHover();
    this.buildDrawPreview();
    this.requestRender();
  }

  setDrawHeight(h: number) {
    if (h === this.drawHeight) return;
    this.drawHeight = h;
    if (this.drawHover && !this.drawHover.name) {
      const c = [this.drawHover.x, this.drawHover.y, this.drawHover.z ?? 0];
      c[this.drawPlane] = h;
      this.drawHover = { ...this.drawHover, x: c[0], y: c[1], z: c[2] };
    }
    this.buildDrawPreview();
    this.requestRender();
  }

  setDrawPlane(plane: 0 | 1 | 2) {
    if (plane === this.drawPlane) return;
    this.drawPlane = plane;
    this.drawHover = null;
    this.buildDrawPreview();
    this.requestRender();
  }

  /** The step Page Up / Page Down move the drawing plane by. */
  drawHeightStep(): number {
    return niceStep(this.domain.half) / 2;
  }

  /**
   * Where a click lands: a corner of this shape again, a point already on the graph,
   * a whole-number spot of the drawing plane, or just there (rounded to what a pixel is worth).
   */
  private drawSnap(clientX: number, clientY: number): DrawPick | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const at = { x: 0, y: 0 };
    const near = (x: number, y: number, z: number) => (this.toScreen(x, y, z, at) ? Math.hypot(at.x - mx, at.y - my) : Infinity);

    let best: DrawPick | null = null;
    let bestD = 14;
    this.drawPicks.forEach((p, i) => {
      const d = near(p.x, p.y, p.z ?? 0);
      if (d < bestD) {
        bestD = d;
        best = { name: p.name && !p.name.startsWith("#") ? p.name : `#${i}`, x: p.x, y: p.y, z: p.z };
      }
    });
    for (const p of this.getProps().drawPoints ?? []) {
      const d = near(p.x, p.y, p.z);
      if (d < bestD) {
        bestD = d;
        best = { name: p.name, x: p.x, y: p.y, z: p.z };
      }
    }
    if (best) return best;

    const axis = this.drawPlane;
    const h = this.drawHeight;
    const hit = this.hitPlane(clientX, clientY, axis, h);
    if (!hit) return null;
    const [ua, va] = PLANE_AXES[axis];
    const c = [hit.x, hit.y, hit.z];
    c[axis] = h;
    const half = this.domain.half;
    // Only on the plane's square inside the box: past its edge nothing would be drawn.
    const mid = [this.domain.cx, this.domain.cy, this.domain.cz];
    if (Math.abs(c[ua] - mid[ua]) > half * 1.0001 || Math.abs(c[va] - mid[va]) > half * 1.0001) return null;
    // Whole numbers on an ordinary view; the grid's own step when zoomed far out.
    const unit = half > 25 ? niceStep(half) : 1;
    const g = [...c];
    g[ua] = Math.round(c[ua] / unit) * unit;
    g[va] = Math.round(c[va] / unit) * unit;
    if (near(g[0], g[1], g[2]) < 10) return { x: g[0], y: g[1], z: g[2], plane: axis };
    const digits = clamp(2 - Math.floor(Math.log10(half)), 0, 4);
    const round = (v: number) => Number(v.toFixed(digits));
    c[ua] = round(c[ua]);
    c[va] = round(c[va]);
    return { x: c[0], y: c[1], z: c[2], plane: axis };
  }

  private drawClick(clientX: number, clientY: number, shift = false) {
    const base = this.solidBase;
    if (base) {
      const tip = this.solidTipAt(clientX, clientY, shift);
      if (!tip) return;
      const flat = Math.hypot(tip.x - base.centre[0], tip.y - base.centre[1], (tip.z ?? 0) - base.centre[2]) < 1e-9;
      if (flat) return; // no height: not a solid yet
      const kind = this.drawSolid === "apex" ? "apex" : "extrude";
      this.solidBase = null;
      this.solidTip = null;
      this.buildDrawPreview();
      this.requestRender();
      this.getProps().onDrawComplete?.(base.tool, base.picks, { kind, tip });
      return;
    }
    const tool = this.drawTool;
    const pick = tool ? this.drawSnap(clientX, clientY) : null;
    if (!tool || !pick) return;
    const prev = this.drawPicks;
    if (tool === "polygon") {
      // Back on the first corner: closed.
      const isFirst = pick.name === "#0" || (!!prev[0]?.name && pick.name === prev[0].name);
      if (prev.length >= 3 && isFirst) return this.finishDrawing(prev);
      // Another corner already in this shape: ignore.
      if (pick.name?.startsWith("#") || (pick.name && prev.some((p) => p.name === pick.name))) return;
      this.drawPicks = [...prev, pick];
    } else {
      // The same point twice makes nothing.
      const last = prev[prev.length - 1];
      if (last && Math.abs(last.x - pick.x) < 1e-9 && Math.abs(last.y - pick.y) < 1e-9 && Math.abs((last.z ?? 0) - (pick.z ?? 0)) < 1e-9) return;
      const next = [...prev, pick];
      if (next.length >= DRAW_TOOL_CLICKS[tool]) return this.finishDrawing(next);
      this.drawPicks = next;
    }
    this.buildDrawPreview();
    this.requestRender();
  }

  private finishDrawing(picks: DrawPick[]) {
    const tool = this.drawTool;
    // A base for a solid: now its top is set.
    // A sphere needs no top: done as soon as the circle is.
    if (tool === "circle" && this.drawSolid === "sphere" && picks.length === 2) {
      this.drawPicks = [];
      this.buildDrawPreview();
      this.requestRender();
      this.getProps().onDrawComplete?.(tool, picks, { kind: "sphere", tip: picks[0] });
      return;
    }
    // (A sphere is for circles: a polygon then stays flat.)
    if (tool && this.drawSolid !== "flat" && this.drawSolid !== "sphere" && (tool === "polygon" || tool === "circle")) {
      const base = this.solidBaseOf(tool, picks);
      if (base) {
        this.solidBase = base;
        this.solidTip = null;
        this.solidH = 0;
        this.drawPicks = [];
        this.drawHover = null;
        this.buildDrawPreview();
        this.requestRender();
        return;
      }
    }
    this.drawPicks = [];
    this.buildDrawPreview();
    this.requestRender();
    if (tool) this.getProps().onDrawComplete?.(tool, picks);
  }

  private onDrawKey = (e: KeyboardEvent) => {
    if (!this.drawTool) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (this.solidBase && (e.key === "Escape" || e.key === "Backspace")) {
      // Back out of the solid: the base is dropped.
      this.cancelSolid();
      return;
    }
    if (e.key === "Escape") {
      if (this.drawPicks.length) {
        this.drawPicks = [];
        this.buildDrawPreview();
        this.requestRender();
      } else this.getProps().onDrawExit?.();
    } else if (e.key === "Enter" && this.drawTool === "polygon" && this.drawPicks.length >= 3) {
      this.finishDrawing(this.drawPicks);
    } else if (e.key === "Backspace" && this.drawPicks.length) {
      this.drawPicks = this.drawPicks.slice(0, -1);
      this.buildDrawPreview();
      this.requestRender();
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const step = this.drawHeightStep();
      const next = Number((this.drawHeight + (e.key === "PageUp" ? step : -step)).toFixed(6));
      const { cx, cy, cz, half } = this.domain;
      const mid = [cx, cy, cz][this.drawPlane];
      this.getProps().onDrawHeight?.(clamp(next, mid - half, mid + half));
    }
  };

  /** The drawing plane, the clicks so far and the shape as it would be. */
  private buildDrawPreview() {
    disposeGroup(this.drawGroup);
    this.drawGroup.clear();
    const tool = this.drawTool;
    if (!tool) return;
    const { cx, cy, cz, half } = this.domain;
    const axis = this.drawPlane;
    const [ua, va] = PLANE_AXES[axis];
    const mid = [cx, cy, cz];
    const h = clamp(this.drawHeight, mid[axis] - half, mid[axis] + half);
    // A point of the drawing plane from its two coordinates along it.
    const onPlane = (a: number, b: number): number[] => {
      const p = [0, 0, 0];
      p[axis] = h;
      p[ua] = a;
      p[va] = b;
      return p;
    };
    const color = toColor(this.getProps().drawColor || "#3b82f6");
    const over = <M extends THREE.Material>(m: M, front = true): M => {
      m.transparent = true;
      if (front) m.depthTest = false;
      return m;
    };
    const add = (o: THREE.Object3D, order = 7) => {
      o.renderOrder = order;
      o.frustumCulled = false;
      this.drawGroup.add(o);
    };

    // The plane being drawn on: a faint tint with a border, and its grid.
    const [a0, a1] = [mid[ua] - half, mid[ua] + half];
    const [b0, b1] = [mid[va] - half, mid[va] + half];
    const corners = [
      [a0, b0],
      [a1, b0],
      [a1, b1],
      [a0, b1],
    ];
    const planeGeometry = new THREE.BufferGeometry();
    planeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(corners.flatMap(([a, b]) => onPlane(a, b)), 3));
    planeGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    add(new THREE.Mesh(planeGeometry, over(new THREE.MeshBasicMaterial({ color, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }), false)), 1);
    const grid: number[] = [];
    const step = niceStep(half);
    for (let k = Math.ceil(a0 / step); k * step <= a1 + 1e-9; k++) grid.push(...onPlane(k * step, b0), ...onPlane(k * step, b1));
    for (let k = Math.ceil(b0 / step); k * step <= b1 + 1e-9; k++) grid.push(...onPlane(a0, k * step), ...onPlane(a1, k * step));
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % 4];
      grid.push(...onPlane(x0, y0), ...onPlane(x1, y1));
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
    add(new THREE.LineSegments(gridGeometry, over(new THREE.LineBasicMaterial({ color, opacity: 0.25 }), false)), 1);

    if (this.solidBase) {
      this.solidPreview(add, color, half);
      const t = this.solidTip;
      if (t) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute([t.x, t.y, t.z ?? 0], 3));
        add(new THREE.Points(geometry, over(new THREE.PointsMaterial({ color, size: 12, sizeAttenuation: false, map: this.disc, alphaTest: 0.3 }))), 8);
      }
      return;
    }

    // A corner used again is that corner.
    const placed: Vec3[] = this.drawPicks.map((p) => {
      const i = p.name?.startsWith("#") ? Number(p.name.slice(1)) : -1;
      const q = i >= 0 ? this.drawPicks[i] : p;
      return [q.x, q.y, q.z ?? 0];
    });
    const hover: Vec3 | null = this.drawHover ? [this.drawHover.x, this.drawHover.y, this.drawHover.z ?? 0] : null;
    const pts = hover ? [...placed, hover] : placed;

    const dashed = (positions: number[], opacity = 0.85) => {
      if (positions.length < 6) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const line = new THREE.LineSegments(
        geometry,
        over(new THREE.LineDashedMaterial({ color, opacity, dashSize: 0.05 * half, gapSize: 0.035 * half })),
      );
      line.computeLineDistances();
      add(line);
    };
    const chain = (list: Vec3[]) => {
      const out: number[] = [];
      for (let i = 0; i + 1 < list.length; i++) out.push(...list[i], ...list[i + 1]);
      return out;
    };

    if (tool === "circle" && placed.length === 1 && hover) {
      // In the drawing plane, round the centre: as the circle will be drawn.
      const o = placed[0];
      const r = Math.hypot(hover[ua] - o[ua], hover[va] - o[va]);
      const around = (ang: number) => {
        const p = [o[0], o[1], o[2]];
        p[ua] += r * Math.cos(ang);
        p[va] += r * Math.sin(ang);
        return p;
      };
      const ring: number[] = [];
      for (let i = 0; i < 96; i++) ring.push(...around((i / 96) * TWO_PI), ...around(((i + 1) / 96) * TWO_PI));
      dashed(ring);
      if (this.drawSolid === "sphere") {
        // The sphere it will make: two more great circles, upright to the first.
        const normalAxis = axis;
        const great = (a: number, b: number) => {
          const out: number[] = [];
          const at = (ang: number) => {
            const p = [o[0], o[1], o[2]];
            p[a] += r * Math.cos(ang);
            p[b] += r * Math.sin(ang);
            return p;
          };
          for (let i = 0; i < 96; i++) out.push(...at((i / 96) * TWO_PI), ...at(((i + 1) / 96) * TWO_PI));
          return out;
        };
        dashed(great(ua, normalAxis), 0.55);
        dashed(great(va, normalAxis), 0.55);
      }
    } else if (tool === "line" && placed.length === 1 && hover) {
      const d = new THREE.Vector3(hover[0] - placed[0][0], hover[1] - placed[0][1], hover[2] - placed[0][2]);
      if (d.lengthSq() > 0) {
        d.setLength(4 * half);
        dashed([placed[0][0] - d.x, placed[0][1] - d.y, placed[0][2] - d.z, placed[0][0] + d.x, placed[0][1] + d.y, placed[0][2] + d.z], 0.7);
      }
    } else if (tool !== "point" && pts.length >= 2) {
      dashed(chain(pts));
      if (tool === "polygon" && placed.length >= 2 && hover) dashed([...hover, ...placed[0]], 0.35);
    }

    // Where each point stands over the floor, so its height reads at a glance.
    const floor = clamp(0, cz - half, cz + half);
    const drops: number[] = [];
    for (const p of pts) if (Math.abs(p[2] - floor) > 1e-9) drops.push(p[0], p[1], p[2], p[0], p[1], floor);
    if (drops.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(drops, 3));
      const line = new THREE.LineSegments(
        geometry,
        over(new THREE.LineDashedMaterial({ color, opacity: 0.5, dashSize: 0.03 * half, gapSize: 0.03 * half })),
      );
      line.computeLineDistances();
      add(line);
    }

    const dots = (list: Vec3[], size: number, opacity: number) => {
      if (!list.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(list.flat(), 3));
      add(
        new THREE.Points(
          geometry,
          over(new THREE.PointsMaterial({ color, size, sizeAttenuation: false, map: this.disc, alphaTest: 0.3, opacity })),
        ),
        8,
      );
    };
    dots(placed, 11, 1);
    if (hover) dots([hover], 11, 0.6);
  }

  // ── Solids: a drawn polygon or circle made into a prism, pyramid, cylinder or cone ──
  //
  // Once the base is finished, the pointer sets the top: straight up from the base
  // (along its normal), slanted with Shift, or onto any point already on the graph.
  // A click builds the solid; its top point stays draggable, so the slant can change.

  setDrawSolid(mode: SolidMode) {
    if (mode === this.drawSolid) return;
    this.drawSolid = mode;
    if (mode === "flat" && this.solidBase) this.cancelSolid();
  }

  private cancelSolid() {
    this.solidBase = null;
    this.solidTip = null;
    this.buildDrawPreview();
    this.requestRender();
  }

  /** Where a click of this shape is, a corner used again being that corner. */
  private pickPositions(picks: DrawPick[]): Vec3[] {
    return picks.map((p) => {
      const i = p.name?.startsWith("#") ? Number(p.name.slice(1)) : -1;
      const q = i >= 0 ? picks[i] : p;
      return [q.x, q.y, q.z ?? 0];
    });
  }

  /** The base of a solid, from a finished polygon or circle; null when it can't have one. */
  private solidBaseOf(tool: DrawToolKind, picks: DrawPick[]): SolidBase | null {
    const pts = this.pickPositions(picks);
    if (tool === "circle" && pts.length === 2) {
      const plane = picks[0].plane ?? picks[1].plane ?? this.drawPlane;
      const [ua, va] = PLANE_AXES[plane];
      const r = Math.hypot(pts[1][ua] - pts[0][ua], pts[1][va] - pts[0][va]);
      if (!(r > 0)) return null;
      const n: Vec3 = [0, 0, 0];
      n[plane] = 1;
      return { tool, picks, pts, centre: pts[0], normal: n, radius: r, plane };
    }
    if (tool === "polygon" && pts.length >= 3) {
      // Newell's method: the normal of a (possibly slightly bent) polygon.
      const n: Vec3 = [0, 0, 0];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        n[0] += (a[1] - b[1]) * (a[2] + b[2]);
        n[1] += (a[2] - b[2]) * (a[0] + b[0]);
        n[2] += (a[0] - b[0]) * (a[1] + b[1]);
      }
      const len = Math.hypot(n[0], n[1], n[2]);
      if (len < 1e-9) return null;
      // Pointing up (or towards +y, +x for an upright base), whichever way it was drawn.
      const k = Math.abs(n[2]) > 1e-6 * len ? 2 : Math.abs(n[1]) > 1e-6 * len ? 1 : 0;
      const sign = n[k] < 0 ? -1 : 1;
      const normal: Vec3 = [(sign * n[0]) / len, (sign * n[1]) / len, (sign * n[2]) / len];
      const centre: Vec3 = [0, 1, 2].map((i) => pts.reduce((s, p) => s + p[i], 0) / pts.length) as Vec3;
      return { tool, picks, pts, centre, normal, plane: picks.find((p) => p.plane !== undefined)?.plane ?? 2 };
    }
    return null;
  }

  /** How far along the line through `origin` in direction `dir` (unit) the pointer is. */
  private alongLine(clientX: number, clientY: number, origin: Vec3, dir: Vec3): number | null {
    const [o, d] = this.localRay(clientX, clientY);
    const u = new THREE.Vector3(dir[0], dir[1], dir[2]);
    const w = new THREE.Vector3(origin[0], origin[1], origin[2]).sub(o);
    const b = u.dot(d);
    const denom = 1 - b * b;
    if (denom < 1e-4) return null;
    return (b * d.dot(w) - u.dot(w)) / denom;
  }

  /** The top of the solid under the pointer: on a point, straight up, or slanted with Shift. */
  private solidTipAt(clientX: number, clientY: number, slant: boolean): DrawPick | null {
    const base = this.solidBase;
    if (!base) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const at = { x: 0, y: 0 };
    // A point already on the graph: the top goes exactly there.
    let best: DrawPick | null = null;
    let bestD = 14;
    for (const p of this.getProps().drawPoints ?? []) {
      if (!this.toScreen(p.x, p.y, p.z, at)) continue;
      const d = Math.hypot(at.x - mx, at.y - my);
      if (d < bestD) {
        bestD = d;
        best = { name: p.name, x: p.x, y: p.y, z: p.z };
      }
    }
    if (best) return best;

    const half = this.domain.half;
    const step = niceStep(half) / 4;
    const digits = clamp(2 - Math.floor(Math.log10(half)), 0, 4);
    const round = (v: number) => Number(v.toFixed(digits));
    const [c, n] = [base.centre, base.normal];
    if (!slant) {
      const s = this.alongLine(clientX, clientY, c, n);
      if (s === null) return null;
      this.solidH = clamp(Math.round(s / step) * step, -2 * half, 2 * half);
      const h = this.solidH;
      return { x: round(c[0] + n[0] * h), y: round(c[1] + n[1] * h), z: round(c[2] + n[2] * h) };
    }
    // Slanted: across the plane parallel to the base, at the height already set.
    const h = this.solidH;
    const p0 = new THREE.Vector3(c[0] + n[0] * h, c[1] + n[1] * h, c[2] + n[2] * h);
    const [o, d] = this.localRay(clientX, clientY);
    const nn = new THREE.Vector3(n[0], n[1], n[2]);
    const denom = nn.dot(d);
    if (Math.abs(denom) < 0.03) return null;
    const t = nn.dot(p0.clone().sub(o)) / denom;
    if (t <= 0) return null;
    const hit = o.addScaledVector(d, t);
    const snap = (v: number) => Math.round(v / step) * step;
    // Snap the slant along the plane's own axes when the base lies on a drawing plane.
    const [ua, va] = PLANE_AXES[base.plane];
    const k = Math.abs(n[base.plane]) > 0.999 ? base.plane : -1;
    const out = [hit.x, hit.y, hit.z];
    if (k >= 0) {
      out[ua] = snap(out[ua]);
      out[va] = snap(out[va]);
      out[k] = p0.getComponent(k);
    }
    return { x: round(out[0]), y: round(out[1]), z: round(out[2]) };
  }

  /** The solid as it would be, in dashed lines. */
  private solidPreview(add: (o: THREE.Object3D, order?: number) => void, color: THREE.Color, half: number) {
    const base = this.solidBase;
    if (!base) return;
    const tip = this.solidTip;
    const lines = (positions: number[], opacity: number, dashed: boolean) => {
      if (positions.length < 6) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const material = dashed
        ? new THREE.LineDashedMaterial({ color, opacity, dashSize: 0.05 * half, gapSize: 0.035 * half })
        : new THREE.LineBasicMaterial({ color, opacity });
      material.transparent = true;
      material.depthTest = false;
      const line = new THREE.LineSegments(geometry, material);
      if (dashed) line.computeLineDistances();
      add(line);
    };
    const T: Vec3 | null = tip ? [tip.x, tip.y, tip.z ?? 0] : null;
    const extrude = this.drawSolid === "extrude";
    const d: Vec3 | null = T ? [T[0] - base.centre[0], T[1] - base.centre[1], T[2] - base.centre[2]] : null;
    const shift = (p: Vec3): Vec3 => (d ? [p[0] + d[0], p[1] + d[1], p[2] + d[2]] : p);

    // The base's outline (a circle sampled round, or the polygon's corners).
    let ring: Vec3[];
    if (base.radius !== undefined) {
      const [ua, va] = PLANE_AXES[base.plane];
      ring = Array.from({ length: 72 }, (_, i) => {
        const a = (i / 72) * TWO_PI;
        const p: Vec3 = [...base.centre];
        p[ua] += base.radius! * Math.cos(a);
        p[va] += base.radius! * Math.sin(a);
        return p;
      });
    } else ring = base.pts;
    const loop = (list: Vec3[]) => list.flatMap((p, i) => [...p, ...list[(i + 1) % list.length]]);
    lines(loop(ring), 0.95, false);
    if (!T || !d) return;
    // Its axis, from the middle of the base to the top.
    lines([...base.centre, ...T], 0.6, true);
    const sides = base.radius !== undefined ? ring.filter((_, i) => i % 9 === 0) : ring;
    if (extrude) {
      lines(loop(ring.map(shift)), 0.9, true);
      lines(sides.flatMap((p) => [...p, ...shift(p)]), 0.75, true);
    } else {
      lines(sides.flatMap((p) => [...p, ...T]), 0.75, true);
    }
  }

  /** Readout for the top while it is being set. */
  private solidTipText(): string | null {
    const base = this.solidBase;
    const t = this.solidTip;
    if (!base || !t) return null;
    const n = base.normal;
    const d = [t.x - base.centre[0], t.y - base.centre[1], (t.z ?? 0) - base.centre[2]];
    const h = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
    const name = SOLID_NAMES[base.tool === "circle" ? "circle" : "polygon"][this.drawSolid === "extrude" ? 0 : 1];
    const at = t.name ? ` to ${t.name}` : "";
    return `${name}${at} · height ${formatCoord(h)} · Shift: slant · click to finish`;
  }

  /** The readout by the pointer while drawing. */
  private placeDrawTip() {
    const solidText = this.solidTipText();
    const p = this.drawTool ? (this.solidBase ? this.solidTip : this.drawHover) : null;
    const at = { x: 0, y: 0 };
    if (!p || !this.toScreen(p.x, p.y, p.z ?? 0, at)) {
      this.drawTip.style.display = "none";
      return;
    }
    this.drawTip.style.display = "block";
    this.drawTip.style.setProperty("--c", this.getProps().drawColor || "#3b82f6");
    this.drawTip.style.translate = `${at.x.toFixed(1)}px ${(at.y + 14).toFixed(1)}px`;
    const coords = `(${formatCoord(p.x)}, ${formatCoord(p.y)}, ${formatCoord(p.z ?? 0)})`;
    this.drawTip.textContent = solidText ?? (p.name && !p.name.startsWith("#") ? `${p.name} ${coords}` : coords);
  }

  // ── Vector fields and solids of revolution ──

  /**
   * field([P, Q, R]) or field(P, Q, R): an arrow at each point of a grid through the
   * box, coloured and sized by strength, and a few flow lines that follow the field.
   */
  private addVectorField(entry: RowEntry, f: MathFunction, s: any, tier: number) {
    const args = callArgs(f.expr, "field");
    if (!args?.length) return;
    const parts = args.map((a) => compileCached(a));
    if (parts.some((p) => !p)) return;
    const vec = (x: number, y: number, z: number, out: Vec3): boolean => {
      s.x = x;
      s.y = y;
      s.z = z;
      try {
        if (parts.length === 1) {
          if (!readPosition(parts[0]!.evaluate(s), out)) return false;
        } else {
          out[0] = toReal(parts[0]!.evaluate(s));
          out[1] = toReal(parts[1]!.evaluate(s));
          out[2] = parts[2] ? toReal(parts[2].evaluate(s)) : 0;
        }
      } catch {
        return false;
      }
      return Number.isFinite(out[0] + out[1] + out[2]);
    };

    const { cx, cy, cz, half } = this.domain;
    const n = Math.round(clamp(5 * [0.8, 1, 1.2][tier], 4, 6));
    const spacing = (2 * half) / n;
    const at = (i: number) => -half + spacing * (i + 0.5);
    const samples: { p: Vec3; v: Vec3; m: number }[] = [];
    let maxMag = 0;
    const v: Vec3 = [0, 0, 0];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
          const p: Vec3 = [cx + at(i), cy + at(j), cz + at(k)];
          if (!vec(p[0], p[1], p[2], v)) continue;
          const m = Math.hypot(v[0], v[1], v[2]);
          samples.push({ p, v: [v[0], v[1], v[2]], m });
          if (m > maxMag) maxMag = m;
        }
    if (!samples.length || !(maxMag > 0)) return;

    // Arrows: a shaft each, and a cone head drawn as one instanced mesh.
    const shafts: number[] = [];
    const colors: number[] = [];
    const heads = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.1 * spacing, 0.28 * spacing, 10),
      new THREE.MeshBasicMaterial({ clippingPlanes: this.planes }),
      samples.length,
    );
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    let count = 0;
    for (const sm of samples) {
      if (!(sm.m > 1e-12 * maxMag)) continue;
      const rel = sm.m / maxMag;
      // Lengths grow with strength, but weak arrows stay visible.
      const len = spacing * 0.8 * (0.25 + 0.75 * Math.sqrt(rel));
      dir.set(sm.v[0], sm.v[1], sm.v[2]).divideScalar(sm.m);
      const tail = [sm.p[0] - (dir.x * len) / 2, sm.p[1] - (dir.y * len) / 2, sm.p[2] - (dir.z * len) / 2];
      const tip = [sm.p[0] + (dir.x * len) / 2, sm.p[1] + (dir.y * len) / 2, sm.p[2] + (dir.z * len) / 2];
      heightColor(rel, c);
      shafts.push(...tail, ...tip);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      q.setFromUnitVectors(up, dir);
      pos.set(tip[0], tip[1], tip[2]);
      const k = 0.6 + 0.4 * Math.sqrt(rel);
      scl.set(k, k, k);
      m4.compose(pos, q, scl);
      heads.setMatrixAt(count, m4);
      heads.setColorAt(count, c);
      count++;
    }
    heads.count = count;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    if (shafts.length) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(shafts);
      geometry.setColors(colors);
      entry.group.add(new LineSegments2(geometry, new LineMaterial({ vertexColors: true, linewidth: 1.8, clippingPlanes: this.planes })));
      entry.group.add(heads);
    }

    // Flow lines: follow the field (its direction, at an even pace) from a few seeds.
    const h = 0.03 * half;
    const inside = (p: Vec3) => Math.abs(p[0] - cx) <= half && Math.abs(p[1] - cy) <= half && Math.abs(p[2] - cz) <= half;
    const flow: number[] = [];
    const dirAt = (p: Vec3, out: Vec3): boolean => {
      if (!vec(p[0], p[1], p[2], out)) return false;
      const m = Math.hypot(out[0], out[1], out[2]);
      if (!(m > 1e-9 * maxMag)) return false;
      out[0] /= m;
      out[1] /= m;
      out[2] /= m;
      return true;
    };
    const k1: Vec3 = [0, 0, 0], k2: Vec3 = [0, 0, 0], k3: Vec3 = [0, 0, 0], k4: Vec3 = [0, 0, 0];
    const trace = (seed: Vec3, sign: number) => {
      let p: Vec3 = [...seed];
      for (let step = 0; step < 160; step++) {
        if (!dirAt(p, k1)) return;
        const p2: Vec3 = [p[0] + (sign * h * k1[0]) / 2, p[1] + (sign * h * k1[1]) / 2, p[2] + (sign * h * k1[2]) / 2];
        if (!dirAt(p2, k2)) return;
        const p3: Vec3 = [p[0] + (sign * h * k2[0]) / 2, p[1] + (sign * h * k2[1]) / 2, p[2] + (sign * h * k2[2]) / 2];
        if (!dirAt(p3, k3)) return;
        const p4: Vec3 = [p[0] + sign * h * k3[0], p[1] + sign * h * k3[1], p[2] + sign * h * k3[2]];
        if (!dirAt(p4, k4)) return;
        const next: Vec3 = [
          p[0] + (sign * h * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])) / 6,
          p[1] + (sign * h * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])) / 6,
          p[2] + (sign * h * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])) / 6,
        ];
        if (!inside(next)) return;
        flow.push(...p, ...next);
        p = next;
      }
    };
    for (const fx of [-0.45, 0.45])
      for (const fy of [-0.45, 0.45])
        for (const fz of [-0.4, 0.4]) {
          const seed: Vec3 = [cx + fx * half, cy + fy * half, cz + fz * half];
          trace(seed, 1);
          trace(seed, -1);
        }
    if (flow.length) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(flow);
      entry.group.add(
        new LineSegments2(
          geometry,
          new LineMaterial({ color: toColor(f.color), linewidth: 2, transparent: true, opacity: 0.75, clippingPlanes: this.planes }),
        ),
      );
    }
    entry.pinned = [
      ...(entry.pinned ?? []),
      {
        pos: [0, 0, 0],
        text: "",
        html: texToHtml(String.raw`|\vec F|\ \text{from}\ ${formatCoord(Math.min(...samples.map((x) => x.m)))}\ \text{to}\ ${formatCoord(maxMag)}\ \ (\text{blue weak, red strong})`),
        color: f.color,
        scale: 0.85,
      },
    ];
  }

  /**
   * volumeUnder(f(x, y), a, b, c, d[, n]): the volume between z = f(x, y) and the floor
   * over the rectangle a ≤ x ≤ b, c ≤ y ≤ d. Shows the surface there, n × n boxes as tall
   * as f at each one's middle (a Riemann sum), and both the sum and the true value.
   */
  private addVolumeUnder(entry: RowEntry, f: MathFunction, s: any, cells: number) {
    const args = callArgs(f.expr, "volumeUnder");
    if (!args || args.length < 5) return;
    const surfaceFn = compileCached(args[0]);
    const bounds = args.slice(1, 5).map((a) => compileCached(a));
    if (!surfaceFn || bounds.some((b) => !b)) return;
    const num = (c: { evaluate: (scope: any) => any } | null) => {
      try {
        return toReal(c!.evaluate(Object.create(s)));
      } catch {
        return NaN;
      }
    };
    let [a, b, c, d] = bounds.map(num);
    if (![a, b, c, d].every(Number.isFinite) || a === b || c === d) return;
    if (a > b) [a, b] = [b, a];
    if (c > d) [c, d] = [d, c];
    const nArg = args[5] ? compileCached(args[5]) : null;
    const n = Math.round(clamp(nArg ? num(nArg) : 8, 1, 40)) || 8;
    const g = (x: number, y: number) => {
      s.x = x;
      s.y = y;
      try {
        return toReal(surfaceFn.evaluate(s));
      } catch {
        return NaN;
      }
    };

    // The surface over the rectangle.
    const anchor = this.addSurface(
      entry.group,
      (x, y, out) => {
        const z = g(x, y);
        out[0] = x;
        out[1] = y;
        out[2] = z;
        return Number.isFinite(z);
      },
      [a, b],
      [c, d],
      cells,
      { ...f, fillOpacity: f.fillOpacity ?? 0.5 },
    );

    // The boxes: one instanced mesh, edged so each box reads on its own.
    const dx = (b - a) / n;
    const dy = (d - c) / n;
    const boxes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        clippingPlanes: this.planes,
      }),
      n * n,
    );
    const base = toColor(f.color);
    const below = new THREE.Color("#ef4444");
    const m4 = new THREE.Matrix4();
    const edges: number[] = [];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x0 = a + i * dx;
        const y0 = c + j * dy;
        const h = g(x0 + dx / 2, y0 + dy / 2);
        if (!Number.isFinite(h) || h === 0) continue;
        sum += h * dx * dy;
        m4.compose(
          new THREE.Vector3(x0 + dx / 2, y0 + dy / 2, h / 2),
          new THREE.Quaternion(),
          new THREE.Vector3(dx, dy, Math.abs(h)),
        );
        boxes.setMatrixAt(count, m4);
        // Above the floor in the row's colour, below it in red: that part counts negative.
        boxes.setColorAt(count, h > 0 ? base : below);
        count++;
        const x1 = x0 + dx;
        const y1 = y0 + dy;
        for (const z of [0, h]) edges.push(x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z);
        for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) edges.push(x, y, 0, x, y, h);
      }
    }
    boxes.count = count;
    if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
    if (count) {
      entry.group.add(boxes);
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(edges);
      entry.group.add(
        new LineSegments2(
          geometry,
          new LineMaterial({ color: toColor(f.color), linewidth: 1.2, transparent: true, opacity: 0.8, clippingPlanes: this.planes }),
        ),
      );
    }

    // The true value: Simpson's rule both ways on a fine grid.
    const m = 64;
    const hx = (b - a) / m;
    const hy = (d - c) / m;
    const w = (k: number) => (k === 0 || k === m ? 1 : k % 2 ? 4 : 2);
    let exact = 0;
    for (let i = 0; i <= m; i++) {
      for (let j = 0; j <= m; j++) {
        const z = g(a + i * hx, c + j * hy);
        if (Number.isFinite(z)) exact += w(i) * w(j) * z;
      }
    }
    exact *= (hx * hy) / 9;

    const R = String.raw`[${formatCoord(a)}, ${formatCoord(b)}]\times[${formatCoord(c)}, ${formatCoord(d)}]`;
    entry.pinned = [
      ...(entry.pinned ?? []),
      {
        pos: [0, 0, 0],
        text: "",
        html: texToHtml(String.raw`\iint_R f\,dA = ${formatCoord(exact)} \quad R = ${R}`),
        color: f.color,
        scale: 0.9,
      },
      {
        pos: [0, 0, 0],
        text: "",
        html: texToHtml(String.raw`${n}\times${n}\text{ boxes: } \sum f(x_i^*, y_j^*)\,\Delta A = ${formatCoord(sum)}`),
        color: f.color,
        scale: 0.85,
      },
      {
        pos: [0, 0, 0],
        text: "",
        html: texToHtml(String.raw`\text{surface area over } R = ${formatCoord(surfaceAreaOf(g, a, b, c, d))}`),
        color: f.color,
        scale: 0.85,
      },
    ];
    if (anchor) {
      this.pushRowLabel(entry, f, s, anchor);
      this.attachShapeDrag(entry, f, anchor);
    }
  }

  /**
   * revolve(f(x), a, b) turns y = f(x), a ≤ x ≤ b, round the x-axis into a solid;
   * revolve(f(x), a, b, "y") turns it round the y-axis. Shows the curve, a few slices
   * (discs or shells) and the volume.
   */
  private addRevolution(entry: RowEntry, f: MathFunction, s: any, cells: number) {
    const args = callArgs(f.expr, "revolve");
    if (!args || args.length < 3) return;
    const curve = compileCached(args[0]);
    const lo = compileCached(args[1]);
    const hi = compileCached(args[2]);
    if (!curve || !lo || !hi) return;
    const aroundY = (args[3] ?? "").replace(/["'\s]/g, "").toLowerCase() === "y";
    let a = NaN;
    let b = NaN;
    try {
      a = toReal(lo.evaluate(Object.create(s)));
      b = toReal(hi.evaluate(Object.create(s)));
    } catch {}
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
    if (a > b) [a, b] = [b, a];
    const fx = (x: number) => {
      s.x = x;
      try {
        return toReal(curve.evaluate(s));
      } catch {
        return NaN;
      }
    };
    // Where (x, f(x)) goes, turned by `ang` round the axis.
    const place = (x: number, ang: number, out: Vec3): boolean => {
      const y = fx(x);
      if (!Number.isFinite(y)) return false;
      if (aroundY) {
        out[0] = x * Math.cos(ang);
        out[1] = y;
        out[2] = x * Math.sin(ang);
      } else {
        out[0] = x;
        out[1] = y * Math.cos(ang);
        out[2] = y * Math.sin(ang);
      }
      return true;
    };
    const anchor = this.addSurface(entry.group, (x, ang, out) => place(x, ang, out), [a, b], [0, TWO_PI], cells, {
      ...f,
      fillOpacity: f.fillOpacity ?? 0.45,
    });

    // The curve it is made from, on the floor, and the axis it turns round.
    const pts: number[] = [];
    const n = 200;
    for (let i = 0; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      pts.push(x, fx(x), 0);
    }
    const line = this.line(pts, f.color, { ...f, outlineWidth: 4, lineStyle: "solid" });
    if (line) entry.group.add(line);
    const axisPts = aroundY ? [0, Math.min(0, fx(a), fx(b)) - 0.5, 0, 0, Math.max(fx(a), fx(b)) + 0.5, 0] : [a - 0.5, 0, 0, b + 0.5, 0, 0];
    const axisLine = this.line(axisPts, "#f59e0b", { ...f, outlineWidth: 2.5, lineStyle: "dashed" });
    if (axisLine) entry.group.add(axisLine);

    // Slices: discs (round the x-axis) or shells (round the y-axis), as rings.
    const rings: number[] = [];
    const slices = 8;
    for (let k = 0; k <= slices; k++) {
      const x = a + ((b - a) * k) / slices;
      const p0: Vec3 = [0, 0, 0];
      const p1: Vec3 = [0, 0, 0];
      for (let i = 0; i < 48; i++) {
        if (!place(x, (i / 48) * TWO_PI, p0) || !place(x, ((i + 1) / 48) * TWO_PI, p1)) continue;
        rings.push(...p0, ...p1);
      }
    }
    if (rings.length) {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(rings);
      entry.group.add(new LineSegments2(geometry, new LineMaterial({ color: 0xffffff, linewidth: 1.5, transparent: true, opacity: 0.55, clippingPlanes: this.planes })));
    }

    // The volume, by Simpson's rule: discs π∫f² dx, or shells 2π∫|x|·|f| dx.
    const steps = 400;
    let sum = 0;
    for (let i = 0; i <= steps; i++) {
      const x = a + ((b - a) * i) / steps;
      const y = fx(x);
      const g = aroundY ? Math.abs(x) * Math.abs(y) : y * y;
      if (!Number.isFinite(g)) continue;
      sum += g * (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2);
    }
    const volume = ((aroundY ? 2 * Math.PI : Math.PI) * sum * (b - a)) / (3 * steps);
    const range = String.raw`_{${formatCoord(a)}}^{${formatCoord(b)}}`;
    const formula = aroundY
      ? String.raw`V = 2\pi\int${range} x\,f(x)\,dx \ (\text{shells}) = ${formatCoord(volume)}`
      : String.raw`V = \pi\int${range} f(x)^2\,dx \ (\text{discs}) = ${formatCoord(volume)}`;
    entry.pinned = [
      ...(entry.pinned ?? []),
      { pos: [0, 0, 0], text: "", html: texToHtml(String.raw`\text{round the ${aroundY ? "y" : "x"}-axis: } ${formula}`), color: f.color, scale: 0.9 },
    ];
    if (anchor) {
      this.pushRowLabel(entry, f, s, anchor);
      this.attachShapeDrag(entry, f, anchor);
    }
  }

  // ── Orthographic view ──
  //
  // The perspective camera is kept (the controls, the drag maths and the label code
  // all use it); only its projection is swapped, before each frame, for a parallel one
  // exactly as wide at the point it orbits as the perspective view. Zooming moves the
  // camera in and out as before, which shrinks or grows that width.

  private applyOrtho() {
    if (!this.ortho) return;
    const cam = this.camera;
    const dist = Math.max(1e-3, cam.position.distanceTo(this.controls.target));
    const h = dist * Math.tan((cam.fov * Math.PI) / 360);
    const w = h * cam.aspect;
    cam.projectionMatrix.makeOrthographic(-w, w, h, -h, -100, 100);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /** The pointer's ray into the scene, straight ahead in the orthographic view. */
  private castRay() {
    if (!this.ortho) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      return;
    }
    this.applyOrtho();
    this.camera.updateMatrixWorld();
    const ray = this.raycaster.ray;
    ray.origin.set(this.pointer.x, this.pointer.y, -1).unproject(this.camera);
    ray.direction.set(0, 0, -1).transformDirection(this.camera.matrixWorld);
    this.raycaster.camera = this.camera;
  }

  // ── Implicit surfaces, sampled between frames ──
  //
  // F(x, y, z) = 0 is found from F on a grid of up to 65³ points: at the finer sizes
  // too slow to do in one go without the page stalling. So the grid is filled a slice
  // at a time between frames while the coarser surface stays up, then swapped in.

  private sampleIsoSlice(
    values: Float32Array,
    k: number,
    n: number,
    value: () => number,
    s: any,
    axf: AffineTransform2 | null,
    dom: Domain,
  ) {
    const size = n + 1;
    const step = (2 * dom.half) / n;
    const x0 = dom.cx - dom.half;
    const y0 = dom.cy - dom.half;
    s.z = dom.cz - dom.half + k * step;
    let p = k * size * size;
    for (let j = 0; j < size; j++) {
      const gy = y0 + j * step;
      for (let i = 0; i < size; i++) {
        const gx = x0 + i * step;
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

  private isoReady(id: string, key: string, n: number): boolean {
    const v = this.isoValues.get(id);
    return !!v && v.key === key && v.n === n;
  }

  private queueIso(f: MathFunction, scope: any, key: string, n: number) {
    const job = this.isoJobs.get(f.id);
    if (job && job.key === key && job.n === n) return;
    const s = Object.create(scope);
    this.isoJobs.set(f.id, {
      id: f.id,
      key,
      n,
      k: 0,
      values: new Float32Array((n + 1) ** 3),
      value: this.relation(f, s),
      s,
      axf: this.affineTransformOf(f, () => [[0, 0]]),
      dom: { ...this.domain },
    });
    if (!this.isoTimer) this.isoTimer = window.setTimeout(this.runIsoJobs, 0);
  }

  private runIsoJobs = () => {
    this.isoTimer = 0;
    if (this.disposed) return;
    const deadline = performance.now() + 10;
    for (const job of [...this.isoJobs.values()]) {
      if (this.flatKeys.has(job.key)) {
        this.isoJobs.delete(job.id);
        continue;
      }
      while (job.k <= job.n && performance.now() < deadline) {
        this.sampleIsoSlice(job.values, job.k, job.n, job.value, job.s, job.axf, job.dom);
        job.k++;
      }
      if (job.k > job.n) {
        this.isoValues.set(job.id, { key: job.key, n: job.n, values: job.values });
        this.isoJobs.delete(job.id);
        this.sync();
      }
      if (performance.now() >= deadline) break;
    }
    if (this.isoJobs.size) this.isoTimer = window.setTimeout(this.runIsoJobs, 0);
  };

  // ── Export: the graph as a 3D model ──

  /**
   * The surfaces (and, for GLB, the curves) in graph units, cut to the box as they
   * show on screen. STL is for 3D printing and keeps z up; GLB turns z to y, as 3D
   * apps expect, and keeps colours.
   */
  async exportModel(format: "stl" | "glb"): Promise<Blob | null> {
    if (this.needsSync) {
      this.needsSync = false;
      this.syncRows();
    }
    this.content.updateMatrixWorld(true);
    const { cx, cy, cz, half } = this.domain;
    const lo = [cx - half, cy - half, cz - half];
    const hi = [cx + half, cy + half, cz + half];
    const toGraph = this.content.matrixWorld.clone().invert();
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    const root = new THREE.Group();
    const visible = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    const rowColor = (o: THREE.Object3D): string => {
      for (let p: THREE.Object3D | null = o; p; p = p.parent) {
        const id = p.userData?.rowId;
        if (id) return this.rows.get(id)?.color ?? "#3b82f6";
      }
      return CROSS_COLOR;
    };

    const addMesh = (o: THREE.Mesh, matrix: THREE.Matrix4) => {
      const g = o.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute("position");
      if (!pos) return;
      const col = g.getAttribute("color");
      const idx = g.index;
      const count = idx ? idx.count : pos.count;
      const out: number[] = [];
      const outCol: number[] = [];
      const corner = (i: number) => {
        v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
        return col ? [v.x, v.y, v.z, col.getX(i), col.getY(i), col.getZ(i)] : [v.x, v.y, v.z];
      };
      for (let t = 0; t + 2 < count; t += 3) {
        const a = idx ? idx.getX(t) : t;
        const b = idx ? idx.getX(t + 1) : t + 1;
        const c = idx ? idx.getX(t + 2) : t + 2;
        const poly = clipToBox([corner(a), corner(b), corner(c)], lo, hi);
        for (let k = 1; k + 1 < poly.length; k++) {
          for (const p of [poly[0], poly[k], poly[k + 1]]) {
            out.push(p[0], p[1], p[2]);
            if (col) outCol.push(p[3], p[4], p[5]);
          }
        }
      }
      if (!out.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
      if (col) geometry.setAttribute("color", new THREE.Float32BufferAttribute(outCol, 3));
      geometry.computeVertexNormals();
      const src = o.material as any;
      const color = src?.color instanceof THREE.Color ? src.color.clone() : new THREE.Color(rowColor(o));
      const opacity = typeof src?.opacity === "number" ? src.opacity : 1;
      root.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: col ? 0xffffff : color,
            vertexColors: !!col,
            side: THREE.DoubleSide,
            transparent: opacity < 1,
            opacity,
            roughness: 0.6,
            metalness: 0,
          }),
        ),
      );
    };

    const addLines = (o: LineSegments2, matrix: THREE.Matrix4) => {
      const g = o.geometry as any;
      const start = g.attributes.instanceStart;
      const end = g.attributes.instanceEnd;
      if (!start || !end) return;
      const out: number[] = [];
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      for (let i = 0; i < start.count; i++) {
        a.fromBufferAttribute(start, i).applyMatrix4(matrix);
        b.fromBufferAttribute(end, i).applyMatrix4(matrix);
        const seg = clipSegmentToBox([a.x, a.y, a.z], [b.x, b.y, b.z], lo, hi);
        if (seg) out.push(...seg[0], ...seg[1]);
      }
      if (!out.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
      const mat = o.material as LineMaterial;
      root.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: mat.vertexColors ? new THREE.Color(rowColor(o)) : mat.color.clone() })));
    };

    // STL holds only surfaces: a curve goes in as a thin six-sided tube, so it prints.
    const addTubes = (o: LineSegments2, matrix: THREE.Matrix4) => {
      const g = o.geometry as any;
      const start = g.attributes.instanceStart;
      const end = g.attributes.instanceEnd;
      if (!start || !end) return;
      const width = (o.material as LineMaterial).linewidth || 2;
      const radius = 0.004 * half * clamp(width, 1, 6);
      const out: number[] = [];
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const dir = new THREE.Vector3();
      const e1 = new THREE.Vector3();
      const e2 = new THREE.Vector3();
      const ring = (c: number[], k: number) => {
        const ang = (k / 6) * TWO_PI;
        const cs = Math.cos(ang) * radius;
        const sn = Math.sin(ang) * radius;
        return [c[0] + e1.x * cs + e2.x * sn, c[1] + e1.y * cs + e2.y * sn, c[2] + e1.z * cs + e2.z * sn];
      };
      for (let i = 0; i < start.count; i++) {
        a.fromBufferAttribute(start, i).applyMatrix4(matrix);
        b.fromBufferAttribute(end, i).applyMatrix4(matrix);
        const seg = clipSegmentToBox([a.x, a.y, a.z], [b.x, b.y, b.z], lo, hi);
        if (!seg) continue;
        dir.set(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1], seg[1][2] - seg[0][2]);
        if (dir.lengthSq() < 1e-18) continue;
        dir.normalize();
        e1.set(Math.abs(dir.x) < 0.9 ? 1 : 0, Math.abs(dir.x) < 0.9 ? 0 : 1, 0).cross(dir).normalize();
        e2.copy(dir).cross(e1);
        for (let k = 0; k < 6; k++) {
          const p0 = ring(seg[0], k), p1 = ring(seg[0], k + 1), q0 = ring(seg[1], k), q1 = ring(seg[1], k + 1);
          out.push(...p0, ...q0, ...q1, ...p0, ...q1, ...p1);
        }
      }
      if (!out.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
      geometry.computeVertexNormals();
      root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: (o.material as LineMaterial).color.clone() })));
    };

    for (const group of [this.rowsGroup, this.crossGroup]) {
      group.traverse((o) => {
        if (!visible(o)) return;
        if (o instanceof LineSegments2) {
          const lm = m.multiplyMatrices(toGraph, o.matrixWorld);
          if (format === "glb") addLines(o, lm);
          else addTubes(o, lm);
        } else if (o instanceof THREE.InstancedMesh) {
          const inst = new THREE.Matrix4();
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, inst);
            addMesh(o, new THREE.Matrix4().multiplyMatrices(toGraph, o.matrixWorld).multiply(inst));
          }
        } else if (o instanceof THREE.Mesh) {
          addMesh(o, new THREE.Matrix4().multiplyMatrices(toGraph, o.matrixWorld));
        }
      });
    }
    if (!root.children.length) return null;

    if (format === "stl") {
      const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
      const data = new STLExporter().parse(root, { binary: true }) as unknown as DataView;
      return new Blob([data.buffer as ArrayBuffer], { type: "model/stl" });
    }
    // glTF is y-up.
    root.rotation.x = -Math.PI / 2;
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const data = (await new GLTFExporter().parseAsync(root, { binary: true })) as ArrayBuffer;
    return new Blob([data], { type: "model/gltf-binary" });
  }

  // ── A spin round the graph, as a video ──

  /**
   * Each label as a picture, typeset as it shows: made once before a recording, then
   * drawn wherever the label stands in each frame (its words don't change during a spin).
   * Labels that can't be pictured are left out, and drawn as plain text instead.
   */
  private async labelImages(s: number): Promise<Map<HTMLElement, HTMLCanvasElement>> {
    const out = new Map<HTMLElement, HTMLCanvasElement>();
    let css: string;
    try {
      css = await overlayCss();
    } catch {
      return out;
    }
    const host = getComputedStyle(this.labelHost);
    for (const el of this.labelEls.slice(0, 150)) {
      if (!el.isConnected || el.offsetParent === null || !el.textContent?.trim()) continue;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const w = Math.ceil(r.width) + 2;
      const h = Math.ceil(r.height) + 2;
      const clone = el.cloneNode(true) as HTMLElement;
      // Where it stands and how faded it is come from the frame, not the picture.
      clone.style.position = "absolute";
      clone.style.left = "1px";
      clone.style.top = "1px";
      clone.style.right = "auto";
      clone.style.bottom = "auto";
      clone.style.transform = "none";
      clone.style.opacity = "1";
      clone.style.margin = "0";
      const wrap = document.createElement("div");
      wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrap.style.cssText =
        `position:relative;width:${w}px;height:${h}px;overflow:hidden;margin:0;` +
        `font-family:${host.fontFamily};font-size:${host.fontSize};font-weight:${host.fontWeight};color:${host.color};` +
        `text-shadow:${this.labelHost.style.textShadow}`;
      const style = document.createElement("style");
      style.textContent = css;
      wrap.append(style, clone);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w * s}" height="${h * s}" viewBox="0 0 ${w} ${h}">` +
        `<foreignObject x="0" y="0" width="${w}" height="${h}">${new XMLSerializer().serializeToString(wrap)}</foreignObject></svg>`;
      try {
        const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        const c = document.createElement("canvas");
        c.width = Math.ceil(w * s);
        c.height = Math.ceil(h * s);
        const cx = c.getContext("2d")!;
        cx.drawImage(img, 0, 0, c.width, c.height);
        // A picture the browser won't let be read back would spoil the whole video.
        cx.getImageData(0, 0, 1, 1);
        out.set(el, c);
      } catch {
        // Drawn as text instead.
      }
    }
    return out;
  }

  /** The labels over a frame: their pictures where there are some, plain text otherwise. */
  private drawLabelFrame(ctx: CanvasRenderingContext2D, s: number, images: Map<HTMLElement, HTMLCanvasElement>) {
    const box = this.labelHost.getBoundingClientRect();
    ctx.save();
    ctx.textBaseline = "middle";
    for (const el of this.labelEls) {
      if (!el.isConnected || el.offsetParent === null) continue;
      const cs = getComputedStyle(el);
      const alpha = Number(cs.opacity);
      if (!(alpha > 0.01)) continue;
      const r = el.getBoundingClientRect();
      ctx.globalAlpha = Number.isFinite(alpha) ? alpha : 1;
      const img = images.get(el);
      if (img) {
        ctx.drawImage(img, (r.left - box.left - 1) * s, (r.top - box.top - 1) * s);
        continue;
      }
      const text = el.innerText.trim();
      if (!text) continue;
      ctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * s}px ${cs.fontFamily}`;
      ctx.fillStyle = cs.color;
      ctx.fillText(text, (r.left - box.left) * s, (r.top - box.top + r.height / 2) * s);
    }
    ctx.restore();
  }


  private stepSpin() {
    const sp = this.spin!;
    const f = Math.min(1, (performance.now() - sp.t0) / (sp.seconds * 1000));
    // Eased in and out, so the loop starts and ends gently.
    const e = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f);
    this.camera.position.copy(sp.target).add(sp.start.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), e * TWO_PI));
    this.camera.lookAt(sp.target);
    sp.progress(f);
    if (f >= 1) {
      this.spin = null;
      sp.done();
    } else this.requestRender();
  }

  /**
   * One slow turn round the graph, recorded as a video (MP4 where the browser can,
   * otherwise WebM), with its labels and corner notes. Null if the browser can't record.
   */
  async recordSpin(seconds: number, progress: (f: number) => void): Promise<{ blob: Blob; ext: string } | null> {
    if (typeof MediaRecorder === "undefined" || this.spin) return null;
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const even = (x: number) => Math.max(2, Math.round(x / 2) * 2);
    const comp = document.createElement("canvas");
    comp.width = even(this.width * dpr);
    comp.height = even(this.height * dpr);
    const ctx = comp.getContext("2d");
    if (!ctx || typeof (comp as any).captureStream !== "function") return null;

    // The notes in the corner don't move: drawn once, as they look.
    let notes: HTMLCanvasElement | null = null;
    if (this.pinnedEl.style.display !== "none" && this.pinnedEl.childElementCount) {
      notes = document.createElement("canvas");
      notes.width = comp.width;
      notes.height = comp.height;
      try {
        await this.drawOverlay(notes.getContext("2d")!, this.width, this.height, comp.width / this.width, true);
      } catch {
        notes = null;
      }
    }

    const labelPics = await this.labelImages(comp.width / this.width);
    const stream: MediaStream = (comp as any).captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

    const target = this.controls.target.clone();
    const startPos = this.camera.position.clone();
    const startUp = this.camera.up.clone();
    this.camera.up.set(0, 0, 1);
    const wasAuto = this.controls.autoRotate;
    this.controls.autoRotate = false;
    this.controls.enabled = false;
    this.afterFrame = () => {
      ctx.drawImage(this.renderer.domElement, 0, 0, comp.width, comp.height);
      this.drawLabelFrame(ctx, comp.width / this.width, labelPics);
      if (notes) ctx.drawImage(notes, 0, 0);
    };
    recorder.start(250);
    try {
      await new Promise<void>((resolve) => {
        this.spin = { t0: performance.now(), seconds, target, start: startPos.clone().sub(target), progress, done: resolve };
        this.requestRender();
      });
      // A last moment on the final frame, so players don't cut it short.
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      this.afterFrame = null;
      recorder.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      this.camera.position.copy(startPos);
      this.camera.up.copy(startUp);
      this.camera.lookAt(target);
      this.controls.enabled = true;
      this.controls.autoRotate = wasAuto;
      this.requestRender();
    }
    return { blob: new Blob(chunks, { type: type.split(";")[0] }), ext: type.startsWith("video/mp4") ? "mp4" : "webm" };
  }

  // ── Where surfaces meet ──
  //
  // Every surface row that can say which side of it a point is on (z = f(x, y), or
  // F(x, y, z) = 0) is an implicit g(x, y, z). Where another row's surface crosses
  // g = 0 is found on that row's own triangles: a segment across each triangle whose
  // corners g puts on both sides. Planes drawn in space meet in their line this way.

  private buildIntersections() {
    const list = [...this.rows.values()];
    // Wait while anything taking part is being redrawn coarsely (a drag, or playing).
    if (list.some((r) => r.tier === 0 && (r.implicit || r.surfaces.length))) {
      this.crossGroup.visible = false;
      return;
    }
    this.crossDirty = false;
    this.crossGroup.visible = true;
    disposeGroup(this.crossGroup);
    this.crossGroup.clear();
    if (!this.opts.intersections) return;

    const segs: number[] = [];
    let budget = 400_000; // implicit evaluations, all pairs together
    const a: Vec3 = [0, 0, 0];
    const b: Vec3 = [0, 0, 0];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i];
        const B = list[j];
        let mesh: RowEntry;
        let g: (x: number, y: number, z: number) => number;
        // Cut along the finer mesh: a plane's few triangles would make a curve look jagged.
        const preferB = !!B.flat && !A.flat;
        // A row lifted up the z-axis is tested where it is now.
        const lifted = (r: RowEntry) => {
          const lift = r.group.position.z;
          const fn = r.implicit!;
          return lift ? (x: number, y: number, z: number) => fn(x, y, z - lift) : fn;
        };
        if (B.implicit && A.surfaces.length && !(preferB && A.implicit && B.surfaces.length)) {
          mesh = A;
          g = lifted(B);
        } else if (A.implicit && B.surfaces.length) {
          mesh = B;
          g = lifted(A);
        } else continue;
        const lift = mesh.group.position.z;
        for (const surf of mesh.surfaces) {
          const pos = surf.positions;
          const count = pos.length / 3;
          if (count > budget) continue;
          budget -= count;
          const vals = new Float32Array(count);
          for (let v = 0; v < count; v++) vals[v] = g(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2] + lift);
          const idx = surf.index;
          const cut = (p: number, q: number, out: Vec3) => {
            const vp = vals[p];
            const vq = vals[q];
            const w = vp === vq ? 0.5 : vp / (vp - vq);
            out[0] = pos[p * 3] + (pos[q * 3] - pos[p * 3]) * w;
            out[1] = pos[p * 3 + 1] + (pos[q * 3 + 1] - pos[p * 3 + 1]) * w;
            out[2] = pos[p * 3 + 2] + (pos[q * 3 + 2] - pos[p * 3 + 2]) * w + lift;
          };
          for (let t = 0; t + 2 < idx.length; t += 3) {
            const p0 = idx[t], p1 = idx[t + 1], p2 = idx[t + 2];
            const v0 = vals[p0], v1 = vals[p1], v2 = vals[p2];
            if (v0 !== v0 || v1 !== v1 || v2 !== v2) continue;
            const s0 = v0 >= 0, s1 = v1 >= 0, s2 = v2 >= 0;
            if (s0 === s1 && s1 === s2) continue;
            // The corner on its own side, and the two edges from it that cross.
            if (s0 !== s1 && s0 !== s2) {
              cut(p0, p1, a);
              cut(p0, p2, b);
            } else if (s1 !== s0 && s1 !== s2) {
              cut(p1, p0, a);
              cut(p1, p2, b);
            } else {
              cut(p2, p0, a);
              cut(p2, p1, b);
            }
            segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
          }
        }
      }
    }
    if (!segs.length) return;
    const make = (opts: { linewidth: number; opacity: number; xray: boolean }) => {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(segs);
      const material = new LineMaterial({
        color: toColor(CROSS_COLOR),
        linewidth: opts.linewidth,
        transparent: opts.opacity < 1,
        opacity: opts.opacity,
        depthTest: !opts.xray,
        clippingPlanes: this.planes,
      });
      const line = new LineSegments2(geometry, material);
      line.renderOrder = opts.xray ? 5 : 6;
      line.frustumCulled = false;
      return line;
    };
    // Faintly through whatever is in front, and boldly where it shows.
    this.crossGroup.add(make({ linewidth: 2, opacity: 0.35, xray: true }), make({ linewidth: 4, opacity: 1, xray: false }));
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
    this.selFrame = this.selectionFrame();
    const frames: { id: string; g: GizmoFrame; color: string }[] = [];
    for (const row of this.rows.values()) {
      const g = this.gizmoOf(row.id);
      if (g) frames.push({ id: row.id, g, color: `#${toColor(row.color).getHexString()}` });
    }
    if (this.selFrame) frames.push({ id: SELECTION_ID, g: this.selFrame, color: SELECT_COLOR });
    for (const { id, g, color: own } of frames) {
      for (const kind of gizmoKinds(g, this.rotateAxes)) {
        const key = `${id}:${kind}`;
        live.add(key);
        let el = this.gizmoEls.get(key);
        if (!el) {
          el = this.makeGizmoHandle(id, kind);
          this.gizmoEls.set(key, el);
        }
        const color = GIZMO_COLORS[kind] ?? (g.pivot ? "#3b82f6" : own);
        el.style.setProperty("--c", color);
        const dot = el.firstElementChild as HTMLElement;
        const job = kind === "center" ? (g.pivot ? "pivot" : "move") : kind;
        dot.title = GIZMO_TITLES[job];
        (el.lastElementChild as HTMLElement).textContent = GIZMO_LABELS[job];
      }
      this.buildGizmoScene(id, g);
    }
    this.buildSelectionOutline();
    for (const [key, el] of this.gizmoEls) {
      if (live.has(key)) continue;
      el.remove();
      this.gizmoEls.delete(key);
    }
    if (this.gz && !this.gizmoOf(this.gz.id)) this.endGizmoDrag();
  }

  // ── Select tool ──
  //
  // As on the flat graph: click a shape to select it (Shift adds), then move, turn or
  // resize it. A shape built on points is moved by moving those points, so everything
  // drawn on them follows; the steps go to the graph as motions. A row with no points
  // behind it shows its own transform gizmo while it is selected. Dragging still turns
  // the view: only a click selects.

  setSelectTool(on: boolean) {
    if (on === this.selectTool) return;
    this.selectTool = on;
    this.selDown = null;
    this.refreshSelection();
  }

  setSelection(sel: Selection3D | null) {
    const key = sel ? sel.rowIds.join("|") : "";
    const same = (a: Selection3D | null, b: Selection3D | null) =>
      a === b ||
      (!!a &&
        !!b &&
        a.canLift === b.canLift &&
        a.canRotate === b.canRotate &&
        a.canResize === b.canResize &&
        (a.centre === b.centre || (!!a.centre && !!b.centre && a.centre.every((v, i) => v === b.centre![i]))));
    if (key === this.selKey && same(sel, this.selection)) return;
    if (key !== this.selKey) {
      this.selKey = key;
      this.selTurn = 0;
      this.selScale = 1;
      // A different selection: a drag of the old one's handles is over.
      if (this.gz?.id === SELECTION_ID) this.endGizmoDrag();
    }
    this.selection = sel;
    this.refreshSelection();
  }

  private refreshSelection() {
    this.syncGizmos();
    this.requestRender();
  }

  /** The row under the pointer (set by setPointer or pointAt), if any. */
  private rowUnderPointer(): string | null {
    return this.rowHit()?.row.id ?? null;
  }

  private pointAt(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** A click with the Select tool: the shape under it, or nothing (which lets go). */
  private selectClick(clientX: number, clientY: number, add: boolean) {
    this.pointAt(clientX, clientY);
    const id = this.rowUnderPointer();
    const p = this.getProps();
    if (!id) {
      // Shift-clicking empty space keeps what is selected.
      if (!add) p.onSelect?.([], null, false);
      return;
    }
    p.onSelect?.([id], this.rowMiddle(id), add);
  }

  /** What rows take up of the box, in graph units; null when nothing of them shows. */
  private rowsBox(ids: string[]): THREE.Box3 | null {
    const { cx, cy, cz, half } = this.domain;
    this.content.updateMatrixWorld(true);
    const out = new THREE.Box3();
    const world = new THREE.Box3();
    const corner = new THREE.Vector3();
    for (const id of ids) {
      const row = this.rows.get(id);
      if (!row) continue;
      row.group.traverse((o: any) => {
        if (!(o.isMesh || o.isPoints || o.isLine) || !o.geometry) return;
        try {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        } catch {
          return;
        }
        const b = o.geometry.boundingBox as THREE.Box3 | null;
        if (!b || b.isEmpty() || !Number.isFinite(b.min.x + b.min.y + b.min.z + b.max.x + b.max.y + b.max.z)) return;
        world.copy(b).applyMatrix4(o.matrixWorld);
        for (let i = 0; i < 8; i++) {
          corner.set(i & 1 ? world.max.x : world.min.x, i & 2 ? world.max.y : world.min.y, i & 4 ? world.max.z : world.min.z);
          out.expandByPoint(this.content.worldToLocal(corner));
        }
      });
      // A point drawn as a handle has no geometry of its own.
      if (row.drag) out.expandByPoint(corner.set(row.drag.pos[0], row.drag.pos[1], row.drag.pos[2]));
    }
    if (out.isEmpty()) return null;
    // Only what is inside the box of the graph.
    out.min.max(corner.set(cx - half, cy - half, cz - half));
    out.max.min(corner.set(cx + half, cy + half, cz + half));
    return out.min.x <= out.max.x && out.min.y <= out.max.y && out.min.z <= out.max.z ? out : null;
  }

  /** The middle (across the floor) of what shows of a row: what it turns about once selected. */
  private rowMiddle(id: string): [number, number] | null {
    const box = this.rowsBox([id]);
    if (!box) return null;
    const round = (v: number) => Number(v.toFixed(4));
    return [round((box.min.x + box.max.x) / 2), round((box.min.y + box.max.y) / 2)];
  }

  /** The gizmo of a selection built on points: at their centre, reporting motions. */
  private selectionFrame(): GizmoFrame | null {
    const sel = this.selection;
    if (!this.selectTool || !sel?.centre) return null;
    const { cz, half } = this.domain;
    const box = this.rowsBox(sel.rowIds);
    const reach = box ? Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y) / 2 : 0;
    return {
      px: sel.centre[0],
      py: sel.centre[1],
      // The turn and resize handles start on the far side, clear of the x and y arrows.
      base: SELECT_HANDLE_ANGLE,
      radius: clamp(reach + 0.08 * half, 0.28 * half, 0.75 * half),
      tx: 0,
      ty: 0,
      tz: 0,
      rot: this.selTurn,
      sx: this.selScale,
      sy: this.selScale,
      cz: clamp(sel.centre[2], cz - half, cz + half),
      pivot: false,
      rotatable: sel.canRotate,
      resizable: sel.canResize,
      planar: true,
      liftable: sel.canLift,
      tiltable: !!sel.canTilt && sel.canLift,
      rx: 0,
      ry: 0,
    };
  }

  /** The gizmo standing for `id` right now: a row's own, or the selection's. */
  private gizmoOf(id: string): GizmoFrame | undefined {
    if (id === SELECTION_ID) return this.selFrame ?? undefined;
    const row = this.rows.get(id);
    if (!row?.gizmo) return undefined;
    // A row set up by the Select tool shows its handles only while it alone is selected.
    if (row.gizmoOnSelect) {
      const sel = this.selection;
      if (!this.selectTool || !sel || sel.centre || sel.rowIds.length !== 1 || sel.rowIds[0] !== id) return undefined;
    }
    return row.gizmo;
  }

  /** A dashed box round what is selected. */
  private buildSelectionOutline() {
    const sel = this.selection;
    if (!this.selectTool || !sel?.rowIds.length || !this.opts.selectionBox) return;
    const box = this.rowsBox(sel.rowIds);
    if (!box) return;
    const pad = 0.025 * this.domain.half;
    const lo = [box.min.x - pad, box.min.y - pad, box.min.z - pad];
    const hi = [box.max.x + pad, box.max.y + pad, box.max.z + pad];
    const pts: number[] = [];
    const corner = (i: number) => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]];
    // The 12 edges: corners that differ in exactly one coordinate.
    for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) pts.push(...corner(i), ...corner(i | bit));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const material = new THREE.LineDashedMaterial({
      color: SELECT_COLOR,
      opacity: 0.85,
      transparent: true,
      depthTest: false,
      dashSize: 0.035 * this.domain.half,
      gapSize: 0.025 * this.domain.half,
    });
    const outline = new THREE.LineSegments(geometry, material);
    outline.computeLineDistances();
    outline.renderOrder = 6;
    outline.frustumCulled = false;
    this.gizmoGroup.add(outline);
  }

  /** A step of dragging one of the selection's handles: reported as a motion of its points. */
  private stepSelectionDrag(clientX: number, clientY: number, shift: boolean, alt: boolean) {
    const gz = this.gz;
    const emit = this.getProps().onSelectionMotion;
    if (!gz || !emit) return;
    const s = gz.start;
    const a = gz.applied;
    const half = this.domain.half;
    const snapStep = (niceStep(half) / 10) * (alt ? 0.1 : 1);
    const snap = (v: number) => Number((Math.round(v / snapStep) * snapStep).toFixed(6));
    const tidy = (v: number) => Number(v.toFixed(6));

    if (gz.kind === "x" || gz.kind === "y" || gz.kind === "z") {
      const axis = gz.kind === "x" ? 0 : gz.kind === "y" ? 1 : 2;
      const now = this.alongAxis(clientX, clientY, [s.px, s.py, s.cz], axis);
      if (now === null || gz.along0 === null) return;
      const total = snap(now - gz.along0);
      const step = tidy(total - a.move[axis]);
      if (!step) return;
      a.move[axis] = total;
      emit({ kind: "move", dx: axis === 0 ? step : 0, dy: axis === 1 ? step : 0, ...(axis === 2 ? { dz: step } : {}) });
    } else {
      const hit = this.hitHeight(clientX, clientY, s.cz);
      if (!hit) return;
      if (gz.kind === "center") {
        if (!gz.hit0) return;
        const tx = snap(hit.x - gz.hit0.x);
        const ty = snap(hit.y - gz.hit0.y);
        const dx = tidy(tx - a.move[0]);
        const dy = tidy(ty - a.move[1]);
        if (!dx && !dy) return;
        a.move[0] = tx;
        a.move[1] = ty;
        emit({ kind: "move", dx, dy });
      } else if (gz.kind === "rotate") {
        // Turned about where the selection stood when the drag began: nothing drifts.
        const angle = Math.atan2(hit.y - s.py, hit.x - s.px);
        if (a.lastAngle === null) {
          a.lastAngle = angle;
          return;
        }
        const d = angle - a.lastAngle;
        a.rawAngle += Math.atan2(Math.sin(d), Math.cos(d));
        a.lastAngle = angle;
        const unit = ((shift ? 15 : 1) * Math.PI) / 180;
        const total = Math.round(a.rawAngle / unit) * unit;
        const step = total - a.angle;
        if (Math.abs(step) < 1e-9) return;
        a.angle = total;
        this.selTurn = s.rot + total;
        emit({ kind: "rotate", angle: step, centre: [s.px, s.py] });
      } else if (gz.kind === "scale") {
        const dist = Math.hypot(hit.x - s.px, hit.y - s.py);
        if (a.dist0 === null) {
          // Too near the middle to mean a size.
          if (dist > 1e-6) a.dist0 = dist;
          return;
        }
        const total = Number(clamp(dist / a.dist0, 0.05, 50).toFixed(3));
        const step = total / a.factor;
        if (Math.abs(step - 1) < 1e-9) return;
        a.factor = total;
        this.selScale = total;
        emit({ kind: "scale", factor: step, centre: [s.px, s.py], centreZ: gz.centreZ });
      }
    }
    this.syncGizmos();
    this.requestRender();
  }


  // ── Turning in space: about x, y, z, or freely ──
  //
  // A ring per axis (x red, y green, z yellow), and a purple handle that turns freely
  // about the axes switched on, as a trackball does. Rows typed as equations keep the
  // turn in their transformRotateX/Y/Z settings (composed as quaternions, so every
  // ring turns about the graph's own axis however the row is already turned); shapes
  // built on points are turned by turning their points.

  setRotateAxes(axes: RotateAxes) {
    const a = this.rotateAxes;
    if (a.x === axes.x && a.y === axes.y && a.z === axes.z) return;
    this.rotateAxes = { ...axes };
    this.syncGizmos();
    this.requestRender();
  }

  /** The 3D-only tilt: the whole row turned about the x- and y-axes through its middle. */
  private applyRowTilt(entry: RowEntry, f: MathFunction) {
    const rx = f.transformRotateX || 0;
    const ry = f.transformRotateY || 0;
    if ((!rx && !ry) || !Number.isFinite(rx + ry)) return;
    let pivot: Vec3;
    const g = entry.gizmo;
    if (g) pivot = [g.px + g.tx, g.py + g.ty, g.cz];
    else {
      entry.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(entry.group);
      if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3());
      pivot = [c.x, c.y, c.z];
    }
    const m = new THREE.Matrix4()
      .makeTranslation(pivot[0], pivot[1], pivot[2])
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, 0, "YXZ")))
      .multiply(new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
    const group = entry.group;
    group.updateMatrix();
    group.matrix.premultiply(m);
    group.matrixAutoUpdate = false;
    group.matrixWorldNeedsUpdate = true;
    const v = new THREE.Vector3();
    const turn = (p: Vec3): Vec3 => {
      v.set(p[0], p[1], p[2]).applyMatrix4(m);
      return [v.x, v.y, v.z];
    };
    for (const l of entry.labels) l.pos = turn(l.pos);
    if (entry.anchor) entry.anchor = turn(entry.anchor);
    if (entry.drag) entry.drag.pos = turn(entry.drag.pos);
    // Slices and where it meets other surfaces are worked out on the untilted shape:
    // left out while it is tilted, rather than drawn in the wrong place.
    entry.implicit = undefined;
    entry.flat = undefined;
    entry.surfaces = [];
  }

  /** Where the pointer is round a turning ring, as the angle that grows with a positive turn. */
  private ringAngle(kind: GizmoKind, c: Vec3, clientX: number, clientY: number): number | null {
    const axis = kind === "rotX" ? 0 : kind === "rotY" ? 1 : 2;
    const hit = this.hitPlane(clientX, clientY, axis, c[axis]);
    if (!hit) return null;
    if (axis === 0) return Math.atan2(hit.z - c[2], hit.y - c[1]);
    // About y a positive turn carries z towards x: the angle from x towards z falls.
    if (axis === 1) return -Math.atan2(hit.z - c[2], hit.x - c[0]);
    return Math.atan2(hit.y - c[1], hit.x - c[0]);
  }

  /**
   * A drag of the free-turn handle, as a turn in graph units: dragging right turns about
   * the screen's upright, dragging down about its horizontal, as a trackball does. Only
   * the axes switched on take part. Null when the drag has nothing along them.
   */
  private freeTurn(dx: number, dy: number, allowed: [boolean, boolean, boolean]): { axis: [number, number, number]; angle: number } | null {
    const toLocal = (x: number, y: number) => {
      const o = this.content.worldToLocal(new THREE.Vector3());
      const d = new THREE.Vector3(x, y, 0).applyQuaternion(this.camera.quaternion);
      return this.content.worldToLocal(d).sub(o).normalize();
    };
    const up = toLocal(0, 1);
    const right = toLocal(1, 0);
    const a = up.multiplyScalar(dx).add(right.multiplyScalar(dy));
    const full = a.length();
    if (full < 1e-9) return null;
    const masked = [allowed[0] ? a.x : 0, allowed[1] ? a.y : 0, allowed[2] ? a.z : 0];
    const len = Math.hypot(masked[0], masked[1], masked[2]);
    if (len < 1e-6 * full || len < 1e-9) return null;
    return { axis: [masked[0] / len, masked[1] / len, masked[2] / len], angle: len * 0.012 };
  }

  /** The axes a gizmo may turn about now: its own abilities and the switches. */
  private turnAxes(g: GizmoFrame): [boolean, boolean, boolean] {
    const k = gizmoKinds(g, this.rotateAxes);
    return [k.includes("rotX"), k.includes("rotY"), k.includes("rotate")];
  }

  /**
   * A step of a turning drag (any ring, or the free handle). A row typed as an equation
   * gets its new turn; a selection built on points is sent the turn of its points.
   */
  private stepTurnDrag(clientX: number, clientY: number, shift: boolean) {
    const gz = this.gz;
    if (!gz) return;
    const s = gz.start;
    const a = gz.applied;
    const c: Vec3 = [s.px + s.tx, s.py + s.ty, s.cz];
    const isSel = gz.id === SELECTION_ID;
    const dx = clientX - a.last.x;
    const dy = clientY - a.last.y;
    a.last = { x: clientX, y: clientY };

    if (gz.kind === "free") {
      const t = this.freeTurn(dx, dy, this.turnAxes(s));
      if (!t) return;
      a.freeAngle += t.angle;
      if (isSel) {
        this.getProps().onSelectionMotion?.({ kind: "rotate3", axis: t.axis, angle: t.angle, centre: [s.px, s.py, gz.centreZ] });
      } else {
        a.qFree.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...t.axis), t.angle));
        this.patchTurn(gz.id, a.qFree.clone().multiply(a.q0));
      }
      this.syncGizmos();
      this.requestRender();
      return;
    }

    // A ring: how far round the pointer has gone, unwrapped; seen edge-on, the drag across.
    const ang = this.ringAngle(gz.kind, c, clientX, clientY);
    const d =
      ang !== null && a.lastAngle !== null
        ? Math.atan2(Math.sin(ang - a.lastAngle), Math.cos(ang - a.lastAngle))
        : (gz.kind === "rotY" ? -1 : 1) * (Math.abs(dx) >= Math.abs(dy) ? dx : -dy) * 0.01;
    a.lastAngle = ang;
    a.rawAngle += d;
    const unit = ((shift ? 15 : 1) * Math.PI) / 180;
    const total = Math.round(a.rawAngle / unit) * unit;
    const step = total - a.angle;
    if (Math.abs(step) < 1e-9) return;
    a.angle = total;
    const axis: [number, number, number] = gz.kind === "rotX" ? [1, 0, 0] : gz.kind === "rotY" ? [0, 1, 0] : [0, 0, 1];
    if (isSel) {
      const emit = this.getProps().onSelectionMotion;
      if (gz.kind === "rotate") {
        // About the upright: flat points stay flat.
        this.selTurn = s.rot + total;
        emit?.({ kind: "rotate", angle: step, centre: [s.px, s.py] });
      } else emit?.({ kind: "rotate3", axis, angle: step, centre: [s.px, s.py, gz.centreZ] });
    } else {
      this.patchTurn(gz.id, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), total).multiply(a.q0));
    }
    this.syncGizmos();
    this.requestRender();
  }

  /** A typed row's whole turn, as its three settings (Ry · Rx · Rz). */
  private patchTurn(id: string, q: THREE.Quaternion) {
    const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
    const tidy = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(6)));
    const patch: Partial<MathFunction> = { transformRotateX: tidy(e.x), transformRotateY: tidy(e.y), transformRotate: tidy(e.z) };
    const p = this.getProps();
    if (this.rows.get(id)?.gizmoOnSelect) p.onPatchRow?.(id, patch);
    else (p.onTransformRow ?? p.onPatchRow)?.(id, patch);
    this.requestRender();
  }

  /** Where a gizmo's handles are, in graph units. */
  private gizmoSpots(g: GizmoFrame, id?: string): Record<GizmoKind, Vec3> {
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
    const R = g.radius;
    // The x and y rings' handles rest up and behind, clear of the arrows; while one is
    // dragged it rides round with the pointer.
    const held = id !== undefined && this.gz?.id === id ? this.gz : null;
    const tx = REST_TILT + (held?.kind === "rotX" ? held.applied.angle : 0);
    const ty = REST_TILT + (held?.kind === "rotY" ? held.applied.angle : 0);
    const k = R * 0.58;
    return {
      center: c,
      x: [c[0] + L, c[1], c[2]],
      y: [c[0], c[1] + L, c[2]],
      z: [c[0], c[1], c[2] + L],
      // Turning only reads the angle: the ring keeps its size whatever the scale. Its
      // handle sits half-way between two arrows, so it never hides behind one.
      rotate: [c[0] + R * Math.cos(turn + Z_HANDLE_OFFSET), c[1] + R * Math.sin(turn + Z_HANDLE_OFFSET), c[2]],
      rotX: [c[0], c[1] + R * Math.cos(tx), c[2] + R * Math.sin(tx)],
      // About y the angle runs from x towards -z (see ringAngle).
      rotY: [c[0] + R * Math.cos(ty), c[1], c[2] - R * Math.sin(ty)],
      free: [c[0] - k, c[1] + k, c[2] + k],
      scale: place(a, -a),
    };
  }

  /** The ring, the arrows and the line to the resize handle. */
  private buildGizmoScene(id: string, g: GizmoFrame) {
    const spots = this.gizmoSpots(g, id);
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
    const active = this.gz?.id === id ? this.gz.kind : null;
    const hovered = this.gzHover?.startsWith(`${id}:`) ? (this.gzHover.slice(id.length + 1) as GizmoKind) : null;
    const lit = (kind: GizmoKind) => active === kind || (!active && hovered === kind);
    const kinds = gizmoKinds(g, this.rotateAxes);
    /** A line a few pixels wide, drawn over everything. */
    const thick = (pts: number[], color: string, width: number, opacity: number) => {
      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(pts);
      const material = new LineMaterial({ color: toColor(color), linewidth: width, transparent: true, opacity, depthTest: false });
      const obj = new LineSegments2(geometry, material);
      obj.renderOrder = 6;
      this.gizmoGroup.add(obj);
    };

    // A ring is quiet until its handle is pointed at or dragged; while one turns, the rest fade.
    const ringLook = (kind: GizmoKind): [number, number] => (lit(kind) ? [3.5, 1] : active ? [1.5, 0.18] : [2, 0.5]);
    if (kinds.includes("rotate")) {
      // The ring the turn handle runs round, through the handle itself.
      const r = Math.hypot(spots.rotate[0] - cx, spots.rotate[1] - cy);
      const ring: number[] = [];
      const n = 96;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TWO_PI;
        const a1 = ((i + 1) / n) * TWO_PI;
        ring.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), cz, cx + r * Math.cos(a1), cy + r * Math.sin(a1), cz);
      }
      thick(ring, GIZMO_COLORS.rotate!, ...ringLook("rotate"));
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
        lines(fan, GIZMO_COLORS.rotate!, 0.3);
      }
    }
    // The x and y rings: upright circles through the middle, square to their axes.
    for (const kind of ["rotX", "rotY"] as const) {
      if (!kinds.includes(kind)) continue;
      const r = g.radius;
      const ring: number[] = [];
      const n = 96;
      const at = (t: number): Vec3 =>
        kind === "rotX" ? [cx, cy + r * Math.cos(t), cz + r * Math.sin(t)] : [cx + r * Math.cos(t), cy, cz + r * Math.sin(t)];
      for (let i = 0; i < n; i++) ring.push(...at((i / n) * TWO_PI), ...at(((i + 1) / n) * TWO_PI));
      thick(ring, GIZMO_COLORS[kind]!, ...ringLook(kind));
    }
    if (kinds.includes("scale") && lit("scale")) lines([cx, cy, cz, ...spots.scale], GIZMO_COLORS.scale!, 0.6, true);

    // A shaft along each axis to its arrow handle (the handle is the arrowhead).
    (["x", "y", "z"] as const).forEach((kind, axis) => {
      if (!kinds.includes(kind)) return;
      const tip = spots[kind];
      thick([cx, cy, cz, ...tip], AXIS_COLORS[axis], lit(kind) ? 4 : 3, active && !lit(kind) ? 0.25 : 0.95);
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
    const face = document.createElement("div");
    face.className = "g3d-gzf";
    face.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${GIZMO_ICONS[kind]}</svg>`;
    dot.appendChild(face);
    const label = document.createElement("div");
    label.className = "g3d-gzl";
    wrap.append(dot, label);
    this.handleHost.appendChild(wrap);
    // Pointing at a turning handle lights up its ring.
    dot.addEventListener("pointerenter", () => {
      this.gzHover = `${id}:${kind}`;
      if (!this.gz) this.syncGizmos();
      this.requestRender();
    });
    dot.addEventListener("pointerleave", () => {
      if (this.gzHover !== `${id}:${kind}`) return;
      this.gzHover = null;
      if (!this.gz) this.syncGizmos();
      this.requestRender();
    });
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
    const mid = { x: 0, y: 0 };
    const spots = new Map<string, Record<GizmoKind, Vec3>>();
    for (const [key, el] of this.gizmoEls) {
      const i = key.lastIndexOf(":");
      const id = key.slice(0, i);
      const kind = key.slice(i + 1) as GizmoKind;
      const g = this.gizmoOf(id);
      if (!g) {
        el.style.display = "none";
        continue;
      }
      let s = spots.get(id);
      if (!s) spots.set(id, (s = this.gizmoSpots(g, id)));
      const p = kind === "free" ? s.center : s[kind];
      if (!this.toScreen(p[0], p[1], p[2], at)) {
        el.style.display = "none";
        continue;
      }
      // The free-turn handle isn't on any axis or ring: up and left of the middle, on screen.
      if (kind === "free") {
        at.x += FREE_HANDLE_PX.x;
        at.y += FREE_HANDLE_PX.y;
      }
      el.style.display = "";
      el.style.translate = `${at.x.toFixed(1)}px ${at.y.toFixed(1)}px`;
      if (kind === "x" || kind === "y" || kind === "z") {
        const c = s.center;
        if (this.toScreen(c[0], c[1], c[2], mid)) {
          const deg = (Math.atan2(at.y - mid.y, at.x - mid.x) * 180) / Math.PI;
          el.style.setProperty("--a", `${deg.toFixed(1)}deg`);
        }
      }
      el.classList.toggle("dragging", this.gz?.id === id && this.gz.kind === kind);
      // While one handle is held, the others step back.
      el.style.opacity = this.gz && !(this.gz.id === id && this.gz.kind === kind) ? "0.35" : "";
    }
    const gz = this.gz;
    const g = gz ? this.gizmoOf(gz.id) : undefined;
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
    const deg = (rad: number) => {
      const d = (rad * 180) / Math.PI;
      return Math.round(((((d + 180) % 360) + 360) % 360) - 180);
    };
    if (kind === "rotate" || kind === "rotX" || kind === "rotY" || kind === "free") {
      const gz = this.gz;
      if (gz?.id === SELECTION_ID) {
        if (kind === "free") return `Turn ${deg(gz.applied.freeAngle)}° freely`;
        return `Turn about ${kind === "rotX" ? "x" : kind === "rotY" ? "y" : "z"} ${deg(gz.applied.angle)}°`;
      }
      if (!g.rx && !g.ry && kind === "rotate") return `Turn ${deg(g.rot)}°`;
      return `x ${deg(g.rx)}° · y ${deg(g.ry)}° · z ${deg(g.rot)}°`;
    }
    if (kind === "scale") {
      return Math.abs(g.sx - g.sy) < 1e-3 ? `Scale ${g.sx.toFixed(2)}×` : `Scale ${g.sx.toFixed(2)} × ${g.sy.toFixed(2)}  (Shift: keep shape)`;
    }
    if (kind === "center" && g.pivot) return `Pivot (${f(g.px + g.tx)}, ${f(g.py + g.ty)})`;
    if (this.gz?.id === SELECTION_ID) {
      const [dx, dy, dz] = this.gz.applied.move;
      return `Move (${f(dx)}, ${f(dy)}, ${f(dz)})`;
    }
    return `Shift (${f(g.tx)}, ${f(g.ty)}, ${f(g.tz)})`;
  }

  /** The pointer's ray in graph units: [origin, unit direction]. */
  private localRay(clientX: number, clientY: number): [THREE.Vector3, THREE.Vector3] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.castRay();
    const o = this.content.worldToLocal(this.raycaster.ray.origin.clone());
    const d = this.content.worldToLocal(this.raycaster.ray.origin.clone().add(this.raycaster.ray.direction)).sub(o).normalize();
    return [o, d];
  }

  /** Where the pointer meets the horizontal plane at height z; null when the plane is seen edge-on. */
  /** Where the pointer meets the plane `coordinate[axis] = value`; null when it is seen edge-on. */
  private hitPlane(clientX: number, clientY: number, axis: 0 | 1 | 2, value: number): THREE.Vector3 | null {
    const [o, d] = this.localRay(clientX, clientY);
    const dc = axis === 0 ? d.x : axis === 1 ? d.y : d.z;
    const oc = axis === 0 ? o.x : axis === 1 ? o.y : o.z;
    if (Math.abs(dc) < 0.03) return null;
    const t = (value - oc) / dc;
    if (t <= 0) return null;
    const p = o.addScaledVector(d, t);
    const r = 6 * this.domain.half;
    const mid = [this.domain.cx, this.domain.cy, this.domain.cz];
    if (Math.abs(p.x - mid[0]) > r || Math.abs(p.y - mid[1]) > r || Math.abs(p.z - mid[2]) > r) return null;
    return p;
  }

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
    const g = this.gizmoOf(id);
    if (!g) return;
    this.tween = null;
    this.clearHover();
    const center = this.gizmoSpots(g).center;
    const hit0 = this.hitHeight(e.clientX, e.clientY, g.cz);
    const sel = id === SELECTION_ID ? this.selection : null;
    const reach0 = hit0 ? Math.hypot(hit0.x - center[0], hit0.y - center[1]) : 0;
    this.gz = {
      id,
      kind,
      start: { ...g },
      hit0,
      along0: kind === "x" || kind === "y" || kind === "z" ? this.alongAxis(e.clientX, e.clientY, center, kind === "x" ? 0 : kind === "y" ? 1 : 2) : null,
      applied: {
        move: [0, 0, 0],
        angle: 0,
        rawAngle: 0,
        lastAngle:
          kind === "rotate" || kind === "rotX" || kind === "rotY"
            ? this.ringAngle(kind, center, e.clientX, e.clientY)
            : hit0
              ? Math.atan2(hit0.y - center[1], hit0.x - center[0])
              : null,
        factor: 1,
        dist0: reach0 > 1e-6 ? reach0 : null,
        last: { x: e.clientX, y: e.clientY },
        q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(g.rx, g.ry, g.rot, "YXZ")),
        qFree: new THREE.Quaternion(),
        freeAngle: 0,
      },
      // Flat points that can't be lifted stay on the floor: resized and turned about it.
      centreZ: sel?.centre && sel.canLift ? sel.centre[2] : 0,
    };
    // Heavy rows are redrawn coarsely while they move, then refined.
    this.coarse = true;
    window.clearTimeout(this.coarseTimer);
    this.stopAutoRotate();
    this.syncGizmos();
    this.requestRender();
  }

  private stepGizmoDrag(clientX: number, clientY: number, shift: boolean, alt: boolean) {
    const gz = this.gz;
    if (!gz) return;
    if (gz.kind === "rotate" || gz.kind === "rotX" || gz.kind === "rotY" || gz.kind === "free") return this.stepTurnDrag(clientX, clientY, shift);
    if (gz.id === SELECTION_ID) return this.stepSelectionDrag(clientX, clientY, shift, alt);
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
    // A row the Select tool set up moves as it does on the flat graph: through its settings alone.
    if (this.rows.get(gz.id)?.gizmoOnSelect) p.onPatchRow?.(gz.id, patch);
    else (p.onTransformRow ?? p.onPatchRow)?.(gz.id, patch);
    this.requestRender();
  }

  private endGizmoDrag() {
    if (!this.gz) return;
    this.gz = null;
    this.selScale = 1;
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
    window.clearTimeout(this.isoTimer);
    this.isoJobs.clear();
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
    this.drawTip.remove();
    window.removeEventListener("keydown", this.onDrawKey);
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
  { name: "Monkey saddle", expr: "z = (x^3 - 3*x*y^2)/4" },
  { name: "Hyperboloid", expr: "x^2 + y^2 - z^2 = 2" },
  { name: "Möbius strip", expr: "[(2.5 + (v/pi - 1)*cos(u/2))*cos(u), (2.5 + (v/pi - 1)*cos(u/2))*sin(u), (v/pi - 1)*sin(u/2)]" },
  { name: "Trefoil knot", expr: "[(2.5 + cos(3t))*cos(2t), (2.5 + cos(3t))*sin(2t), sin(3t)]" },
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
  /** An export or recording in progress, and a short message after one. */
  const [busy, setBusy] = useState<"stl" | "glb" | "video" | null>(null);
  const [spinProgress, setSpinProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);
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

  useEffect(() => {
    engineRef.current?.setDrawTool(props.drawTool ?? null);
  }, [props.drawTool]);

  useEffect(() => {
    engineRef.current?.setSelectTool(!!props.selectTool);
  }, [props.selectTool]);

  useEffect(() => {
    engineRef.current?.setSelection(props.selection ?? null);
  }, [props.selection]);

  useEffect(() => {
    engineRef.current?.setRotateAxes(props.rotateAxes ?? ALL_AXES);
  }, [props.rotateAxes]);

  useEffect(() => {
    engineRef.current?.setDrawPlane(props.drawPlane ?? 2);
  }, [props.drawPlane]);

  useEffect(() => {
    engineRef.current?.setDrawSolid(props.drawSolid ?? "flat");
  }, [props.drawSolid]);

  useEffect(() => {
    engineRef.current?.setDrawHeight(props.drawHeight ?? 0);
  }, [props.drawHeight]);

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

      {!props.compact && !failed && props.drawTool && (
        // The drawing plane's height: where the next click lands.
        <div
          data-capture-exclude
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 shadow-lg shadow-slate-900/10 dark:shadow-black/40 cursor-default"
        >
          <div role="radiogroup" aria-label="Drawing plane" className="flex items-center gap-0.5 p-0.5 mr-1 -ml-2 rounded-full bg-slate-100 dark:bg-slate-800">
            {DRAW_PLANES.map(({ plane, label, title }) => {
              const on = (props.drawPlane ?? 2) === plane;
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={title}
                  onClick={() => props.onDrawPlane?.(plane)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${on
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[12px] font-semibold tabular-nums whitespace-nowrap" style={{ color: AXIS_COLORS[props.drawPlane ?? 2] }}>
            {AXIS_NAMES[props.drawPlane ?? 2]} = {formatCoord(props.drawHeight ?? 0)}
          </span>
          {(["−", "+"] as const).map((sign) => (
            <button
              key={sign}
              type="button"
              title={`${sign === "+" ? "Move the drawing plane up" : "Move the drawing plane down"} ${AXIS_NAMES[props.drawPlane ?? 2]} (${sign === "+" ? "Page Up" : "Page Down"})`}
              aria-label={sign === "+" ? "Move the drawing plane forward" : "Move the drawing plane back"}
              onClick={() => {
                const engine = engineRef.current;
                if (!engine) return;
                const step = engine.drawHeightStep();
                const h = props.drawHeight ?? 0;
                props.onDrawHeight?.(Number((h + (sign === "+" ? step : -step)).toFixed(6)));
              }}
              className="size-7 inline-flex items-center justify-center rounded-full text-[15px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {sign}
            </button>
          ))}
          {(props.drawHeight ?? 0) !== 0 && (
            <button
              type="button"
              title={`Back through the origin (${AXIS_NAMES[props.drawPlane ?? 2]} = 0)`}
              onClick={() => props.onDrawHeight?.(0)}
              className="h-7 px-2 rounded-full text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {(props.drawPlane ?? 2) === 2 ? "Floor" : "Origin"}
            </button>
          )}
        </div>
      )}
      {!props.compact && !failed && (
        <>
          <div
            data-capture-exclude
            className={`${props.drawTool ? "hidden" : "hidden md:block"} absolute bottom-3 left-3 z-30 pointer-events-none px-2 py-1 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/60 text-[10px] text-slate-500 dark:text-slate-400`}
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

                <div className={HEADING}>Export</div>
                <div className="flex gap-1">
                  {(["stl", "glb"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      disabled={!!busy}
                      title={format === "stl" ? "The surfaces as an STL file, for 3D printing" : "Surfaces and curves, in colour, as a GLB file for 3D apps"}
                      className={CHIP}
                      onClick={async () => {
                        const engine = engineRef.current;
                        if (!engine) return;
                        setBusy(format);
                        try {
                          const blob = await engine.exportModel(format);
                          if (blob) saveBlob(blob, `graph-3d.${format}`);
                          else setNotice("Nothing to export: add a surface first.");
                        } catch (err) {
                          console.warn("3D export failed", err);
                          setNotice("Export failed.");
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {busy === format ? "…" : format.toUpperCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!!busy}
                    title="Record one slow turn round the graph as a video"
                    className={busy === "video" ? CHIP_ON : CHIP}
                    onClick={async () => {
                      const engine = engineRef.current;
                      if (!engine) return;
                      setBusy("video");
                      setSpinProgress(0);
                      try {
                        const result = await engine.recordSpin(8, setSpinProgress);
                        if (result) saveBlob(result.blob, `graph-3d-spin.${result.ext}`);
                        else setNotice("This browser can't record video.");
                      } catch (err) {
                        console.warn("3D video failed", err);
                        setNotice("Recording failed.");
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "video" ? `Recording ${Math.round(spinProgress * 100)}%` : "Spin video"}
                  </button>
                </div>
                {notice && <div className="px-1 pt-1 text-[10px] text-amber-600 dark:text-amber-400">{notice}</div>}

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
                  label="Intersections"
                  title="Draw the curves where surfaces meet, such as the line where two planes cross"
                  on={options.intersections}
                  onChange={(on) => setOptions({ intersections: on })}
                />
                <Switch
                  label="Tangent plane"
                  title="Show the tangent plane and normal where the pointer touches a surface"
                  on={options.tangent}
                  onChange={(on) => setOptions({ tangent: on })}
                />
                <div className={HEADING}>Display</div>
                <Switch
                  label="Axes"
                  title="The x, y and z axes, with their numbers"
                  on={options.showAxes}
                  onChange={(on) => setOptions({ showAxes: on })}
                />
                <Switch
                  label="Grid"
                  title="The grid on the floor"
                  on={options.showGrid}
                  onChange={(on) => setOptions({ showGrid: on })}
                />
                <Switch
                  label="Box"
                  title="The outline of the box the graph is drawn in"
                  on={options.showBox}
                  onChange={(on) => setOptions({ showBox: on })}
                />
                {props.selectTool && !!props.selection?.rowIds.length && (
                  // Only while something is selected: the box it shows round the selection.
                  <Switch
                    label="Selection box"
                    title="The dashed box round the selected shape. Its handles stay either way."
                    on={options.selectionBox}
                    onChange={(on) => setOptions({ selectionBox: on })}
                  />
                )}
                <Switch
                  label="Orthographic"
                  title="No perspective: parallel lines stay parallel and sizes don't shrink with distance, as in a technical drawing"
                  on={options.ortho}
                  onChange={(on) => setOptions({ ortho: on })}
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
