import { useState, useRef, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  SelectionShape, SelectionToolId, SavedSelection, PathSelection, Point, SelectionOperation,
  RegionFilter, BBox
} from './types';
import {
  traceShape, getShapeBBox, translateShape, shapeContainsPoint, isDegenerate, distanceToFirstPoint,
  scaleShape, rotateShape, expandShape, resizeBBox, fitShapeToBBox, angleFromCentre, shapeToPolygon,
  invertShape,
  HANDLE_IDS, HandleId, getShapeHandlePositions, hitTestShapeHandle, getShapeAngle,
  getShapeCentre, setShapeAngle, toLocalPoint, cursorForHandle
} from './geometry';
import {
  applyOperationToImage, extractFromImage, swapImageSource,
  attachRegionFilterMask, detachRegionFilterMask,
  sceneShapeToImagePixels, imagePixelsToSceneShape, readImagePixels, rasterizeObject
} from './fabricBridge';
import { maskToSelection } from './maskToShape';
import { BrushMode, applyBrushStroke, combineSelection, imageAddition } from './combineSelection';

interface Options {
  /**
   * The live canvas instance, not a ref. These effects must re-run once the canvas exists, and a
   * ref's identity never changes - depending on one meant the handlers were registered a single
   * time at mount, while the canvas was still null, and so never attached at all.
   */
  canvas: fabric.Canvas | null;
  /** Called with a label and an undo/redo pair whenever pixels change. */
  onCommit?: (label: string, undo: () => void, redo: () => void) => void;
  /** Rebuilds an object's live fabric filters from its customFilters, for undoing a bake. */
  rebuildFilters?: (image: fabric.Image) => void;
  /**
   * Segments the subject out of the given pixels, resolving with a mask whose alpha is the
   * subject. Injected rather than imported so this module never depends on the AI stack: any
   * model that can produce a matte drives the object-selection tool.
   */
  segmentSubject?: (
    pixels: ImageData,
    signal: AbortSignal,
    onProgress?: (state: string, progress: number) => void
  ) => Promise<ImageData>;
  /**
   * Called with an object that has just been turned into a selection. The host deletes it through
   * its own undo stack: once the shape has become a selection it has done its job, and leaving it
   * behind covers the very region the user is now trying to edit.
   */
  onConsumeObject?: (obj: fabric.Object) => void;
}

/** What the auto-select is doing right now, so the UI can say so instead of just spinning. */
export interface AutoSelectStage {
  state: string;
  /** 0-100. */
  progress: number;
}

/** How closely the traced outline follows the model's mask. */
export type AutoSelectDetail = 'smooth' | 'balanced' | 'detailed';

const DETAIL_SETTINGS: Record<AutoSelectDetail, { tolerance: number; smooth: number }> = {
  smooth: { tolerance: 2.6, smooth: 2 },
  balanced: { tolerance: 1.2, smooth: 1 },
  detailed: { tolerance: 0.5, smooth: 0 }
};

export interface AutoSelectRequest {
  /** Scene-space box to confine the search to. Omit to run over the whole layer. */
  region?: BBox | null;
  /** Scene-space point; keeps only the piece of the mask under it. */
  point?: Point | null;
  detail?: AutoSelectDetail;
  /** Overrides the caller's default model for this run. */
  modelId?: string;
}

const CLOSE_THRESHOLD_PX = 10;
/** Screen-space sizes, divided by zoom at use so they stay constant on screen. */
const HANDLE_SIZE_PX = 9;
/** Generous so a fingertip can grab a handle; a mouse benefits too. */
const HANDLE_HIT_PX = 22;
const ROTATE_OFFSET_PX = 26;
/**
 * The two brushes differ only in which way they push the selection, so the tool itself is the
 * mode. One tap to switch beats a modifier that touch devices do not have and that desktop users
 * have to discover, and it leaves exactly one source of truth for what a swipe will do.
 */
const isBrushTool = (tool: SelectionToolId | null): boolean =>
  tool === 'sel-brush' || tool === 'sel-erase';

const baseBrushMode = (tool: SelectionToolId | null): BrushMode =>
  tool === 'sel-erase' ? 'subtract' : 'add';

const otherMode = (mode: BrushMode): BrushMode => (mode === 'add' ? 'subtract' : 'add');

/** Brush width in screen pixels, so the footprint stays the same at any zoom. */
const DEFAULT_BRUSH_PX = 48;
const MIN_BRUSH_PX = 4;
const MAX_BRUSH_PX = 300;

/**
 * Drives the marquee, ellipse and pen selection tools on a fabric canvas.
 *
 * The hook owns only interaction and state; every geometric and pixel decision lives in the pure
 * modules beside it, so the same selection can be driven from a different UI without change.
 */
