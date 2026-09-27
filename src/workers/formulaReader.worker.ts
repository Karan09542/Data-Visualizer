/**
 * The formula reader: turns a picture of a formula into LaTeX, on this device.
 *
 * Model: Texo FormulaNet (github.com/alephpi/Texo), run with Transformers.js on ONNX
 * Runtime's WebAssembly backend. Every file it needs comes from OPFS (see modelStore),
 * so after the one-time download it works offline and never refetches.
 *
 * Messages in:  download | cancel | warmup | read {id, image, crop}
 * Messages out: progress | downloaded | download-error | loading | ready | result | read-error
 */
import {
  MODEL_FILES,
  MODEL_ID,
  RUNTIME_FILE,
  downloadModel,
  getStoredModel,
  readStoredFile,
} from "../lib/formulaReader/modelStore";

/** Part of the image to read, as fractions of its width and height. */
export interface CropFractions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ReaderRequest =
  | { type: "download" }
  | { type: "cancel" }
  | { type: "warmup" }
  | { type: "read"; id: number; image: Blob; crop?: CropFractions };

const post = (message: any) => (self as unknown as Worker).postMessage(message);

// ─── Model ───────────────────────────────────────────────────────────────────

const SIZE = 384;
// Pixel statistics of the images the model was trained on (UniMERNet).
const MEAN = 0.7931;
const STD = 0.1738;

let loading: Promise<{ model: any; tokenizer: any; Tensor: any }> | null = null;

function loadModel() {
  if (loading) return loading;
  loading = (async () => {
    const started = performance.now();
    post({ type: "loading" });
    const stored = await getStoredModel();
    if (!stored) throw new Error("The formula reader isn't downloaded yet.");

    const runtime = await readStoredFile(RUNTIME_FILE.path);
    if (!runtime) throw new Error("The reader's runtime file is missing: download the reader again.");

    const { env, VisionEncoderDecoderModel, PreTrainedTokenizer, Tensor } = await import("@huggingface/transformers");

    // Files come only from OPFS. Transformers.js asks its cache first, and the cache
    // always has them, so it never goes to the network.
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = {
      async match(key: string | Request) {
        const url = typeof key === "string" ? key : key.url;
        const file = MODEL_FILES.find((f) => url.endsWith(`/${f.path}`));
        if (!file) return undefined;
        const stored = await readStoredFile(file.path);
        if (!stored) return undefined;
        return new Response(stored, { headers: { "content-length": String(stored.size) } });
      },
      async put() {
        // Everything is already stored.
      },
    };

    // The WebAssembly runtime is handed over as bytes, so ONNX Runtime doesn't fetch it
    // (by default it would come from a CDN). Its JavaScript glue is bundled with it.
    const onnx = env.backends.onnx as any;
    onnx.wasm.wasmPaths = undefined;
    onnx.wasm.wasmBinary = await runtime.arrayBuffer();
    onnx.wasm.proxy = false;

    const model = await VisionEncoderDecoderModel.from_pretrained(MODEL_ID, { dtype: "fp32", device: "wasm" });
    const tokenizer = await PreTrainedTokenizer.from_pretrained(MODEL_ID);
    post({ type: "ready", ms: Math.round(performance.now() - started) });
    return { model, tokenizer, Tensor };
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

// ─── Image preparation ───────────────────────────────────────────────────────

/** Largest side the image is worked on at; the model only sees 384 px anyway. */
const WORK_SIZE = 1600;

function median(values: Uint8ClampedArray | Uint8Array): number {
  const hist = new Uint32Array(256);
  for (const v of values) hist[v]++;
  let count = 0;
  for (let v = 0; v < 256; v++) {
    count += hist[v];
    if (count >= values.length / 2) return v;
  }
  return 255;
}

function percentile(values: Uint8ClampedArray | Uint8Array, p: number): number {
  const hist = new Uint32Array(256);
  for (const v of values) hist[v]++;
  let count = 0;
  for (let v = 0; v < 256; v++) {
    count += hist[v];
    if (count >= values.length * p) return v;
  }
  return 255;
}

/**
 * Evens out the page: divides every pixel by the paper brightness around it, so a
 * shadow across a photo, or grey paper, comes out white while the ink stays dark.
 * Screenshots (already white) pass through unchanged.
 */
function flattenBackground(grey: Uint8ClampedArray, w: number, h: number) {
  const block = Math.max(8, Math.round(Math.max(w, h) / 40));
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(h / block);
  const maxes = new Float32Array(bw * bh);
  for (let y = 0; y < h; y++) {
    const by = Math.floor(y / block);
    for (let x = 0; x < w; x++) {
      const i = by * bw + Math.floor(x / block);
      const v = grey[y * w + x];
      if (v > maxes[i]) maxes[i] = v;
    }
  }
  // A block that is all ink takes its brighter neighbours' paper.
  const bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = by + dy;
          const xx = bx + dx;
          if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) m = Math.max(m, maxes[yy * bw + xx]);
        }
      }
      bg[by * bw + bx] = Math.max(m, 1);
    }
  }
  // Bilinear lookup between block centres.
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max((y + 0.5) / block - 0.5, 0), bh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, bh - 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max((x + 0.5) / block - 0.5, 0), bw - 1);
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, bw - 1);
      const tx = fx - x0;
      const b =
        bg[y0 * bw + x0] * (1 - tx) * (1 - ty) +
        bg[y0 * bw + x1] * tx * (1 - ty) +
        bg[y1 * bw + x0] * (1 - tx) * ty +
        bg[y1 * bw + x1] * tx * ty;
      grey[y * w + x] = Math.min(255, (grey[y * w + x] / b) * 255);
    }
  }
}

