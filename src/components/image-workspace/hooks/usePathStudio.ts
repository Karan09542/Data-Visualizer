import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type { SelectionShape } from '../selection/types';
import {
  ALONG_SHAPES,
  AlongShapeId,
  ItemOptions,
  PathTextOptions,
  SpreadOptions,
  buildItems,
  buildTextOnPath,
  geometryFromShape,
  ringArea,
  spreadAlong,
} from '../services/path/alongPath';
import { AddObjectsCommand } from '../commands/object/AddObjectsCommand';

/**
 * Path Studio: takes the path drawn with the selection tools and lays something out along it -
 * shapes, emoji, a picture, or a line of text.
 *
 * The preview is drawn straight onto the canvas each frame rather than added to it, so nothing
 * appears in the layers list, nothing can be selected by accident, and leaving the panel leaves no
 * trace. Apply builds the same objects again and adds them in one undoable step.
 */

/** A drawn line has almost no area; an outline has plenty. Below this it is treated as a line. */
const LOOP_AREA = 400;
const MAX_ITEMS = 400;

export type PathClosing = 'auto' | 'open' | 'loop';
export type PathMode = 'repeat' | 'text';

export const PATH_FONTS = ['Inter', 'Georgia', 'Impact', 'Courier New', 'Brush Script MT', 'Times New Roman'];

