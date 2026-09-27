/**
 * The page's side of the formula reader: one worker shared by every math node, with
 * promises for downloading the model and reading an image.
 */
import type { CropFractions, ReaderRequest } from "../../workers/formulaReader.worker";
import type { DownloadProgress, StoredModel } from "./modelStore";

export type { CropFractions, DownloadProgress, StoredModel };

export interface ReadResult {
  latex: string;
  /** Time spent preparing the image and running the model. */
  ms: number;
}

type Listener = (message: any) => void;

let worker: Worker | null = null;
const listeners = new Set<Listener>();
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/formulaReader.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event) => listeners.forEach((l) => l(event.data));
  }
  return worker;
}

const send = (message: ReaderRequest) => getWorker().postMessage(message);

function listen(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Model load stages, for "Starting the reader…" while it loads the first time. */
export function onReaderStatus(listener: (status: "loading" | "ready" | "error", detail?: string) => void) {
  return listen((m) => {
    if (m.type === "loading") listener("loading");
    else if (m.type === "ready") listener("ready");
    else if (m.type === "load-error") listener("error", m.message);
  });
}

/**
 * Downloads the reader into this browser's storage. Also asks the browser to keep the
 * site's storage (so a cleanup under disk pressure doesn't delete 100 MB).
 */
export function downloadReader(onProgress: (p: DownloadProgress) => void): Promise<StoredModel> {
  navigator.storage?.persist?.().catch(() => {});
  return new Promise((resolve, reject) => {
    const stop = listen((m) => {
      if (m.type === "progress") onProgress(m.progress);
      else if (m.type === "downloaded") {
        stop();
        resolve(m.stored);
      } else if (m.type === "download-error") {
        stop();
        const error = new Error(m.message);
        (error as any).cancelled = m.cancelled;
        reject(error);
      }
    });
    send({ type: "download" });
  });
}

export function cancelReaderDownload() {
  if (worker) send({ type: "cancel" });
}

/** Loads the model ahead of time, so the first read doesn't wait for it. */
export function warmUpReader() {
  send({ type: "warmup" });
}

/** Reads the formula in an image (optionally a part of it) as LaTeX. */
export function readFormula(image: Blob, crop?: CropFractions): Promise<ReadResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const stop = listen((m) => {
      if (m.id !== id) return;
      if (m.type === "result") {
        stop();
        resolve({ latex: m.latex, ms: m.ms });
      } else if (m.type === "read-error") {
        stop();
        reject(new Error(m.message));
      }
    });
    send({ type: "read", id, image, crop });
  });
}

/** Stops the worker and frees the model's memory (after the files are removed). */
export function shutDownReader() {
  worker?.terminate();
  worker = null;
}

/**
 * The reader writes every token apart ("x ^ { 2 } + 9 0"); this joins them back into
 * ordinary LaTeX ("x^{2}+90"), keeping a space only where LaTeX needs one (\sin x).
 */
export function tidyLatex(latex: string): string {
  const tokens = latex.replace(/~/g, " ").replace(/\\!/g, "").trim().split(/\s+/);
  const operator = /^(=|<|>|\\le|\\ge|\\leq|\\geq|\\neq|\\approx|\+|-|\\cdot|\\times|\\pm|&|\\\\)$/;
  const afterOperator = /(^|[=(<>{,&[]|\\le|\\ge|\\leq|\\geq|\\neq|\\approx|\\cdot|\\times|\\pm|\\left\(|[+-])\s*$/;
  let out = "";
  for (const token of tokens) {
    if (!token) continue;
    const unary = (token === "-" || token === "+") && afterOperator.test(out);
    if (unary) out += token;
    else if (operator.test(token)) out = `${out.trimEnd()} ${token} `;
    else if (/\\[A-Za-z]+\*?$/.test(out) && /^[A-Za-z0-9]/.test(token)) out += ` ${token}`;
    else out += token;
  }
  return unwrapSingleLine(out.replace(/ \\\\ /g, " \\\\\n").replace(/ {2,}/g, " ").trim());
}

/** The reader often wraps a single line in \begin{array}{r}{…}\end{array}; drop that. */
function unwrapSingleLine(latex: string): string {
  const m = latex.match(/^\\begin\{array\}\{[lcr ]*\}([\s\S]*)\\end\{array\}$/);
  if (!m || m[1].includes("\\\\") || m[1].includes("&")) return latex;
  let inner = m[1].trim();
  // Strip one pair of braces around the whole line, if they match each other.
  if (inner.startsWith("{") && inner.endsWith("}")) {
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "{") depth++;
      else if (inner[i] === "}") depth--;
      if (depth === 0 && i < inner.length - 1) {
        wraps = false;
        break;
      }
    }
    if (wraps) inner = inner.slice(1, -1).trim();
  }
  return inner;
}
