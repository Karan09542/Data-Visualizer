import * as fabric from 'fabric';
import { EraserEngine } from './EraserEngine';
import { DEFAULT_ERASER_SETTINGS, EraseStroke, EraserSettings } from './types';

interface AttachedTarget {
  engine: EraserEngine;
  /** The untouched pixels, kept so re-attaching never treats output as input. */
  source: CanvasImageSource;
}

export interface FabricEraserOptions {
  /** Fired once per completed stroke - the hook for pushing an undo command. */
  onStrokeCommitted?: (
    image: fabric.Image,
    stroke: EraseStroke,
    engine: EraserEngine,
  ) => void;
  /** Fired when a stroke starts, e.g. to close panels or mark the doc dirty. */
  onStrokeStart?: (image: fabric.Image) => void;
  /**
   * Return true to let a pointer press through untouched. The host uses this
   * for its own modifier gestures - space/alt to pan, for instance - which the
   * eraser must not swallow.
   */
  isPointerBlocked?: (event: PointerEvent | MouseEvent | TouchEvent) => boolean;
  /** If false, FabricEraser leaves cursor ring management to the host application. */
  showCursorRing?: boolean;
}

/**
 * Binds an EraserEngine to images on a fabric canvas.
 *
 * Knows about fabric and pointer input; knows nothing about React or about the
 * host application's history stack. Commit callbacks are the only outbound
 * dependency, so the same adapter works under any state management.
 */
export class FabricEraser {
  private canvas: fabric.Canvas;
  private options: FabricEraserOptions;
  private targets = new Map<fabric.Image, AttachedTarget>();

  private settings: EraserSettings = { ...DEFAULT_ERASER_SETTINGS };
  private enabled = false;
  private painting: fabric.Image | null = null;

  /** Canvas flags captured on enable so disable can restore them exactly. */
  private previousSelection = true;
  private previousSkipTargetFind = false;
  private previousCursor = 'default';

  /** Brush-size ring, as a DOM overlay rather than a CSS cursor. */
  private ring: HTMLDivElement | null = null;
  /** Cached wrapper box; reading it per pointer move forces a layout. */
  private wrapperRect: DOMRect | null = null;
  private ringRaf = 0;
  private pendingRing: { x: number; y: number } | null = null;
  /** The ring only belongs on screen while the pointer is over the canvas. */
  private pointerInside = false;
  private invalidateRect = () => { this.wrapperRect = null; };

  private boundDown = (opt: any) => this.handleDown(opt);
  private boundMove = (opt: any) => this.handleMove(opt);
  private boundUp = () => this.handleUp();
  private boundOut = () => this.hideRing();

  constructor(canvas: fabric.Canvas, options: FabricEraserOptions = {}) {
    this.canvas = canvas;
    this.options = options;
  }

  // ------------------------------------------------------------- attachment

  /**
   * Routes an image through an eraser engine. Idempotent: calling it twice on
   * the same image returns the existing engine rather than resetting edits.
   */
  attach(image: fabric.Image): EraserEngine {
    const existing = this.targets.get(image);
    if (existing) return existing.engine;

    const element = image.getElement() as any;
    const width = element?.naturalWidth || element?.width || image.width || 1;
    const height = element?.naturalHeight || element?.height || image.height || 1;

    const engine = new EraserEngine(element as CanvasImageSource, width, height);
    this.targets.set(image, { engine, source: element as CanvasImageSource });

    image.setElement(engine.canvas as any);
    image.set({ dirty: true });
    this.canvas.requestRenderAll();

    return engine;
  }

  getEngine(image: fabric.Image): EraserEngine | undefined {
    return this.targets.get(image)?.engine;
  }

  /** Puts the original pixels back and forgets the image's erase history. */
  detach(image: fabric.Image, restoreSource = true): void {
    const target = this.targets.get(image);
    if (!target) return;

    if (restoreSource) {
      image.setElement(target.source as any);
      image.set({ dirty: true });
      this.canvas.requestRenderAll();
    }
    target.engine.destroy();
    this.targets.delete(image);
  }

  detachAll(restoreSource = false): void {
    Array.from(this.targets.keys()).forEach((image) =>
      this.detach(image, restoreSource),
    );
  }

  // ---------------------------------------------------------------- settings

  setSettings(settings: Partial<EraserSettings>): void {
    this.settings = { ...this.settings, ...settings };
    // Size can change while the pointer is still - the size HUD gesture, the
    // slider, Ctrl+wheel - and the ring must follow immediately rather than
    // waiting for the next move, or it disagrees with the size being shown.
    if (this.enabled) this.paintRing();
  }

  getSettings(): EraserSettings {
    return { ...this.settings };
  }

  // ------------------------------------------------------------------ toggle

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    this.previousSelection = this.canvas.selection;
    this.previousSkipTargetFind = this.canvas.skipTargetFind;
    this.previousCursor = this.canvas.defaultCursor;