export function usePathStudio(
  canvas: fabric.Canvas | null,
  activeTab: string,
  executeCommand: (cmd: any) => void,
  selection: SelectionShape | null,
  artboardId?: string | null,
) {
  const isOpen = activeTab === 'path-studio';

  /* ── What goes along the path ─────────────────────────────────────────── */
  const [mode, setMode] = useState<PathMode>('repeat');
  const [kind, setKind] = useState<ItemOptions['kind']>('shape');
  const [shapeId, setShapeId] = useState<AlongShapeId>('circle');
  const [emoji, setEmoji] = useState('✨');
  const [image, setImage] = useState<{ element: HTMLImageElement | HTMLCanvasElement; name: string } | null>(null);
  const [size, setSize] = useState(28);
  const [fill, setFill] = useState('#3b82f6');
  const [stroke, setStroke] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [rotateWithPath, setRotateWithPath] = useState(true);
  const [extraAngle, setExtraAngle] = useState(0);

  /* ── How they are spread ──────────────────────────────────────────────── */
  const [spreadMode, setSpreadMode] = useState<SpreadOptions['mode']>('spacing');
  const [spacing, setSpacing] = useState(48);
  const [count, setCount] = useState(12);
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(0);
  const [offsetAlong, setOffsetAlong] = useState(0);
  const [sideOffset, setSideOffset] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [jitterPosition, setJitterPosition] = useState(0);
  const [jitterSize, setJitterSize] = useState(0);
  const [jitterAngle, setJitterAngle] = useState(0);
  const [seed, setSeed] = useState(1);

  /* ── The path itself ──────────────────────────────────────────────────── */
  const [closing, setClosing] = useState<PathClosing>('auto');
  const [reverse, setReverse] = useState(false);
  const [groupItems, setGroupItems] = useState(true);

  /* ── Text along the path ──────────────────────────────────────────────── */
  const [text, setText] = useState('Your text here');
  const [fontFamily, setFontFamily] = useState(PATH_FONTS[0]);
  const [fontSize, setFontSize] = useState(36);
  const [fontWeight, setFontWeight] = useState('700');
  const [charSpacing, setCharSpacing] = useState(0);
  const [textSide, setTextSide] = useState<'left' | 'right'>('left');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textStart, setTextStart] = useState(0);

  const [appliedAt, setAppliedAt] = useState(0);

  /* ── The route ────────────────────────────────────────────────────────── */
  const isLoopByDefault = useMemo(() => {
    if (!selection) return true;
    if (selection.kind !== 'path') return true;
    return ringArea(selection.points) > LOOP_AREA;
  }, [selection]);
  const closed = closing === 'auto' ? isLoopByDefault : closing === 'loop';

  const geometry = useMemo(
    () => geometryFromShape(selection, { closed, reverse }),
    [selection, closed, reverse],
  );

  const itemOptions: ItemOptions = useMemo(() => ({
    kind, shapeId, emoji, image: image?.element ?? null, size, fill, stroke, strokeWidth, opacity,
    rotateWithPath, extraAngle,
  }), [kind, shapeId, emoji, image, size, fill, stroke, strokeWidth, opacity, rotateWithPath, extraAngle]);

  const spreadOptions: SpreadOptions = useMemo(() => ({
    mode: spreadMode, spacing, count, startTrim, endTrim, offsetAlong, sideOffset, alternate,
    jitterPosition, jitterSize, jitterAngle, seed, maxItems: MAX_ITEMS,
  }), [spreadMode, spacing, count, startTrim, endTrim, offsetAlong, sideOffset, alternate, jitterPosition, jitterSize, jitterAngle, seed]);

  const textOptions: PathTextOptions = useMemo(() => ({
    text, fontFamily, fontSize, fontWeight, charSpacing, fill, stroke, strokeWidth, opacity,
    side: textSide, align: textAlign, startOffset: textStart,
  }), [text, fontFamily, fontSize, fontWeight, charSpacing, fill, stroke, strokeWidth, opacity, textSide, textAlign, textStart]);

  /** Builds what goes on the canvas. The preview and Apply both come through here. */
  const build = useCallback((): fabric.Object[] => {
    if (!geometry) return [];
    if (mode === 'text') {
      const built = buildTextOnPath(geometry, textOptions);
      return built ? [built] : [];
    }
    return buildItems(spreadAlong(geometry, spreadOptions), itemOptions);
  }, [geometry, mode, textOptions, spreadOptions, itemOptions]);

  const preview = useMemo(() => (isOpen ? build() : []), [isOpen, build]);
  const previewRef = useRef<fabric.Object[]>(preview);
  previewRef.current = preview;

  /* ── Drawn over the canvas, never added to it ─────────────────────────── */
  useEffect(() => {
    if (!canvas || !isOpen) return;
    const onAfterRender = () => {
      const objects = previewRef.current;
      if (!objects.length) return;
      const ctx = canvas.getContext();
      const vpt = canvas.viewportTransform;
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      for (const obj of objects) {
        obj.setCoords();
        obj.render(ctx);
      }
      ctx.restore();
    };
    canvas.on('after:render', onAfterRender);
    canvas.requestRenderAll();
    return () => {
      canvas.off('after:render', onAfterRender);
      canvas.requestRenderAll();
    };
  }, [canvas, isOpen]);

  // Anything that changes the preview redraws it.
  useEffect(() => {
    if (canvas && isOpen) canvas.requestRenderAll();
  }, [canvas, isOpen, preview]);

  /* ── Pictures ─────────────────────────────────────────────────────────── */
  const pickImageFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const el = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
      if (el) {
        setImage({ element: el, name: file.name });
        setKind('image');
      }
    } finally {
      // The element keeps its own decoded copy, so the object URL is no longer needed.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, []);

  /** Uses the picture that is selected on the canvas, so nothing has to be uploaded twice. */
  const useSelectedImage = useCallback(() => {
    const active = canvas?.getActiveObject();
    if (!active || !(active instanceof fabric.FabricImage)) return false;
    const element = (active as any)._element as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!element) return false;
    setImage({ element, name: (active as any).customName || 'Selected image' });
    setKind('image');
    return true;
  }, [canvas]);

  /* ── Apply ────────────────────────────────────────────────────────────── */
  const apply = useCallback(() => {
    if (!canvas) return;
    const objects = build();
    if (!objects.length) return;

    for (const obj of objects) {
      (obj as any).id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      (obj as any).artboardId = artboardId ?? undefined;
      obj.objectCaching = true;
    }

    const label = mode === 'text' ? 'Text on path' : `${objects.length} along path`;
    let added = objects;
    if (mode === 'repeat' && groupItems && objects.length > 1) {
      const group = new fabric.Group(objects);
      (group as any).id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      (group as any).artboardId = artboardId ?? undefined;
      (group as any).customName = label;
      added = [group];
    } else {
      objects.forEach((obj) => { (obj as any).customName = label; });
    }

    executeCommand(new AddObjectsCommand(label, added));
    setAppliedAt(Date.now());
  }, [canvas, build, mode, groupItems, artboardId, executeCommand]);

  const reset = useCallback(() => {
    setSize(28);
    setSpacing(48);
    setCount(12);
    setStartTrim(0);
    setEndTrim(0);
    setOffsetAlong(0);
    setSideOffset(0);
    setAlternate(false);
    setJitterPosition(0);
    setJitterSize(0);
    setJitterAngle(0);
    setExtraAngle(0);
    setRotateWithPath(true);
    setOpacity(1);
    setTextStart(0);
    setCharSpacing(0);
  }, []);

  return {
    // The path
    hasPath: !!geometry,
    pathLength: geometry?.length ?? 0,
    pathPoints: geometry?.points ?? [],
    isLoop: closed,
    isLoopByDefault,
    closing, setClosing,
    reverse, setReverse,
    // What goes on it
    mode, setMode,
    kind, setKind,
    shapes: ALONG_SHAPES,
    shapeId, setShapeId,
    emoji, setEmoji,
    image, pickImageFile, useSelectedImage, clearImage: () => setImage(null),
    size, setSize,
    fill, setFill,
    stroke, setStroke,
    strokeWidth, setStrokeWidth,
    opacity, setOpacity,
    rotateWithPath, setRotateWithPath,
    extraAngle, setExtraAngle,
    // Spread
    spreadMode, setSpreadMode,
    spacing, setSpacing,
    count, setCount,
    startTrim, setStartTrim,
    endTrim, setEndTrim,
    offsetAlong, setOffsetAlong,
    sideOffset, setSideOffset,
    alternate, setAlternate,
    jitterPosition, setJitterPosition,
    jitterSize, setJitterSize,
    jitterAngle, setJitterAngle,
    shuffle: () => setSeed((s) => s + 1),
    // Text
    text, setText,
    fonts: PATH_FONTS,
    fontFamily, setFontFamily,
    fontSize, setFontSize,
    fontWeight, setFontWeight,
    charSpacing, setCharSpacing,
    textSide, setTextSide,
    textAlign, setTextAlign,
    textStart, setTextStart,
    // Result
    itemCount: preview.length,
    groupItems, setGroupItems,
    appliedAt,
    apply,
    reset,
  };
}

export type PathStudioApi = ReturnType<typeof usePathStudio>;
