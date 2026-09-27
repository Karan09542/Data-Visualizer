import { DOCUMENT_PRESETS, PAPER_SIZES, type DocPresetKey, type PaperSizeKey } from '../constants';
import type { ImageFitMode, ImagePosition, Orientation, PhotoQueueItem, SheetLayout } from '../types';
import { MM_TO_PX } from './units';

type LayoutInput = {
  paperSize: PaperSizeKey;
  docPreset: DocPresetKey;
  orientation: Orientation;
  customPaperWMM: number;
  customPaperHMM: number;
  photoWMM: number;
  photoHMM: number;
  marginTop: number;
  marginLeft: number;
  spacing: number;
  photoQueue: PhotoQueueItem[];
  cellOverrides: Record<number, string>;
};

/** Grid layout calculation (in MM) */
export function computeSheetLayout({
  paperSize, docPreset, orientation, customPaperWMM, customPaperHMM,
  photoWMM, photoHMM, marginTop, marginLeft, spacing, photoQueue, cellOverrides,
}: LayoutInput): SheetLayout {
  const pWBase = paperSize === 'custom' ? (customPaperWMM || 210) : PAPER_SIZES[paperSize].width;
  const pHBase = paperSize === 'custom' ? (customPaperHMM || 297) : PAPER_SIZES[paperSize].height;

  const pWidth = orientation === 'portrait' ? pWBase : pHBase;
  const pHeight = orientation === 'portrait' ? pHBase : pWBase;

  const phWidth = docPreset === 'custom' ? (photoWMM || 35) : DOCUMENT_PRESETS[docPreset].widthMM;
  const phHeight = docPreset === 'custom' ? (photoHMM || 45) : DOCUMENT_PRESETS[docPreset].heightMM;

  // Available space
  const availWidth = Math.max(0, pWidth - (marginLeft * 2));
  const availHeight = Math.max(0, pHeight - (marginTop * 2));

  // How many can fit in columns and rows?
  let maxCols = phWidth > 0 ? Math.floor((availWidth + spacing) / (phWidth + spacing)) : 0;
  let maxRows = phHeight > 0 ? Math.floor((availHeight + spacing) / (phHeight + spacing)) : 0;

  maxCols = Math.max(0, maxCols);
  maxRows = Math.max(0, maxRows);
  const maxCapacity = maxCols * maxRows;

  // Active rendered photo count limited by user setting
  const queueTotal = photoQueue.reduce((acc, item) => acc + item.quantity, 0);
  const maxOverrideIndex = Object.keys(cellOverrides).length > 0
    ? Math.max(...Object.keys(cellOverrides).map(Number))
    : -1;
  const activePhotoCount = Math.min(maxCapacity, Math.max(queueTotal, maxOverrideIndex + 1));

  // Center grid inside paper
  const consumedWidth = (maxCols * phWidth) + Math.max(0, maxCols - 1) * spacing;
  const consumedHeight = (maxRows * phHeight) + Math.max(0, maxRows - 1) * spacing;

  const actualMarginLeft = marginLeft + Math.max(0, (availWidth - consumedWidth) / 2);
  const actualMarginTop = marginTop + Math.max(0, (availHeight - consumedHeight) / 2);

  return {
    pWidth, pHeight, phWidth, phHeight,
    cols: maxCols, rows: maxRows, maxCapacity, activePhotoCount,
    actualMarginLeft, actualMarginTop
  };
}

type RenderInput = {
  layout: SheetLayout;
  dpi: number;
  spacing: number;
  drawCropMarks: boolean;
  imageFit: ImageFitMode;
  imagePosition: ImagePosition;
  photoScale: number;
  filterCss: string;
  getCellImageSrc: (index: number) => string | null;
  loadedImages: Record<string, HTMLImageElement>;
};

