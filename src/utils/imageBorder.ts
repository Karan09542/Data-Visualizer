/**
 * Borders for image layers, in two flavours.
 *
 * `rectangle` frames the whole picture. `contour` follows the artwork's own alpha edge, which is
 * what turns a cut-out PNG into a sticker.
 *
 * The contour outline is a dilation rather than a traced polygon. Stamping the silhouette around a
 * circle and unioning the results reproduces the Minkowski dilation by a disc, which keeps every
 * wisp of anti-aliased hair and every interior hole that a traced outline would smooth away - and
 * it comes out anti-aliased for free, because each stamp is drawn by the canvas rather than filled
 * from a polygon.
 *
 * Framework-free: it needs a 2D canvas and nothing else.
 */

export type BorderMode = 'rectangle' | 'contour';

export interface BorderOptions {
  mode: BorderMode;
  color: string;
  /** Thickness in source-image pixels. */
  width: number;
  /** Corner rounding, rectangle mode only, in source-image pixels. */
  radius?: number;
  /**
   * Stamps per ring for the contour outline. More is smoother and slower; the default scales with
   * the thickness, since a thick outline shows the gaps between stamps that a thin one hides.
   */
  quality?: number;
}

/** Rings of stamps. One ring can leave the interior of a thick outline patchy on spindly artwork. */
const RINGS = [1, 0.66, 0.33];

/**
 * Longest side the outline is computed on.
 *
 * The dilation costs one full-canvas draw per stamp, so on a 12MP photo a thick outline would be
 * hundreds of multi-megapixel blits - seconds of frozen UI. The outline is a flat silhouette with
 * no detail to lose, so it is built small and scaled up, while the artwork itself is still drawn at
 * full resolution on top. The only visible difference is a marginally softer rim, which suits a
 * sticker edge anyway.
 */
const MAX_OUTLINE_SIZE = 700;

/** Stamps needed for a ring: enough that neighbouring stamps overlap, and no more. */
const ringSamples = (radius: number): number =>
  Math.max(8, Math.min(96, Math.ceil(radius * 3)));

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

/** How big the layer becomes once the border is added, so callers can keep it centred. */
export const borderedSize = (
  width: number,
  height: number,
  borderWidth: number
): { width: number; height: number } => ({
  width: Math.max(1, Math.round(width + borderWidth * 2)),
  height: Math.max(1, Math.round(height + borderWidth * 2))
});

/**
 * Whether the artwork has anything to trace.
 *
 * A fully opaque photo has no alpha edge, so a contour border falls back to tracing the rectangle
 * it already is. Callers use this to say so before the user wonders why the two modes look alike.
 */
export const hasTransparency = (pixels: ImageData, threshold = 250): boolean => {
  const { data } = pixels;
  // Every fourth byte, and only every seventh pixel: enough to answer a yes/no question quickly.
  const step = 4 * 7;
  for (let i = 3; i < data.length; i += step) {
    if (data[i] < threshold) return true;
  }
  return false;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) => {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

/** The artwork recoloured to the border colour, keeping its alpha. The stamp for the dilation. */
const silhouette = (
  source: CanvasImageSource,
  width: number,
  height: number,
  color: string
): HTMLCanvasElement | null => {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  // Paint inside the existing alpha only, which recolours the shape without touching its edges.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
};

/**
 * Draws `source` with a border, returning a new canvas that is `width` larger on every side.
 * Returns null only when a 2D context cannot be obtained.
 */
export const renderBorderedImage = (
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  options: BorderOptions
): HTMLCanvasElement | null => {
  const width = Math.max(0, Math.round(options.width));
  const size = borderedSize(srcWidth, srcHeight, width);

  const out = makeCanvas(size.width, size.height);
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (width === 0) {
    ctx.drawImage(source, 0, 0, srcWidth, srcHeight);
    return out;
  }

  if (options.mode === 'rectangle') {
    const radius = Math.max(0, options.radius || 0);
    ctx.fillStyle = options.color;
    // The outer corner is rounder than the inner one by exactly the border width, which is what
    // keeps the frame an even thickness the whole way round a rounded corner.
    roundedRect(ctx, 0, 0, size.width, size.height, radius > 0 ? radius + width : 0);
    ctx.fill();

    ctx.save();
    roundedRect(ctx, width, width, srcWidth, srcHeight, radius);
    ctx.clip();
    ctx.drawImage(source, width, width, srcWidth, srcHeight);
    ctx.restore();
    return out;
  }

  // Work at a bounded size; the outline is flat colour, so nothing is lost by scaling it back up.
  const scale = Math.min(1, MAX_OUTLINE_SIZE / Math.max(srcWidth, srcHeight));
  const workWidth = Math.max(1, Math.round(srcWidth * scale));
  const workHeight = Math.max(1, Math.round(srcHeight * scale));
  const pad = Math.max(1, Math.round(width * scale));

  const stamp = silhouette(source, workWidth, workHeight, options.color);
  if (!stamp) return null;

  const layer = makeCanvas(workWidth + pad * 2, workHeight + pad * 2);
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) return null;

  for (const ring of RINGS) {
    const radius = pad * ring;
    const samples = options.quality || ringSamples(radius);
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      layerCtx.drawImage(
        stamp,
        pad + Math.cos(angle) * radius,
        pad + Math.sin(angle) * radius,
        workWidth,
        workHeight
      );
    }
  }

  ctx.drawImage(layer, 0, 0, out.width, out.height);
  // The artwork goes on at full resolution, so only the rim behind it is ever approximated.
  ctx.drawImage(source, width, width, srcWidth, srcHeight);
  return out;
};
