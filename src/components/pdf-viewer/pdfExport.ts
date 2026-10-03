import { PDFDocument, degrees } from "pdf-lib";

export type ExportImageFormat = "png" | "jpeg" | "webp";

export const IMAGE_FORMATS: { id: ExportImageFormat; label: string; ext: string; hint: string }[] = [
  { id: "png", label: "PNG", ext: "png", hint: "Lossless, largest" },
  { id: "jpeg", label: "JPEG", ext: "jpg", hint: "Smaller, for photos" },
  { id: "webp", label: "WebP", ext: "webp", hint: "Smallest, modern" },
];

/** Pixels per PDF point for exported images: about 216 dpi */
const EXPORT_SCALE = 3;

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later: some browsers start the download after the click returns
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A file-name stem from the given name or the URL; blob: URLs only have a random id, so "document" */
export function documentTitle(url: string, fileName?: string) {
  if (!fileName && url.startsWith("blob:")) return "document";
  const name = fileName || url.replace(/[#?].*$/, "").split("/").pop() || "";
  try {
    return decodeURIComponent(name).replace(/\.pdf$/i, "") || "document";
  } catch {
    return name.replace(/\.pdf$/i, "") || "document";
  }
}

/** Draws one page, with any extra rotation, and returns it as an image */
export async function renderPageImage(
  pdfDoc: any,
  pageNum: number,
  extraRotation: number,
  format: ExportImageFormat,
): Promise<Blob> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: EXPORT_SCALE, rotation: ((page.rotate || 0) + extraRotation) % 360 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  // Free the bitmap now rather than waiting for garbage collection; matters for long exports
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error(`Could not encode page ${pageNum}`);
  return blob;
}

/** A new PDF of the given pages, in that order, with rotations applied */
export async function buildPdf(source: ArrayBuffer, pages: number[], rotations: Record<number, number>): Promise<Blob> {
  const srcDoc = await PDFDocument.load(source.slice(0), { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, pages.map((p) => p - 1));
  copied.forEach((page, i) => {
    const extra = rotations[pages[i]] || 0;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    newDoc.addPage(page);
  });
  const bytes = await newDoc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Zips files in a worker so the page stays responsive */
export function zipFiles(
  files: { file: Blob; path: string }[],
  folderName: string,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../workers/zipWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { zipFile, error, progress } = e.data;
      // Progress messages arrive first; only the finished file or an error ends the job
      if (!zipFile && !error) {
        if (typeof progress === "number") onProgress?.(progress);
        return;
      }
      worker.terminate();
      if (error) reject(new Error(error));
      else resolve(zipFile);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({ id: "pdf-zip", files, folderName });
  });
}