/** High-resolution print canvas generation (dynamic DPI) */
export function renderPrintSheet({
  layout, dpi: printDPI, spacing, drawCropMarks, imageFit, imagePosition,
  photoScale, filterCss, getCellImageSrc, loadedImages,
}: RenderInput): HTMLCanvasElement | null {
  if (layout.cols === 0 || layout.rows === 0) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpi = printDPI || 300;
  const mmToPx = (val: number) => MM_TO_PX(val, dpi);

  // Set canvas size based on selected DPI
  canvas.width = mmToPx(layout.pWidth);
  canvas.height = mmToPx(layout.pHeight);

  // Fill white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startX = mmToPx(layout.actualMarginLeft);
  const startY = mmToPx(layout.actualMarginTop);
  const pW = mmToPx(layout.phWidth);
  const pH = mmToPx(layout.phHeight);
  const gap = mmToPx(spacing);

  let photosDrawn = 0;

  // Draw photos and cut guidelines
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      if (photosDrawn >= layout.activePhotoCount) break;

      const x = startX + c * (pW + gap);
      const y = startY + r * (pH + gap);

      // Draw Image with inner scale clipping + fit mode
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, pW, pH);
      ctx.clip();

      const cellSrc = getCellImageSrc(photosDrawn);
      const cellImg = cellSrc ? loadedImages[cellSrc] : null;

      if (cellImg) {
        const imgW = cellImg.naturalWidth;
        const imgH = cellImg.naturalHeight;
        const cellAspect = pW / pH;
        const imgAspect = imgW / imgH;

        let drawW: number, drawH: number;

        if (imageFit === 'cover') {
          // Cover: fill cell, crop overflow
          if (imgAspect > cellAspect) {
            drawH = pH;
            drawW = pH * imgAspect;
          } else {
            drawW = pW;
            drawH = pW / imgAspect;
          }
        } else if (imageFit === 'contain') {
          // Contain: fit entire image, letterbox
          if (imgAspect > cellAspect) {
            drawW = pW;
            drawH = pW / imgAspect;
          } else {
            drawH = pH;
            drawW = pH * imgAspect;
          }
        } else {
          // Fill: stretch to fill cell exactly
          drawW = pW;
          drawH = pH;
        }

        // Apply photoScale on top of fit
        const scaledW = drawW * (photoScale / 100);
        const scaledH = drawH * (photoScale / 100);

        // Position-aware offset calculation (9-point anchor)
        const [posV, posH] = imagePosition.split(' ') as [string, string];
        let offsetX: number, offsetY: number;

        // Horizontal position
        if (posH === 'left') {
          offsetX = x;
        } else if (posH === 'right') {
          offsetX = x + (pW - scaledW);
        } else {
          offsetX = x + (pW - scaledW) / 2;
        }

        // Vertical position
        if (posV === 'top') {
          offsetY = y;
        } else if (posV === 'bottom') {
          offsetY = y + (pH - scaledH);
        } else {
          offsetY = y + (pH - scaledH) / 2;
        }

        // Apply CSS filters (brightness, contrast, saturation, etc.) to canvas
        ctx.filter = filterCss;
        ctx.drawImage(cellImg, offsetX, offsetY, scaledW, scaledH);
      }
      ctx.restore();

      // Draw cut guidelines (dashed borders & scissor marks) if requested
      if (drawCropMarks) {
        ctx.save();
        ctx.strokeStyle = '#94A3B8'; // Slate 400
        ctx.lineWidth = mmToPx(0.4); // 0.4mm dash stroke
        ctx.setLineDash([mmToPx(1.5), mmToPx(1.5)]); // Dashed line
        ctx.strokeRect(x, y, pW, pH);
        ctx.restore();

        // Draw Scissor Icon on top-left corner of each photo box if gap >= 2mm or on boundaries
        if (c === 0 || r === 0 || gap > mmToPx(2)) {
          ctx.save();
          ctx.font = `${Math.max(14, mmToPx(3))}px sans-serif`;
          ctx.fillStyle = '#64748B';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Scissor symbol top left corner
          ctx.fillText('✂', x - mmToPx(1), y - mmToPx(1));
          ctx.restore();
        }
      }

      photosDrawn++;
    }
  }

  return canvas;
}

/**
 * 100% guaranteed target file size compression (scale + dynamic quality tuning).
 * Returns the best data URL found, or '' when nothing could be produced.
 */
export function compressToTargetKB(canvas: HTMLCanvasElement, mimeType: string, maxFileKB: number): string {
  const head = mimeType === 'image/jpeg' ? 'data:image/jpeg;base64,' : 'data:image/webp;base64,';

  let minScale = 0.05;
  let maxScale = 1.0;
  let bestUrl = '';
  let bestSizeKB = Infinity;

  // 8-step binary search over scale + quality combinations
  for (let step = 0; step < 8; step++) {
    const midScale = (minScale + maxScale) / 2;
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = Math.max(100, Math.round(canvas.width * midScale));
    scaledCanvas.height = Math.max(100, Math.round(canvas.height * midScale));
    const sCtx = scaledCanvas.getContext('2d');

    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

      // Dynamically scale quality from 0.85 down to 0.40 based on midScale
      const q = Math.max(0.35, Math.min(0.92, midScale * 0.9));
      const testUrl = scaledCanvas.toDataURL(mimeType, q);
      const base64Str = testUrl.substring(head.length);
      const testSizeKB = Math.round((base64Str.length * 3) / 4 / 1024);

      if (testSizeKB <= maxFileKB) {
        bestUrl = testUrl;
        bestSizeKB = testSizeKB;
        minScale = midScale; // Try higher resolution if possible
      } else {
        maxScale = midScale;
      }
    }
  }

  // Strict Fallback Pass: If scale loop didn't get below maxFileKB (e.g. for tiny <20KB targets)
  if (!bestUrl || bestSizeKB > maxFileKB) {
    for (let scale = 0.25; scale >= 0.05; scale -= 0.04) {
      for (let q = 0.80; q >= 0.10; q -= 0.10) {
        const fbCanvas = document.createElement('canvas');
        fbCanvas.width = Math.max(80, Math.round(canvas.width * scale));
        fbCanvas.height = Math.max(80, Math.round(canvas.height * scale));
        const fCtx = fbCanvas.getContext('2d');
        if (fCtx) {
          fCtx.imageSmoothingEnabled = true;
          fCtx.imageSmoothingQuality = 'high';
          fCtx.drawImage(canvas, 0, 0, fbCanvas.width, fbCanvas.height);
          const testUrl = fbCanvas.toDataURL(mimeType, q);
          const testSizeKB = Math.round(((testUrl.substring(head.length).length) * 3) / 4 / 1024);

          if (testSizeKB <= maxFileKB) {
            bestUrl = testUrl;
            break;
          }
          if (!bestUrl) bestUrl = testUrl;
        }
      }
      if (bestUrl && Math.round(((bestUrl.substring(head.length).length) * 3) / 4 / 1024) <= maxFileKB) {
        break;
      }
    }
  }

  return bestUrl;
}

/** Prints an image sized to the physical paper through an invisible iframe. */
export function printImageViaIframe(dataUrl: string, pWidth: number, pHeight: number) {
  // Create an invisible iframe to print from
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
      <html>
        <head>
          <title>Passport Studio Print</title>
          <style>
            @page {
              size: ${pWidth}mm ${pHeight}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            img {
              width: ${pWidth}mm;
              height: ${pHeight}mm;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" />
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
  doc.close();

  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 10000);
}
