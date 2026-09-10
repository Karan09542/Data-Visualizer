import * as fabric from 'fabric';

/**
 * What an image layer currently shows, as its own canvas.
 *
 * Shared by every feature that bakes pixels back into a layer, so they all agree on what "the
 * layer's pixels" means - crop included, which a plain `getElement()` would silently ignore.
 */
export const captureVisibleLayer = (image: fabric.Image): HTMLCanvasElement | null => {
  const element = image.getElement?.() as CanvasImageSource | undefined;
  const width = Math.round(image.width || 0);
  const height = Math.round(image.height || 0);
  if (!element || width < 1 || height < 1) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // Source rect, so a cropped layer contributes the part it actually shows.
  const cropX = (image as any).cropX || 0;
  const cropY = (image as any).cropY || 0;
  ctx.drawImage(element, cropX, cropY, width, height, 0, 0, width, height);
  return canvas;
};
