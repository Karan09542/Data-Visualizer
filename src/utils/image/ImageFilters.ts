/**
 * Basic image filtering using 2D Canvas ImageData.
 */

export type FilterType = 'none' | 'grayscale' | 'bw' | 'threshold' | 'auto';

export interface FilterOptions {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  type: FilterType;
}

export function applyFilters(
  source: HTMLCanvasElement | HTMLImageElement,
  options: FilterOptions
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // Draw base
  ctx.drawImage(source as CanvasImageSource, 0, 0);

  // If no filters, return early
  if (options.brightness === 0 && options.contrast === 0 && options.type === 'none') {
    return canvas;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
  const brightnessOffset = options.brightness;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Apply Brightness & Contrast
    if (brightnessOffset !== 0 || options.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128 + brightnessOffset;
      g = contrastFactor * (g - 128) + 128 + brightnessOffset;
      b = contrastFactor * (b - 128) + 128 + brightnessOffset;
    }

    // Apply Filter Types
    if (options.type === 'grayscale' || options.type === 'bw' || options.type === 'threshold' || options.type === 'auto') {
      // Standard luminance
      let v = 0.299 * r + 0.587 * g + 0.114 * b;

      if (options.type === 'threshold' || options.type === 'auto') {
        // Simple global thresholding for now (Adaptive is too slow in JS without WebGL)
        v = v > 128 ? 255 : 0;
      } else if (options.type === 'bw') {
        // High contrast B&W
        v = v > 160 ? 255 : v < 90 ? 0 : v;
      }

      r = v;
      g = v;
      b = v;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