/** The picture as the model expects it: 3×384×384, formula centred on black padding. */
async function prepare(image: Blob, crop?: CropFractions): Promise<Float32Array> {
  const bitmap = await createImageBitmap(image);
  const sx = crop ? Math.round(crop.x * bitmap.width) : 0;
  const sy = crop ? Math.round(crop.y * bitmap.height) : 0;
  const sw = Math.max(1, crop ? Math.round(crop.width * bitmap.width) : bitmap.width);
  const sh = Math.max(1, crop ? Math.round(crop.height * bitmap.height) : bitmap.height);
  const scale = Math.min(1, WORK_SIZE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff"; // transparent PNGs read as white paper
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;

  let grey = new Uint8ClampedArray(w * h);
  for (let i = 0; i < grey.length; i++) {
    grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }

  // Light writing on a dark background (a dark-mode screenshot, a blackboard): most
  // pixels are background, so the ink is whichever side of the median is rarer.
  const mid = median(grey);
  let brighter = 0;
  let darker = 0;
  for (const v of grey) {
    if (v > mid + 40) brighter++;
    else if (v < mid - 40) darker++;
  }
  if (brighter > darker * 1.5) for (let i = 0; i < grey.length; i++) grey[i] = 255 - grey[i];

  flattenBackground(grey, w, h);

  // Stretch so the ink is black and faint paper texture turns white.
  const ink = percentile(grey, 0.005);
  if (ink < 200) {
    const range = 235 - ink;
    for (let i = 0; i < grey.length; i++) grey[i] = ((grey[i] - ink) / range) * 255;
  }

  // Trim the margins down to the writing.
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grey[y * w + x] < 200) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0) throw new Error("There's no writing in this picture: try cropping closer to the formula.");
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const trimmed = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const v = grey[(y + y0) * w + (x + x0)];
      const o = (y * cw + x) * 4;
      trimmed[o] = trimmed[o + 1] = trimmed[o + 2] = v;
      trimmed[o + 3] = 255;
    }
  }
  grey = new Uint8ClampedArray(0);

  // Fit inside 384×384, keeping the shape, centred on black like the training images.
  const fit = Math.min(SIZE / cw, SIZE / ch);
  const nw = Math.max(1, Math.round(cw * fit));
  const nh = Math.max(1, Math.round(ch * fit));
  const source = new OffscreenCanvas(cw, ch);
  source.getContext("2d")!.putImageData(new ImageData(trimmed, cw, ch), 0, 0);
  const target = new OffscreenCanvas(SIZE, SIZE);
  const tctx = target.getContext("2d", { willReadFrequently: true })!;
  tctx.fillStyle = "#000";
  tctx.fillRect(0, 0, SIZE, SIZE);
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(source, Math.floor((SIZE - nw) / 2), Math.floor((SIZE - nh) / 2), nw, nh);
  const out = tctx.getImageData(0, 0, SIZE, SIZE).data;

  const plane = SIZE * SIZE;
  const pixels = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    const v = (out[i * 4] / 255 - MEAN) / STD;
    pixels[i] = pixels[plane + i] = pixels[plane * 2 + i] = v;
  }
  return pixels;
}

// ─── Messages ────────────────────────────────────────────────────────────────

let download: AbortController | null = null;

self.onmessage = async (event: MessageEvent<ReaderRequest>) => {
  const msg = event.data;
  switch (msg.type) {
    case "download": {
      if (download) return;
      download = new AbortController();
      try {
        const stored = await downloadModel((progress) => post({ type: "progress", progress }), download.signal);
        post({ type: "downloaded", stored });
      } catch (e: any) {
        const cancelled = e?.name === "AbortError";
        post({ type: "download-error", cancelled, message: cancelled ? "Download cancelled." : e?.message || String(e) });
      } finally {
        download = null;
      }
      return;
    }
    case "cancel":
      download?.abort();
      return;
    case "warmup":
      loadModel().catch((e) => post({ type: "load-error", message: e?.message || String(e) }));
      return;
    case "read": {
      try {
        const { model, tokenizer, Tensor } = await loadModel();
        const started = performance.now();
        const pixels = await prepare(msg.image, msg.crop);
        const input = new Tensor("float32", pixels, [1, 3, SIZE, SIZE]);
        const output = await model.generate({ inputs: input, max_new_tokens: 768 });
        const latex: string = tokenizer.batch_decode(output, { skip_special_tokens: true })[0] ?? "";
        post({ type: "result", id: msg.id, latex: latex.trim(), ms: Math.round(performance.now() - started) });
      } catch (e: any) {
        post({ type: "read-error", id: msg.id, message: e?.message || String(e) });
      }
      return;
    }
  }
};