    // Fabric must not hit-test while erasing, or dragging across an image
    // would move it. The eraser resolves its own target instead.
    this.canvas.selection = false;
    this.canvas.skipTargetFind = true;
    this.canvas.discardActiveObject();

    this.canvas.on('mouse:down', this.boundDown);
    this.canvas.on('mouse:move', this.boundMove);
    this.canvas.on('mouse:up', this.boundUp);
    this.canvas.on('mouse:out', this.boundOut);

    // The cached wrapper box is only valid while the page geometry holds still.
    this.wrapperRect = null;
    window.addEventListener('resize', this.invalidateRect);
    window.addEventListener('scroll', this.invalidateRect, true);

    // The ring replaces the pointer entirely, so the OS cursor is hidden.
    this.canvas.defaultCursor = 'none';
    this.canvas.setCursor('none');
    this.canvas.requestRenderAll();
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    if (this.painting) {
      const engine = this.targets.get(this.painting)?.engine;
      engine?.cancelStroke();
      this.painting = null;
    }

    this.canvas.off('mouse:down', this.boundDown);
    this.canvas.off('mouse:move', this.boundMove);
    this.canvas.off('mouse:up', this.boundUp);
    this.canvas.off('mouse:out', this.boundOut);

    window.removeEventListener('resize', this.invalidateRect);
    window.removeEventListener('scroll', this.invalidateRect, true);

    if (this.ringRaf) {
      cancelAnimationFrame(this.ringRaf);
      this.ringRaf = 0;
    }
    this.pendingRing = null;
    this.wrapperRect = null;
    this.removeRing();