export function useImageSelection({ canvas, onCommit, rebuildFilters, segmentSubject, onConsumeObject }: Options) {
  const [activeSelectionTool, setActiveSelectionTool] = useState<SelectionToolId | null>(null);
  const [selection, setSelection] = useState<SelectionShape | null>(null);
  const [draft, setDraft] = useState<SelectionShape | null>(null);
  const [savedShapes, setSavedShapes] = useState<SavedSelection[]>([]);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_PX);
  const [isInverted, setIsInverted] = useState(false);
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);
  const [autoSelectError, setAutoSelectError] = useState<string | null>(null);
  const [autoSelectStage, setAutoSelectStage] = useState<AutoSelectStage | null>(null);

  // Refs mirror the state so the fabric event handlers, which are bound once, always read current
  // values instead of the values captured when they were registered.
  const toolRef = useRef(activeSelectionTool);
  const selectionRef = useRef(selection);
  const draftRef = useRef(draft);
  const dragStartRef = useRef<Point | null>(null);
  // One state machine for every direct manipulation of an existing selection.
  const dragRef = useRef<
    | { mode: 'move'; origin: Point; shape: SelectionShape }
    | { mode: 'resize'; handle: HandleId; shape: SelectionShape; box: ReturnType<typeof getShapeBBox> }
    | { mode: 'rotate'; shape: SelectionShape; startPointer: number; startShapeAngle: number }
    | null
  >(null);
  const antsOffsetRef = useRef(0);
  // Brush state the once-bound canvas handlers read: the stroke in progress, the mode it started
  // with, and where the pointer is so the size ring can be drawn under it.
  const brushSizeRef = useRef(brushSize);
  const strokeRef = useRef<{ points: Point[]; mode: BrushMode; radius: number } | null>(null);
  const hoverRef = useRef<Point | null>(null);
  /**
   * Alt as tracked from the keyboard, not only from the pointer event.
   *
   * A pointer event usually carries altKey, but not always - synthetic events, some pen and touch
   * paths, and events replayed by other handlers can arrive without it. Reading both is what makes
   * "hold Alt to subtract" fire reliably rather than most of the time.
   */
  const altDownRef = useRef(false);
  /**
   * The layer this selection belongs to, remembered rather than re-derived.
   *
   * Drawing a selection makes fabric drop its active object - the gesture lands on empty space as
   * far as it is concerned - so by the time an operation runs there is nothing left saying which
   * layer the user meant. Falling back to "topmost image that overlaps" quietly picks the wrong
   * one as soon as two images overlap, which is exactly what a pasted copy is: the same picture,
   * offset slightly, sitting on top of the original. Pinning the layer when the gesture starts
   * keeps the answer stable for the life of the selection.
   */
  const pinnedTargetRef = useRef<fabric.Image | null>(null);
  /**
   * What the selection looked like before it was inverted, so inverting back can restore it
   * exactly. `result` is the shape this hook produced, used to tell an invert apart from every
   * other way the selection can change.
   */
  const invertStateRef = useRef<{ from: SelectionShape | null; result: SelectionShape | null }>({
    from: null,
    result: null
  });
  const applyStrokeRef = useRef<((stroke: { points: Point[]; mode: BrushMode; radius: number }) => void) | null>(null);
  // The canvas handlers are bound once, so they reach the current auto-select through a ref.
  const autoSelectRef = useRef<((opts?: AutoSelectRequest) => Promise<boolean>) | null>(null);
  const autoAbortRef = useRef<AbortController | null>(null);
  // Read by the render handler, which is bound once and so cannot see the state directly.
  const autoBusyRef = useRef(false);

  // Arming a tool is the last moment the active object still says which layer the user chose.
  useEffect(() => {
    if (!canvas || !activeSelectionTool) return;
    const active = canvas.getActiveObject() as any;
    if (active?.type === 'image') {
      pinnedTargetRef.current = active as fabric.Image;
    } else if (active?.get?.('isFrameGroup')) {
      const inner = active.getObjects?.().find((o: any) => o.type === 'image');
      if (inner) pinnedTargetRef.current = inner as fabric.Image;
    }
  }, [activeSelectionTool, canvas]);

  useEffect(() => {
    toolRef.current = activeSelectionTool;
    // Otherwise the size ring reappears at the last place the pointer was, whenever the brush is
    // picked up again.
    if (!isBrushTool(activeSelectionTool)) hoverRef.current = null;
  }, [activeSelectionTool]);
  useEffect(() => {
    const sync = (e: KeyboardEvent) => { altDownRef.current = e.altKey; };
    // Alt-tabbing away never delivers the keyup, so the flag would stay stuck on without this.
    const clear = () => { altDownRef.current = false; };
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
      window.removeEventListener('blur', clear);
    };
  }, []);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  // The canvas handlers bind once, so they reach these through refs.
  const isLiveTargetRef = useRef<typeof isLiveTarget | null>(null);
  const imageAtPointRef = useRef<typeof imageAtPoint | null>(null);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  /** Whether a pinned layer is still a usable target. */
  const isLiveTarget = useCallback((obj: fabric.Image | null): obj is fabric.Image => {
    if (!obj || !canvas) return false;
    if (obj.visible === false) return false;
    return canvas.getObjects().includes(obj);
  }, [canvas]);

  /** Whether a scene point falls within an image's on-canvas bounds. */
  const pointOverImage = (img: fabric.Image | null, point: Point): boolean => {
    if (!img) return false;
    const b = img.getBoundingRect();
    return point.x >= b.left && point.x <= b.left + b.width
      && point.y >= b.top && point.y <= b.top + b.height;
  };

  /** Topmost visible image under a scene point, which is the one the user is pointing at. */
  const imageAtPoint = useCallback((point: Point): fabric.Image | null => {
    if (!canvas) return null;
    const images = canvas.getObjects().filter(o => o.type === 'image' && o.visible);
    for (let i = images.length - 1; i >= 0; i--) {
      const b = images[i].getBoundingRect();
      if (point.x >= b.left && point.x <= b.left + b.width
        && point.y >= b.top && point.y <= b.top + b.height) {
        return images[i] as fabric.Image;
      }
    }
    return null;
  }, [canvas]);

  const clearSelection = useCallback(() => {
    if (canvas) canvas.defaultCursor = 'default';
    // The selection is gone, so the layer it belonged to should not haunt the next one.
    pinnedTargetRef.current = null;
    setSelection(null);
    setDraft(null);
    dragStartRef.current = null;
    dragRef.current = null;
    canvas?.requestRenderAll();
  }, [canvas]);

  /** Turns the in-progress pen path into a usable selection. Bound to Alt+Enter. */
  const commitPenPath = useCallback(() => {
    const current = draftRef.current;
    if (!current || current.kind !== 'path' || current.points.length < 3) return false;
    const closed: PathSelection = { ...current, closed: true };
    setSelection(closed);
    setDraft(null);
    canvas?.requestRenderAll();
    return true;
  }, [canvas]);

  const saveCurrentShape = useCallback((name?: string) => {
    const current = selectionRef.current;
    if (!current) return;
    setSavedShapes(prev => [
      ...prev,
      {
        id: `sel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: name || `${current.kind} ${prev.length + 1}`,
        shape: current,
        createdAt: Date.now()
      }
    ]);
  }, []);

  const loadSavedShape = useCallback((id: string) => {
    const found = savedShapes.find(s => s.id === id);
    if (!found) return;
    setSelection(found.shape);
    setDraft(null);
    canvas?.requestRenderAll();
  }, [savedShapes, canvas]);

  const deleteSavedShape = useCallback((id: string) => {
    setSavedShapes(prev => prev.filter(s => s.id !== id));
  }, []);

  // ---------------------------------------------------------------- canvas interaction
  useEffect(() => {
    if (!canvas) return;

    const scenePoint = (opt: any): Point => {
      const p = canvas.getScenePoint(opt.e);
      return { x: p.x, y: p.y };
    };

    const onDown = (opt: any) => {
      const tool = toolRef.current;
      const point = scenePoint(opt);
      const current = selectionRef.current;
      const zoom = canvas.getZoom() || 1;

      /**
       * Decides which layer a *new* selection gesture belongs to.
       *
       * An explicit choice is honoured only while the press is actually over it - that is what
       * separates "I picked the original, the copy just happens to sit on top" from "I picked
       * something earlier and have now moved on to a different layer". Called only where a new
       * selection begins, never when an existing one is being dragged or resized, so moving a
       * selection across the canvas cannot hand it to a different layer.
       */
      const pinTargetFor = (at: Point) => {
        const pinned = pinnedTargetRef.current;
        const pinnedLives = !!isLiveTargetRef.current?.(pinned);
        if (pinnedLives && pinned && pointOverImage(pinned, at)) return;
        pinnedTargetRef.current = imageAtPointRef.current?.(at) ?? (pinnedLives ? pinned : null);
      };

      // The brush is checked before the transform handles: with the brush armed, a press inside an
      // existing selection has to paint, not drag it. Photoshop draws the same line between a
      // painting tool and a transform.
      if (isBrushTool(tool)) {
        pinTargetFor(point);
        // Alt flips to the other brush for the length of one stroke - a shortcut, never the only
        // way in. The mode is captured now so releasing Alt mid-swipe cannot turn a single stroke
        // into two different operations.
        const alt = !!(opt.e?.altKey) || altDownRef.current;
        const mode: BrushMode = alt ? otherMode(baseBrushMode(tool)) : baseBrushMode(tool);
        strokeRef.current = { points: [point], mode, radius: brushSizeRef.current / 2 / zoom };
        hoverRef.current = point;
        opt.e.preventDefault?.();
        canvas.requestRenderAll();
        return;
      }

      // Direct manipulation comes first and applies whether or not a tool is armed, which is what
      // makes the selection behave like Photoshop's: grab a handle to transform, press inside to
      // move it, press outside to start a new one.
      if (current) {
        const box = getShapeBBox(current);
        // Handles are hit-tested in scene space so they follow the shape's rotation.
        const handle = hitTestShapeHandle(current, point, HANDLE_HIT_PX / zoom, ROTATE_OFFSET_PX / zoom);

        if (handle === 'rot') {
          dragRef.current = {
            mode: 'rotate',
            shape: current,
            startPointer: angleFromCentre(box, point),
            startShapeAngle: getShapeAngle(current)
          };
          opt.e.preventDefault?.();
          return;
        }
        if (handle) {
          dragRef.current = { mode: 'resize', handle, shape: current, box };
          opt.e.preventDefault?.();
          return;
        }
        if (shapeContainsPoint(current, point)) {
          dragRef.current = { mode: 'move', origin: point, shape: current };
          opt.e.preventDefault?.();
          return;
        }
      }

      // Nothing to manipulate. Without a tool armed a click outside simply drops the selection.
      if (!tool) {
        if (current) {
          setSelection(null);
          selectionRef.current = null;
          canvas.requestRenderAll();
        }
        return;
      }

      opt.e.preventDefault?.();
      pinTargetFor(point);

      if (tool === 'sel-pen') {
        const current = draftRef.current as PathSelection | null;
        if (current && current.kind === 'path' && current.points.length >= 2) {
          // Clicking back on the first vertex closes the path, the usual pen-tool affordance.
          const zoom = canvas.getZoom() || 1;
          if (distanceToFirstPoint(current, point) < CLOSE_THRESHOLD_PX / zoom) {
            setSelection({ ...current, closed: true });
            setDraft(null);
            canvas.requestRenderAll();
            return;
          }
        }
        const next: PathSelection = current && current.kind === 'path'
          ? { ...current, points: [...current.points, point] }
          : { kind: 'path', points: [point], closed: false };
        setDraft(next);
        draftRef.current = next;
        canvas.requestRenderAll();
        return;
      }

      dragStartRef.current = point;
      // The object tool drags the same box as the marquee; what differs is what happens on release.
      const startShape: SelectionShape = tool === 'sel-ellipse'
        ? { kind: 'ellipse', x: point.x, y: point.y, width: 0, height: 0 }
        : { kind: 'rect', x: point.x, y: point.y, width: 0, height: 0 };
      setDraft(startShape);
      draftRef.current = startShape;
    };

    const onMove = (opt: any) => {
      const point = scenePoint(opt);

      if (isBrushTool(toolRef.current)) {
        hoverRef.current = point;
        const stroke = strokeRef.current;
        if (stroke) {
          const last = stroke.points[stroke.points.length - 1];
          // Skip points that add nothing: a swipe can fire hundreds of events, and every one of
          // them is a segment the mask has to rasterise and the tracer has to walk.
          const minStep = Math.max(0.5, stroke.radius * 0.15);
          if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= minStep) {
            stroke.points.push(point);
          }
        }
        canvas.requestRenderAll();
        if (stroke) { opt.e.preventDefault?.(); return; }
        return;
      }

      const drag = dragRef.current;
      if (drag) {
        let next: SelectionShape;
        if (drag.mode === 'move') {
          next = translateShape(drag.shape, point.x - drag.origin.x, point.y - drag.origin.y);
        } else if (drag.mode === 'resize') {
          // Resize in the shape's own unrotated frame, then keep the angle. Doing it in scene
          // space made a rotated box stretch along the screen axes instead of its own.
          const local = toLocalPoint(drag.shape, point);
          const resized = fitShapeToBBox(drag.shape, resizeBBox(drag.box, drag.handle, local));
          next = setShapeAngle(resized, getShapeAngle(drag.shape));
        } else {
          const box = getShapeBBox(drag.shape);
          const delta = angleFromCentre(box, point) - drag.startPointer;
          next = setShapeAngle(drag.shape, drag.startShapeAngle + delta);
        }
        setSelection(next);
        selectionRef.current = next;
        canvas.requestRenderAll();
        return;
      }

      // Hover feedback: the cursor names the gesture before the user commits to it.
      const current = selectionRef.current;
      if (!dragStartRef.current && current) {
        const zoom = canvas.getZoom() || 1;
        const handle = hitTestShapeHandle(current, point, HANDLE_HIT_PX / zoom, ROTATE_OFFSET_PX / zoom);
        const next = handle
          ? cursorForHandle(handle, getShapeAngle(current))
          : shapeContainsPoint(current, point)
            ? 'move'
            : (toolRef.current ? 'crosshair' : 'default');
        if (canvas.defaultCursor !== next) {
          canvas.defaultCursor = next;
          canvas.setCursor(next);
        }
      }

      const start = dragStartRef.current;
      const tool = toolRef.current;
      if (!start || !tool || tool === 'sel-pen') return;

      const next: SelectionShape = {
        kind: tool === 'sel-ellipse' ? 'ellipse' : 'rect',
        x: start.x,
        y: start.y,
        width: point.x - start.x,
        height: point.y - start.y
      };
      setDraft(next);
      draftRef.current = next;
      canvas.requestRenderAll();
    };

    const onUp = () => {
      const stroke = strokeRef.current;
      if (stroke) {
        strokeRef.current = null;
        applyStrokeRef.current?.(stroke);
        canvas.requestRenderAll();
        return;
      }

      if (dragRef.current) {
        dragRef.current = null;
        return;
      }
      const current = draftRef.current;
      const start = dragStartRef.current;
      dragStartRef.current = null;

      // The object tool never keeps the box it drew: the box is only the hint the model is given.
      // Drag = "find the object in here", tap = "find the object under my finger".
      if (toolRef.current === 'sel-object') {
        const run = autoSelectRef.current;
        if (!run) {
          setDraft(null);
          draftRef.current = null;
          canvas.requestRenderAll();
          return;
        }
        // 6 screen pixels of travel separate a deliberate box from the wobble in a tap, on a
        // mouse or a thumb. Divided by zoom, or the threshold would mean different gestures at
        // different zoom levels. A drawn box stays on screen, tinted, until the model answers -
        // otherwise the gesture vanishes into a silent pause and the tool reads as broken.
        const tapSlop = 6 / (canvas.getZoom() || 1);
        if (current && current.kind !== 'path' && !isDegenerate(current, tapSlop)) {
          void run({ region: getShapeBBox(current) });
        } else {
          setDraft(null);
          draftRef.current = null;
          canvas.requestRenderAll();
          if (start) void run({ point: start });
        }
        return;
      }

      if (!current || current.kind === 'path') return;

      // A stray click should not leave a zero-size selection behind.
      if (isDegenerate(current)) {
        setDraft(null);
        draftRef.current = null;
        canvas.requestRenderAll();
        return;
      }
      const box = getShapeBBox(current);
      const normalised: SelectionShape = { ...current, ...box };
      setSelection(normalised);
      setDraft(null);
      draftRef.current = null;
      canvas.requestRenderAll();
    };

    /** The swipe in progress, plus the size ring, both in scene space. */
    const drawBrushOverlay = (ctx: CanvasRenderingContext2D, zoom: number) => {
      const stroke = strokeRef.current;
      const adding = (stroke?.mode ?? baseBrushMode(toolRef.current)) === 'add';
      const tint = adding ? 'rgba(59,130,246,' : 'rgba(239,68,68,';

      if (stroke && stroke.points.length) {
        ctx.save();
        ctx.fillStyle = `${tint}0.35)`;
        ctx.strokeStyle = `${tint}0.35)`;
        ctx.lineWidth = stroke.radius * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        if (stroke.points.length === 1) {
          ctx.beginPath();
          ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // The ring is the only way to judge brush size before committing to a swipe, and it matters
      // more on touch, where there is no cursor at all.
      const at = stroke ? stroke.points[stroke.points.length - 1] : hoverRef.current;
      if (!at) return;
      const radius = (stroke ? stroke.radius : brushSizeRef.current / 2 / zoom);
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2 / zoom;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = adding ? '#60a5fa' : '#f87171';
      ctx.stroke();
      ctx.restore();
    };

    // Marching ants, drawn in scene space so the outline tracks the artwork through pan and zoom.
    const onAfterRender = () => {
      const shape = draftRef.current || selectionRef.current;
      const brushArmed = isBrushTool(toolRef.current);
      if (!shape && !brushArmed) return;

      const ctx = canvas.getContext();
      const vpt = canvas.viewportTransform;
      if (!ctx || !vpt) return;

      const zoom = canvas.getZoom() || 1;
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

      if (brushArmed) drawBrushOverlay(ctx, zoom);
      if (!shape) { ctx.restore(); return; }

      // Outline the layer the selection will act on. With overlapping copies of one image there is
      // otherwise nothing on screen saying which of them an operation is about to change.
      const target = targetImageRef.current?.();
      if (target) {
        const corners = target.getCoords?.();
        if (corners && corners.length === 4) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
          ctx.closePath();
          ctx.setLineDash([6 / zoom, 5 / zoom]);
          ctx.lineWidth = 1 / zoom;
          ctx.strokeStyle = 'rgba(56,189,248,0.75)';
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.beginPath();
      traceShape(ctx, shape);

      // Two passes: a dark base under a dashed light line stays visible on any artwork.
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.stroke();

      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.lineDashOffset = -antsOffsetRef.current / zoom;
      // Violet while a segmentation is in flight, so the pending box reads as working rather
      // than as a marquee the user is about to get.
      ctx.strokeStyle = autoBusyRef.current ? '#a78bfa' : '#ffffff';
      ctx.stroke();

      if (shape.kind === 'path' && !shape.closed) {
        for (const p of shape.points) {
          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.arc(p.x, p.y, 3 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();
        }
      }

      // Transform handles, drawn only for a committed selection so they do not flicker mid-drag.
      const committed = selectionRef.current;
      if (committed && !draftRef.current && !isBrushTool(toolRef.current)) {
        const size = HANDLE_SIZE_PX / zoom;
        const rotOffset = ROTATE_OFFSET_PX / zoom;
        // Rotated positions, so the box hugs the shape rather than its screen-aligned bounds.
        const positions = getShapeHandlePositions(committed, rotOffset);
        const angle = getShapeAngle(committed);

        ctx.setLineDash([]);
        ctx.lineWidth = 1.5 / zoom;

        // Stem from the top-centre handle to the rotate grip.
        ctx.beginPath();
        ctx.moveTo(positions.n.x, positions.n.y);
        ctx.lineTo(positions.rot.x, positions.rot.y);
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();

        // Outline of the transform box itself, which is not the same as the dashed selection
        // once the shape is a free-form path.
        ctx.beginPath();
        ctx.moveTo(positions.nw.x, positions.nw.y);
        ctx.lineTo(positions.ne.x, positions.ne.y);
        ctx.lineTo(positions.se.x, positions.se.y);
        ctx.lineTo(positions.sw.x, positions.sw.y);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(59,130,246,0.55)';
        ctx.stroke();

        const rad = (angle * Math.PI) / 180;
        for (const id of HANDLE_IDS) {
          const p = positions[id];
          // Rotate each handle so the squares line up with the box edges.
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(rad);
          ctx.beginPath();
          ctx.rect(-size / 2, -size / 2, size, size);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#3b82f6';
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(positions.rot.x, positions.rot.y, size / 1.6, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      ctx.restore();
    };

    canvas.on('mouse:down', onDown);
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:up', onUp);
    canvas.on('after:render', onAfterRender);

    return () => {
      canvas.off('mouse:down', onDown);
      canvas.off('mouse:move', onMove);
      canvas.off('mouse:up', onUp);
      canvas.off('after:render', onAfterRender);
    };
  }, [canvas]);

  // Animate the ants only while something is on screen, so an idle canvas stays idle.
  useEffect(() => {
    if (!selection && !draft && !isAutoSelecting) return;
    let raf = 0;
    const tick = () => {
      antsOffsetRef.current = (antsOffsetRef.current + 0.35) % 8;
      canvas?.requestRenderAll();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selection, draft, isAutoSelecting, canvas]);

  // Fabric must not run its own object targeting while a selection is live, or grabbing a handle
  // would start dragging the image underneath it instead of transforming the region. A live
  // selection captures interaction until it is dismissed, which is how Photoshop behaves too.
  useEffect(() => {
    if (!canvas) return;
    if (activeSelectionTool || selection) {
      const prevSelection = canvas.selection;
      const prevSkip = canvas.skipTargetFind;
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.defaultCursor = activeSelectionTool ? 'crosshair' : 'default';
      return () => {
        canvas.selection = prevSelection;
        canvas.skipTargetFind = prevSkip;
        canvas.defaultCursor = 'default';
      };
    }
  }, [activeSelectionTool, selection, canvas]);

  // Alt+Enter closes the pen path, Escape abandons whatever is in progress.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.altKey && e.key === 'Enter') {
        // Closing a pen path in progress wins; otherwise the shortcut converts whatever object is
        // selected on the canvas, which is what makes a painted brush shape into a selection.
        if (commitPenPath() || convertObjectToSelectionRef.current?.()) e.preventDefault();
      } else if (e.key === 'Escape') {
        if (draftRef.current || selectionRef.current) {
          e.preventDefault();
          clearSelection();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commitPenPath, clearSelection]);

  // Confine the object's filter stack to the selection while one is live, so adding a filter in
  // the Filter Studio affects the marked region only instead of the whole layer.
  // The key handler is registered before the converter exists, so it reaches it through a ref.
  const convertObjectToSelectionRef = useRef<((mode?: BrushMode) => boolean) | null>(null);
  const maskedImageRef = useRef<fabric.Image | null>(null);
  useEffect(() => {
    if (!canvas) return;

    const image = selection ? targetImageRef.current?.() ?? null : null;

    // Target changed (or the selection went away): unwrap whatever was wrapped before.
    if (maskedImageRef.current && maskedImageRef.current !== image) {
      detachRegionFilterMask(maskedImageRef.current);
      maskedImageRef.current = null;
      canvas.requestRenderAll();
    }

    if (!image) return;

    // The getter is read at render time, so moving or resizing the selection re-masks without
    // needing to re-attach.
    attachRegionFilterMask(image, () => selectionRef.current);
    maskedImageRef.current = image;
    canvas.requestRenderAll();
  }, [selection, canvas]);

  // Always unwrap on unmount, or the object would keep a patched applyFilters forever.
  useEffect(() => () => {
    if (maskedImageRef.current) {
      detachRegionFilterMask(maskedImageRef.current);
      maskedImageRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------- transform the selection
  /** Applies a geometric change to the active selection without touching any pixels. */
  const transformSelection = useCallback((fn: (shape: SelectionShape) => SelectionShape) => {
    const current = selectionRef.current;
    if (!current) return;
    const next = fn(current);
    setSelection(next);
    selectionRef.current = next;
    canvas?.requestRenderAll();
  }, [canvas]);

  const moveSelection = useCallback((dx: number, dy: number) =>
    transformSelection(shape => translateShape(shape, dx, dy)), [transformSelection]);

  const scaleSelection = useCallback((factor: number) =>
    transformSelection(shape => scaleShape(shape, factor)), [transformSelection]);

  const expandSelection = useCallback((amount: number) =>
    transformSelection(shape => expandShape(shape, amount)), [transformSelection]);

  const rotateSelection = useCallback((degrees: number) =>
    transformSelection(shape => rotateShape(shape, degrees)), [transformSelection]);

  /** Replaces the selection with the result of a combine, treating "nothing left" as a deselect. */
  const settleCombined = useCallback((next: SelectionShape | null) => {
    setSelection(next);
    selectionRef.current = next;
    setDraft(null);
    draftRef.current = null;
    canvas?.requestRenderAll();
  }, [canvas]);

  /**
   * Folds one finished brush swipe into the selection.
   *
   * Committing on release rather than continuously is what keeps this usable: one rasterise and
   * one re-trace per swipe instead of per pointer event, while the translucent overlay carries the
   * feedback during the drag.
   */
  const applyStroke = useCallback((stroke: { points: Point[]; mode: BrushMode; radius: number }) => {
    if (!stroke.points.length) return;
    const next = applyBrushStroke(
      selectionRef.current,
      { points: stroke.points, radius: stroke.radius },
      stroke.mode
    );
    settleCombined(next);
  }, [settleCombined]);

  useEffect(() => { applyStrokeRef.current = applyStroke; }, [applyStroke]);

  /**
   * Turns the object on the canvas into a selection - a shape painted with the paint brush, but
   * equally a polygon, a path or text.
   *
   * With a selection already live it combines rather than replaces, using the brush's own mode, so
   * a painted shape can extend or cut into what is selected exactly as a swipe would.
   */
  const convertObjectToSelection = useCallback((mode?: BrushMode): boolean => {
    if (!canvas) return false;
    const obj = canvas.getActiveObject();
    if (!obj) return false;

    const raster = rasterizeObject(obj);
    if (!raster) return false;

    const effective = mode || baseBrushMode(toolRef.current);
    const current = selectionRef.current;

    const next = current
      ? combineSelection(current, imageAddition(raster.canvas, raster.bounds), effective)
      : maskToSelection(
        raster.canvas.getContext('2d')!.getImageData(0, 0, raster.canvas.width, raster.canvas.height),
        {
          offset: { x: raster.bounds.x, y: raster.bounds.y },
          scale: raster.bounds.width / raster.canvas.width,
          tolerance: 1,
          smooth: 1,
          minRingAreaRatio: 0.002,
          maxRings: 64
        }
      );

    if (!next) return false;

    // Fabric must let go of the object, or the live selection's handles would fight with it.
    canvas.discardActiveObject();
    // The shape has become the selection, so the shape itself goes. The host routes this through
    // the undo stack, which is why it is a callback rather than a canvas.remove() here.
    onConsumeObject?.(obj);
    settleCombined(next);
    return true;
  }, [canvas, settleCombined, onConsumeObject]);

  useEffect(() => { convertObjectToSelectionRef.current = convertObjectToSelection; }, [convertObjectToSelection]);

  /**
   * Swaps the selected region for everything else on the layer.
   *
   * The layer's own edges are the boundary, not the canvas or the viewport: an inverted selection
   * has to mean "the rest of this image", which is the only reading that survives the layer being
   * moved, scaled or rotated afterwards.
   */
  const invertSelection = useCallback((): boolean => {
    const current = selectionRef.current;
    if (!current || !canvas) return false;

    // Inverting an inverted selection restores what was there before, rather than wrapping it in
    // another pair of rings. Even-odd would still resolve those to the right region, but the outer
    // ring stays in the outline, so the selection went on *looking* inverted after being undone.
    const state = invertStateRef.current;
    if (state.from && state.result === current) {
      const restored = state.from;
      invertStateRef.current = { from: null, result: restored };
      setIsInverted(false);
      setSelection(restored);
      selectionRef.current = restored;
      canvas.requestRenderAll();
      return true;
    }

    const image = targetImageRef.current?.();
    if (!image) return false;

    const width = image.width || 0;
    const height = image.height || 0;
    if (!width || !height) return false;

    // The layer's four corners, taken through its own transform so rotation and scale come along.
    const boundsShape = imagePixelsToSceneShape(
      shapeToPolygon({ kind: 'rect', x: 0, y: 0, width, height }),
      image
    );
    if (boundsShape.kind !== 'path') return false;

    const inverted = invertShape(current, boundsShape.points);
    if (!inverted) return false;

    invertStateRef.current = { from: current, result: inverted };
    setIsInverted(true);
    setSelection(inverted);
    selectionRef.current = inverted;
    canvas.requestRenderAll();
    return true;
  }, [canvas]);

  /**
   * Any other change - a new shape, a brush stroke, a transform - breaks the relationship the
   * stored original depends on, so the toggle drops back to "not inverted". Identity comparison is
   * enough because every path that changes the selection hands over a freshly built shape.
   */
  useEffect(() => {
    const state = invertStateRef.current;
    if (selection === state.result) return;
    if (state.from || state.result) invertStateRef.current = { from: null, result: null };
    setIsInverted(prev => (prev ? false : prev));
  }, [selection]);

  // ---------------------------------------------------------------- operations
  const targetImageRef = useRef<(() => fabric.Image | null) | null>(null);

  const targetImage = useCallback((): fabric.Image | null => {
    const active = canvas?.getActiveObject();
    if (active && active.type === 'image') return active as fabric.Image;

    // The layer pinned when this selection was drawn. It beats the overlap search below, which
    // cannot tell an original from a copy pasted on top of it.
    if (isLiveTarget(pinnedTargetRef.current)) return pinnedTargetRef.current;

    // Last resort: the topmost image the selection actually overlaps.
    const shape = selectionRef.current;
    if (!canvas || !shape) return null;
    const box = getShapeBBox(shape);
    const images = canvas.getObjects().filter(o => o.type === 'image' && o.visible);
    for (let i = images.length - 1; i >= 0; i--) {
      const b = images[i].getBoundingRect();
      const overlaps = box.x < b.left + b.width && b.left < box.x + box.width
        && box.y < b.top + b.height && b.top < box.y + box.height;
      if (overlaps) {
        // Remember it, so every later operation in this selection agrees with this one.
        pinnedTargetRef.current = images[i] as fabric.Image;
        return images[i] as fabric.Image;
      }
    }
    return null;
  }, [canvas, isLiveTarget]);

  useEffect(() => { targetImageRef.current = targetImage; }, [targetImage]);
  useEffect(() => { isLiveTargetRef.current = isLiveTarget; }, [isLiveTarget]);
  useEffect(() => { imageAtPointRef.current = imageAtPoint; }, [imageAtPoint]);

  /**
   * The image an auto-select should run against.
   *
   * `targetImage` needs an existing selection to fall back on, which is exactly what is missing
   * before the first auto-select. Resolving from the click point, then the topmost image, is what
   * lets the tool work on a first tap with nothing selected at all.
   */
  const pickImageFor = useCallback((scenePoint?: Point | null): fabric.Image | null => {
    if (!canvas) return null;
    const active = canvas.getActiveObject();
    if (active && active.type === 'image') return active as fabric.Image;

    // A tap names its own layer; otherwise stay on whichever layer this selection already belongs
    // to rather than silently hopping to the topmost one.
    if (!scenePoint && isLiveTarget(pinnedTargetRef.current)) return pinnedTargetRef.current;

    const images = canvas.getObjects().filter(o => o.type === 'image' && o.visible);
    if (!images.length) return null;

    if (scenePoint) {
      for (let i = images.length - 1; i >= 0; i--) {
        const b = images[i].getBoundingRect();
        if (scenePoint.x >= b.left && scenePoint.x <= b.left + b.width
          && scenePoint.y >= b.top && scenePoint.y <= b.top + b.height) {
          return images[i] as fabric.Image;
        }
      }
    }
    return images[images.length - 1] as fabric.Image;
  }, [canvas, isLiveTarget]);

  const cancelAutoSelect = useCallback(() => {
    autoAbortRef.current?.abort();
    autoAbortRef.current = null;
    // Reset here as well as in the request's finally: if the queue ever resolves a cancelled job
    // instead of rejecting it, the UI must still come back rather than hang on a spinner.
    autoBusyRef.current = false;
    setIsAutoSelecting(false);
    setAutoSelectStage(null);
    setDraft(null);
    draftRef.current = null;
    canvas?.requestRenderAll();
  }, [canvas]);

  /**
   * Segments an object and turns the result into an ordinary selection.
   *
   * Everything downstream - move, transform, delete, fill, mask, region filters - already works on
   * a path, so vectorising the mask here is what makes the AI result a first-class selection
   * rather than a separate one-shot feature.
   */
  const autoSelectObject = useCallback(async (request: AutoSelectRequest = {}): Promise<boolean> => {
    if (!canvas) return false;
    if (!segmentSubject) {
      setAutoSelectError('No segmentation model is wired up.');
      return false;
    }

    const image = pickImageFor(request.point);
    // Whatever the run resolved to is the layer the resulting selection belongs to.
    if (image) pinnedTargetRef.current = image;
    if (!image) {
      setAutoSelectError('Add or select an image layer first.');
      return false;
    }

    // Only one run at a time; a second request supersedes whatever is still in flight.
    autoAbortRef.current?.abort();
    const controller = new AbortController();
    autoAbortRef.current = controller;
    setAutoSelectError(null);
    setAutoSelectStage({ state: 'queued', progress: 0 });
    setIsAutoSelecting(true);
    autoBusyRef.current = true;

    try {
      // Map the scene-space hints into the image's own pixel grid before touching any pixels.
      let pixelRegion: BBox | null = null;
      if (request.region && request.region.width > 1 && request.region.height > 1) {
        // Polygonised first: mapping a rect maps only two corners, which on a rotated layer
        // describes a different box than the one the user actually dragged.
        const asShape = shapeToPolygon({ kind: 'rect', ...request.region });
        pixelRegion = getShapeBBox(sceneShapeToImagePixels(asShape, image));
        // A little margin gives the model context beyond the object's own edge, which measurably
        // helps a saliency model decide where that edge is.
        const pad = Math.max(4, Math.min(pixelRegion.width, pixelRegion.height) * 0.06);
        pixelRegion = {
          x: pixelRegion.x - pad, y: pixelRegion.y - pad,
          width: pixelRegion.width + pad * 2, height: pixelRegion.height + pad * 2
        };
      }

      const read = readImagePixels(image, pixelRegion);
      if (!read) throw new Error('Could not read the layer pixels.');

      const mask = await segmentSubject(read.pixels, controller.signal, (state, progress) => {
        // Arming the tool and tapping the canvas bypasses the download gate, so a missing model
        // would otherwise be fetched in total silence. Reporting the stage is what makes that
        // download visible - and cancellable - from inside the tool itself.
        if (!controller.signal.aborted) setAutoSelectStage({ state, progress });
      });
      if (controller.signal.aborted) return false;

      let seed: Point | null = null;
      if (request.point) {
        const asShape: SelectionShape = { kind: 'rect', x: request.point.x, y: request.point.y, width: 0, height: 0 };
        const local = getShapeBBox(sceneShapeToImagePixels(asShape, image));
        seed = { x: local.x - read.offset.x, y: local.y - read.offset.y };
      }

      const detail = DETAIL_SETTINGS[request.detail || 'balanced'];
      const localShape = maskToSelection(mask, {
        seed,
        offset: read.offset,
        tolerance: detail.tolerance,
        smooth: detail.smooth
      });

      if (!localShape) {
        setAutoSelectError('No object found. Try drawing a box around it.');
        return false;
      }

      const sceneShape = imagePixelsToSceneShape(localShape, image);
      setSelection(sceneShape);
      selectionRef.current = sceneShape;
      return true;
    } catch (e: any) {
      // An aborted run is a user action, not a failure worth reporting.
      const aborted = controller.signal.aborted || /abort|cancel/i.test(e?.message || '');
      if (!aborted) {
        console.error('[useImageSelection] auto-select failed', e);
        setAutoSelectError(e?.message || 'Object selection failed.');
      }
      return false;
    } finally {
      if (autoAbortRef.current === controller) autoAbortRef.current = null;
      autoBusyRef.current = false;
      // The pending box goes on every path - found, failed or cancelled - so a run can never
      // leave a stray rectangle behind.
      setDraft(null);
      draftRef.current = null;
      setIsAutoSelecting(false);
      setAutoSelectStage(null);
      canvas.requestRenderAll();
    }
  }, [canvas, segmentSubject, pickImageFor]);

  useEffect(() => { autoSelectRef.current = autoSelectObject; }, [autoSelectObject]);

  // Never leave a request running once the workspace is gone.
  useEffect(() => () => { autoAbortRef.current?.abort(); }, []);

  /**
   * `extra` lets a caller fold non-pixel state into the same undo entry, so baking a filter stack
   * is one step rather than a pixel change and a stack change that can be undone apart.
   */
  const runOperation = useCallback(async (
    op: SelectionOperation,
    label: string,
    extra?: { apply: () => void; revert: () => void }
  ) => {
    const shape = selectionRef.current;
    const image = targetImage();
    if (!canvas || !shape || !image) return false;

    const dataUrl = applyOperationToImage(image, shape, op);
    if (!dataUrl) return false;

    const previous = await swapImageSource(image, dataUrl);
    extra?.apply();
    canvas.requestRenderAll();

    if (previous && onCommit) {
      onCommit(
        label,
        async () => {
          await swapImageSource(image, previous);
          extra?.revert();
          canvas.requestRenderAll();
        },
        async () => {
          await swapImageSource(image, dataUrl);
          extra?.apply();
          canvas.requestRenderAll();
        }
      );
    }
    return true;
  }, [canvas, targetImage, onCommit]);

  const deleteSelectedPixels = useCallback(() => runOperation({ type: 'delete' }, 'Delete Selection'), [runOperation]);
  const fillSelection = useCallback((color: string) => runOperation({ type: 'fill', color }, 'Fill Selection'), [runOperation]);
  const replaceSelection = useCallback(
    (image: CanvasImageSource, fit: 'cover' | 'contain' | 'stretch' = 'cover') =>
      runOperation({ type: 'replace', image, fit }, 'Replace Selection'),
    [runOperation]
  );

  /** Re-renders only the selected pixels through a filter. */
  const filterSelection = useCallback(
    (filter: RegionFilter, value: number) =>
      runOperation({ type: 'filter', filter, value }, `Filter Selection: ${filter}`),
    [runOperation]
  );

  /**
   * Bakes whatever is currently rendered for the image (including the whole fabric filter stack)
   * into the selected region only, then drops the object-wide filters so the rest is untouched.
   */
  const applyFilterStackToSelection = useCallback(async () => {
    const shape = selectionRef.current;
    const image = targetImage();
    if (!canvas || !shape || !image) return false;

    const filtered = (image as any)._element as CanvasImageSource | undefined;
    const original = (image as any)._originalElement as CanvasImageSource | undefined;
    // Fabric keeps the filtered result in _element and the pristine pixels in _originalElement.
    // With no filters applied the two are the same object and there is nothing to bake.
    if (!filtered || !original || filtered === original) return false;

    const before = ((image as any).customFilters || []) as any[];
    // The stack stays in the panel as a record of what was baked. Each entry is switched off and
    // marked, so it cannot run again on top of the pixels it just produced, but is still there to
    // read, re-enable or save as a preset.
    const after = before.map(f => ({ ...f, enabled: false, baked: true }));

    const ok = await runOperation(
      { type: 'composite', source: filtered },
      'Bake Filters into Region',
      {
        apply: () => {
          detachRegionFilterMask(image);
          if (maskedImageRef.current === image) maskedImageRef.current = null;
          (image as any).customFilters = after;
          image.filters = [];
          image.applyFilters();
        },
        revert: () => {
          (image as any).customFilters = before;
          rebuildFilters?.(image);
        }
      }
    );
    return ok;
  }, [canvas, targetImage, runOperation, rebuildFilters]);

  /** Lifts the selected pixels onto the canvas as their own image object. */
  const copySelectionToLayer = useCallback(async () => {
    const shape = selectionRef.current;
    const image = targetImage();
    if (!canvas || !shape || !image) return null;

    const cut = extractFromImage(image, shape);
    if (!cut) return null;

    const box = getShapeBBox(shape);
    const created = await fabric.Image.fromURL(cut.dataUrl, { crossOrigin: 'anonymous' });
    created.set({
      left: box.x,
      top: box.y,
      originX: 'left',
      originY: 'top',
      // Match the on-screen size of the region that was lifted.
      scaleX: box.width / (created.width || box.width),
      scaleY: box.height / (created.height || box.height),
      artboardId: (image as any).artboardId
    } as any);
    canvas.add(created);
    canvas.setActiveObject(created);

    // The copy is now its own object and is what the user wants to manipulate; leaving the marquee
    // up would suggest the next operation still applies to the region it came from.
    pinnedTargetRef.current = null;
    setSelection(null);
    selectionRef.current = null;
    setDraft(null);
    draftRef.current = null;
    setActiveSelectionTool(null);

    canvas.requestRenderAll();
    return created;
  }, [canvas, targetImage]);

  return {
    activeSelectionTool,
    setActiveSelectionTool,
    selection,
    draft,
    hasSelection: !!selection,
    clearSelection,
    commitPenPath,
    savedShapes,
    saveCurrentShape,
    loadSavedShape,
    deleteSavedShape,
    deleteSelectedPixels,
    fillSelection,
    replaceSelection,
    filterSelection,
    applyFilterStackToSelection,
    /** The image the selection currently acts on, for panels that need it as a filter target. */
    getSelectionTargetImage: targetImage,
    autoSelectObject,
    cancelAutoSelect,
    isAutoSelecting,
    autoSelectStage,
    autoSelectError,
    clearAutoSelectError: () => setAutoSelectError(null),
    copySelectionToLayer,
    moveSelection,
    scaleSelection,
    expandSelection,
    rotateSelection,
    invertSelection,
    /** True while the selection is showing the inverse of what was drawn. */
    isInverted,
    /** Which way a swipe will push the selection, decided by the armed tool. */
    brushMode: baseBrushMode(activeSelectionTool),
    brushSize,
    setBrushSize: (px: number) => setBrushSize(Math.max(MIN_BRUSH_PX, Math.min(MAX_BRUSH_PX, px))),
    minBrushSize: MIN_BRUSH_PX,
    maxBrushSize: MAX_BRUSH_PX,
    convertObjectToSelection
  };
}
