/**
 * Image format conversion helpers that don't need the browser: the BMP and ICO file layouts
 * (canvases can't write these), output file names and size labels.
 */

export type OutputFormat = "png" | "jpeg" | "webp" | "avif" | "bmp" | "ico";

export interface FormatInfo {
  id: OutputFormat;
  label: string;
  ext: string;
  mime: string;
  /** Has a quality setting (smaller file, some detail lost). */
  lossy: boolean;
  /** Keeps see-through areas; otherwise they're filled with the background colour. */
  transparency: boolean;
  hint: string;
}

export const FORMATS: FormatInfo[] = [
  { id: "png", label: "PNG", ext: "png", mime: "image/png", lossy: false, transparency: true, hint: "Sharp, keeps transparency" },
  { id: "jpeg", label: "JPG", ext: "jpg", mime: "image/jpeg", lossy: true, transparency: false, hint: "Small, best for photos" },
  { id: "webp", label: "WebP", ext: "webp", mime: "image/webp", lossy: true, transparency: true, hint: "Smaller than JPG, for the web" },
  { id: "avif", label: "AVIF", ext: "avif", mime: "image/avif", lossy: true, transparency: true, hint: "Smallest, newer browsers" },
  { id: "bmp", label: "BMP", ext: "bmp", mime: "image/bmp", lossy: false, transparency: false, hint: "Uncompressed, for old apps" },
  { id: "ico", label: "ICO", ext: "ico", mime: "image/x-icon", lossy: false, transparency: true, hint: "Website / app icon" },
];

export const formatInfo = (id: OutputFormat) => FORMATS.find((f) => f.id === id)!;

/** Sizes put inside an .ico file (the ones Windows and browsers ask for). */
export const ICO_SIZES = [16, 32, 48, 64, 128, 256];

/** "holiday.heic" + "jpg" → "holiday.jpg" */
export function outputName(name: string, ext: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).trim() || "image";
  return `${base}.${ext}`;
}

/** Gives repeated names a number: a.png, a (2).png, … */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${count})${n.slice(dot)}` : `${n} (${count})`;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** "-42%" smaller, "+12%" bigger. */
export function sizeChange(before: number, after: number): string {
  if (!before) return "";
  const pct = Math.round(((after - before) / before) * 100);
  return pct === 0 ? "same size" : `${pct > 0 ? "+" : ""}${pct}%`;
}

/**
 * A solid colour from "#rgb", "#rrggbb", "#rrggbbaa", "rgb(…)" or "rgba(…)", as [r, g, b].
 * Partly see-through colours are laid over white, since the result has no transparency.
 * Null when it isn't a colour (yet), e.g. while it's being typed.
 */
export function parseSolidColor(input: string): [number, number, number] | null {
  const s = input.trim().toLowerCase();
  let r: number, g: number, b: number, a = 1;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    const m = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*(\d*\.?\d+)\s*)?\)$/.exec(s);
    if (!m) return null;
    [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.min(255, Number(v)));
    if (m[4] !== undefined) a = Math.min(1, Number(m[4]));
  }
  const over = (c: number) => Math.round(c * a + 255 * (1 - a));
  return [over(r), over(g), over(b)];
}

export const rgbToHex = ([r, g, b]: [number, number, number]) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * A 24-bit BMP from RGBA pixels. BMP has no transparency, so see-through pixels are blended
 * onto `background`.
 */
export function encodeBmp(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, background: [number, number, number] = [255, 255, 255]): Uint8Array {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // each row padded to 4 bytes
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const out = new Uint8Array(fileSize);
  const view = new DataView(out.buffer);

  // File header
  out[0] = 0x42; // B
  out[1] = 0x4d; // M
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true); // where the pixels start
  // Info header (BITMAPINFOHEADER)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive: rows stored bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(30, 0, true); // no compression
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true); // 72 dpi
  view.setInt32(42, 2835, true);

  const [br, bg, bb] = background;
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4;
    let dst = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const i = src + x * 4;
      const a = rgba[i + 3] / 255;
      out[dst++] = Math.round(rgba[i + 2] * a + bb * (1 - a));
      out[dst++] = Math.round(rgba[i + 1] * a + bg * (1 - a));
      out[dst++] = Math.round(rgba[i] * a + br * (1 - a));
    }
  }
  return out;
}

/**
 * An .ico file holding PNG images (supported by Windows Vista+ and every browser). Each entry
 * is a square PNG of `size` pixels, at most 256.
 */
export function packIco(entries: { size: number; png: Uint8Array }[]): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.size - b.size);
  const headerSize = 6 + 16 * sorted.length;
  const total = headerSize + sorted.reduce((n, e) => n + e.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // 1 = icon
  view.setUint16(4, sorted.length, true);

  let offset = headerSize;
  sorted.forEach((e, i) => {
    const at = 6 + i * 16;
    const side = e.size >= 256 ? 0 : e.size; // 0 means 256
    out[at] = side;
    out[at + 1] = side;
    out[at + 2] = 0; // no palette
    out[at + 3] = 0;
    view.setUint16(at + 4, 1, true); // planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, e.png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(e.png, offset);
    offset += e.png.length;
  });
  return out;
}

/** The icon sizes worth making from a picture whose longest side is `longest` px (no blurry upscales). */
export function icoSizesFor(longest: number): number[] {
  const fit = ICO_SIZES.filter((s) => s <= Math.max(16, longest));
  return fit.length ? fit : [16];
}
