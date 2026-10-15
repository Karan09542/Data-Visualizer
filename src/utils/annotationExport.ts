import { Annotation } from '../store/useAnnotationStore';
import { annotationBox, unionBox } from './annotationSelection';

/**
 * Converts an SVG element or group of annotations into a high-resolution PNG Blob.
 * Preserves all SVG styling, transforms, strokes, colors, and filter effects (glow, pencil, calligraphy).
 */
export async function annotationToPngBlob(annos: Annotation | Annotation[]): Promise<Blob> {
  const list = (Array.isArray(annos) ? annos : [annos]).filter(Boolean);
  if (list.length === 0) {
    throw new Error('No shapes selected for export');
  }

  // 1. Calculate bounding box with padding for stroke thickness, glow, and antialiasing
  let box = list.length === 1 ? annotationBox(list[0]) : unionBox(list);
  if (!box) {
    box = annotationBox(list[0]);
  }

  const maxStroke = Math.max(...list.map(a => a.width || 4));
  const hasGlow = list.some(a => (a.glowIntensity || 0) > 0 || a.brushStyle === 'neon-glow');
  const pad = Math.max(16, maxStroke * 2 + (hasGlow ? 24 : 8));

  let minX = box.minX - pad;
  let minY = box.minY - pad;
  let width = Math.max(20, (box.maxX - box.minX) + pad * 2);
  let height = Math.max(20, (box.maxY - box.minY) + pad * 2);

  // 2. Clone defs containing SVG filters (pencil, neon glow, calligraphy)
  const defsEl = document.querySelector('.annotation-layer defs');
  let defsHtml = '';
  if (defsEl) {
    defsHtml = defsEl.outerHTML;
  } else {
    defsHtml = `
      <defs>
        <filter id="pencil-filter" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
        <filter id="neon-glow-filter">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="calligraphy-filter">
          <feOffset dx="2" dy="2" />
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;
  }

  // 3. Collect outerHTML of each shape's SVG group
  const shapesHtmlList: string[] = [];
  for (const anno of list) {
    const el = document.getElementById(`annotation-shape-${anno.id}`) ||
               document.querySelector(`[data-anno-id="${anno.id}"]`)?.closest('g');
    if (el) {
      const clone = el.cloneNode(true) as SVGElement;
      // Remove invisible hit-testing paths so the SVG remains pure
      clone.querySelectorAll('path[stroke="transparent"]').forEach(p => p.remove());

      // If bounding box was degenerate, refine using live SVG getBBox
      if (list.length === 1) {
        try {
          const liveBbox = (el as SVGGraphicsElement).getBBox();
          if (liveBbox && liveBbox.width > 0 && liveBbox.height > 0) {
            const liveMinX = liveBbox.x - pad;
            const liveMinY = liveBbox.y - pad;
            const liveW = liveBbox.width + pad * 2;
            const liveH = liveBbox.height + pad * 2;
            if (isFinite(liveMinX) && isFinite(liveMinY) && isFinite(liveW) && isFinite(liveH)) {
              minX = liveMinX;
              minY = liveMinY;
              width = liveW;
              height = liveH;
            }
          }
        } catch {
          // getBBox might fail if unrendered, safe to fallback to box
        }
      }

      shapesHtmlList.push(clone.outerHTML);
    }
  }

  if (shapesHtmlList.length === 0) {
    throw new Error('Shape elements not found in current canvas view');
  }

  // 4. Construct standalone SVG document string
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
    ${defsHtml}
    ${shapesHtmlList.join('\n')}
  </svg>`;

  // 5. Draw onto high-resolution Canvas (transparent background)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG into image for rendering'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create canvas 2D context for PNG export');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const pngBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });

  if (!pngBlob) {
    throw new Error('Failed to encode canvas to PNG format');
  }

  return pngBlob;
}

/**
 * Downloads the specified annotation(s) as a transparent PNG file.
 */
export async function downloadAnnotationAsPng(annos: Annotation | Annotation[]): Promise<void> {
  const list = Array.isArray(annos) ? annos : [annos];
  const blob = await annotationToPngBlob(list);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const label = list.length === 1 ? (list[0].tool || 'shape') : `shapes_${list.length}`;
  link.download = `${label}_${Date.now()}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copies the specified annotation(s) to the system clipboard as a PNG image.
 * Returns true if successfully copied to clipboard, or false if it fell back to download.
 */
export async function copyAnnotationAsPng(annos: Annotation | Annotation[]): Promise<boolean> {
  const list = Array.isArray(annos) ? annos : [annos];
  const blob = await annotationToPngBlob(list);

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    } catch (err) {
      console.warn('Direct ClipboardItem write failed, falling back to download:', err);
    }
  }

  // Fallback to downloading PNG if browser blocks image clipboard write
  await downloadAnnotationAsPng(list);
  return false;
}
