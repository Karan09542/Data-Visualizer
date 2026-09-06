import { useCallback, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { FabricEraser, FabricEraserOptions } from './FabricEraser';
import { EraserSettings } from './types';

/**
 * React lifecycle around FabricEraser.
 *
 * Callbacks are held in a ref so changing them does not tear down the eraser
 * mid-stroke; only a new canvas rebuilds it.
 */
export function useEraser(
  canvas: fabric.Canvas | null,
  options: FabricEraserOptions = {},
) {
  const eraserRef = useRef<FabricEraser | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!canvas) return;

    const eraser = new FabricEraser(canvas, {
      onStrokeCommitted: (image, stroke, engine) =>
        optionsRef.current.onStrokeCommitted?.(image, stroke, engine),
      onStrokeStart: (image) => optionsRef.current.onStrokeStart?.(image),
      isPointerBlocked: (event) =>
        optionsRef.current.isPointerBlocked?.(event) ?? false,
    });
    eraserRef.current = eraser;

    return () => {
      eraser.dispose();
      eraserRef.current = null;
    };
  }, [canvas]);

  const setActive = useCallback((active: boolean) => {
    const eraser = eraserRef.current;
    if (!eraser) return;
    if (active) eraser.enable();
    else eraser.disable();
  }, []);

  const setSettings = useCallback((settings: Partial<EraserSettings>) => {
    eraserRef.current?.setSettings(settings);
  }, []);

  const refreshCursor = useCallback(() => {
    eraserRef.current?.refreshCursor();
  }, []);

  return { eraserRef, setActive, setSettings, refreshCursor };
}