    this.canvas.selection = this.previousSelection;
    this.canvas.skipTargetFind = this.previousSkipTargetFind;
    this.canvas.defaultCursor = this.previousCursor;
    this.canvas.requestRenderAll();
  }

  dispose(): void {
    this.disable();
    this.detachAll(false);
  }

  // ----------------------------------------------------------------- pointer

  private handleDown(opt: any): void {
    if (!this.enabled) return;
    const event = opt?.e;
    if (!event || (event.button !== undefined && event.button !== 0)) return;
    if (this.options.isPointerBlocked?.(event)) return;
    // A second finger means pinch-zoom, not erasing.
    if (this.touchCount(event) > 1) return;
    this.wrapperRect = null;

    const scenePoint = this.canvas.getScenePoint(event);
    const image = this.findImageAt(scenePoint);
    if (!image) return;

    const engine = this.attach(image);
    const local = this.toImageSpace(image, scenePoint);
    if (!local) return;

    this.painting = image;
    this.options.onStrokeStart?.(image);
    // The stroke keeps its size in image pixels, so undo/replay stay correct
    // even if the image is rescaled on the canvas afterwards.
    engine.beginStroke(
      { ...local, pressure: this.pressureOf(event) },
      { ...this.settings, size: this.toImagePixels(image, this.settings.size) },
    );
    this.refresh(image);
  }

  private handleMove(opt: any): void {
    if (!this.enabled) return;
    const event = opt?.e;
    if (!event) return;

    // A pinch starting mid-stroke is a zoom gesture, so drop what was drawn
    // rather than smearing an erase across the canvas as the fingers move.
    if (this.touchCount(event) > 1) {
      this.hideRing();
      if (this.painting) {
        this.targets.get(this.painting)?.engine.cancelStroke();
        this.refresh(this.painting);
        this.painting = null;
      }
      return;
    }

    this.moveRing(event);
    if (!this.painting) return;

    const engine = this.targets.get(this.painting)?.engine;
    if (!engine) return;

    const scenePoint = this.canvas.getScenePoint(event);
    const local = this.toImageSpace(this.painting, scenePoint);
    if (!local) return;

    engine.extendStroke({ ...local, pressure: this.pressureOf(event) });
    this.refresh(this.painting);
  }

  private handleUp(): void {
    if (!this.enabled || !this.painting) return;

    const image = this.painting;
    this.painting = null;

    const engine = this.targets.get(image)?.engine;
    if (!engine) return;

    const stroke = engine.endStroke();
    this.refresh(image);
    if (stroke) this.options.onStrokeCommitted?.(image, stroke, engine);
  }

  private touchCount(event: any): number {
    if (event.touches) return event.touches.length;
    return 0;
  }

  private pressureOf(event: any): number {
    // Pointer events report 0.5 for mouse and 0 for a mouse button that is not
    // pressure sensitive, neither of which should thin the brush.
    const pressure = typeof event.pressure === 'number' ? event.pressure : 1;
    if (event.pointerType && event.pointerType !== 'pen') return 1;
    return pressure > 0 ? pressure : 1;
  }

  // ------------------------------------------------------------------ geometry

  /** Topmost erasable image containing the point, ignoring fabric hit-testing. */
  private findImageAt(scenePoint: fabric.Point): fabric.Image | null {
    const objects = this.canvas.getObjects();
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i] as any;
      if (!obj.visible || obj.type !== 'image') continue;
      if (obj.isCropHelper) continue;
      try {
        if (obj.containsPoint(scenePoint)) return obj as fabric.Image;
      } catch {
        // containsPoint can throw on objects mid-transform; skip them.
      }
    }
    return null;
  }

  /**
   * Scene coordinates to the image's own pixel grid, so erasing stays aligned
   * no matter how the image is scaled, rotated or flipped on the canvas.
   */
  private toImageSpace(
    image: fabric.Image,
    scenePoint: fabric.Point,
  ): { x: number; y: number } | null {
    try {
      const inverse = fabric.util.invertTransform(image.calcTransformMatrix());
      const local = fabric.util.transformPoint(scenePoint, inverse);
      return {
        x: local.x + (image.width ?? 0) / 2,
        y: local.y + (image.height ?? 0) / 2,
      };
    } catch {
      return null;
    }
  }

  /**
   * Brush sizes are authored in scene units so the on-screen ring matches what
   * gets removed. The engine works in the image's own pixel grid, which is a
   * different scale whenever the image is not placed at 100%.
   */
  private toImagePixels(image: fabric.Image, sceneSize: number): number {
    try {
      const decomposed = fabric.util.qrDecompose(image.calcTransformMatrix());
      const scaleX = Math.abs(decomposed.scaleX) || 1;
      const scaleY = Math.abs(decomposed.scaleY) || 1;
      // A round screen brush is an ellipse in image space under non-uniform
      // scaling; the mean keeps it round and close enough on both axes.
      const scale = (scaleX + scaleY) / 2;
      return sceneSize / (scale || 1);
    } catch {
      return sceneSize;
    }
  }

  private refresh(image: fabric.Image): void {
    image.set({ dirty: true });
    this.canvas.requestRenderAll();
  }

  /**
   * Brush-size ring, drawn as an element over the canvas wrapper.
   *
   * A CSS cursor cannot do this job: browsers refuse cursor images past about
   * 128px, so any larger brush would draw a ring smaller than the area it
   * erases - the exact mismatch this tool has to avoid.
   */
  private ensureRing(): HTMLDivElement | null {
    if (this.options.showCursorRing === false) return null;
    if (this.ring) return this.ring;

    const wrapper = (this.canvas as any).wrapperEl as HTMLElement | undefined;
    if (!wrapper) return null;

    const el = document.createElement('div');
    el.setAttribute('data-eraser-ring', '');
    el.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'display:none',
      'pointer-events:none',
      'border-radius:50%',
      'border:1.5px solid rgba(255,255,255,0.95)',
      'box-shadow:0 0 0 1px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.35)',
      'transform:translate(-50%,-50%)',
      'will-change:left,top,width,height',
      'z-index:10',
    ].join(';');

    wrapper.appendChild(el);
    this.ring = el;
    return el;
  }

  /**
   * Queues a ring update for the next frame. Pointer and touch events fire
   * faster than the screen repaints, and each update writes styles, so doing
   * the work per event is wasted and shows up as input lag.
   */
  private moveRing(event: any): void {
    if (this.options.showCursorRing === false) return;
    const touch = event.touches && event.touches[0];
    const clientX = event.clientX ?? touch?.clientX;
    const clientY = event.clientY ?? touch?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    this.pendingRing = { x: clientX, y: clientY };
    this.pointerInside = true;
    if (this.ringRaf) return;

    this.ringRaf = requestAnimationFrame(() => {
      this.ringRaf = 0;
      this.paintRing();
    });
  }

  private paintRing(): void {
    if (this.options.showCursorRing === false) return;
    const point = this.pendingRing;
    // Adjusting size from the properties panel must not summon the ring back
    // onto the canvas at whatever spot the pointer last left it.
    if (!point || !this.pointerInside) return;

    const el = this.ensureRing();
    const wrapper = (this.canvas as any).wrapperEl as HTMLElement | undefined;
    if (!el || !wrapper) return;

    if (!this.wrapperRect) this.wrapperRect = wrapper.getBoundingClientRect();
    const bounds = this.wrapperRect;

    const diameter = Math.max(2, this.settings.size * (this.canvas.getZoom() || 1));
    const isRestore = this.settings.mode === 'restore';

    el.style.width = diameter + 'px';
    el.style.height = diameter + 'px';
    el.style.left = point.x - bounds.left + 'px';
    el.style.top = point.y - bounds.top + 'px';
    el.style.borderColor = isRestore
      ? 'rgba(96,165,250,0.95)'
      : 'rgba(255,255,255,0.95)';
    el.style.display = 'block';
  }

  private hideRing(): void {
    this.pointerInside = false;
    if (this.ring) this.ring.style.display = 'none';
  }

  private removeRing(): void {
    this.ring?.parentElement?.removeChild(this.ring);
    this.ring = null;
  }

  /** Call after a zoom or layout change so the ring re-measures and resizes. */
  refreshCursor(): void {
    if (this.options.showCursorRing === false) return;
    if (!this.enabled) {
      this.hideRing();
      return;
    }
    this.wrapperRect = null;
    this.paintRing();
  }
}
