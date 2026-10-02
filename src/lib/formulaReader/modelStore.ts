/**
 * The formula reader's files, kept in the browser's Origin Private File System (OPFS).
 *
 * The reader is the Texo FormulaNet model (about 80 MB) plus the ONNX Runtime
 * WebAssembly binary that runs it (about 21 MB). They are downloaded once, streamed
 * straight to disk, and read from there every time after, so formulas can be read
 * offline and nothing is fetched twice.
 *
 * Layout: formula-reader/<MODEL_VERSION>/<file>, plus manifest.json, written last. A
 * download that stopped halfway has no manifest, so it never counts as installed.
 *
 * Used by both the page (status, remove) and the reader's worker (download, load).
 */
import { fetchOk, writeResponse } from "../../utils/opfsDownload";
import ortWasmUrl from "../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url";

/** Folder name for this model build. Changing it makes every browser download afresh. */
export const MODEL_VERSION = "texo-formulanet-1";
export const MODEL_ID = "alephpi/FormulaNet";

export interface ModelFile {
  /** Path as Transformers.js asks for it. */
  path: string;
  /** Expected size, for progress before the server says (and a sanity check after). */
  size: number;
}

/** The model's files, as published by Texo. */
export const MODEL_FILES: ModelFile[] = [
  { path: "config.json", size: 5014 },
  { path: "generation_config.json", size: 213 },
  { path: "tokenizer.json", size: 17318 },
  { path: "tokenizer_config.json", size: 936 },
  { path: "onnx/encoder_model.onnx", size: 54168561 },
  { path: "onnx/decoder_model_merged.onnx", size: 25946299 },
];

/** The runtime binary, served from this app so its version always matches the code. */
export const RUNTIME_FILE: ModelFile = { path: "ort-wasm-simd-threaded.jsep.wasm", size: 21596019 };

export const TOTAL_BYTES = [...MODEL_FILES, RUNTIME_FILE].reduce((sum, f) => sum + f.size, 0);

/**
 * Where the model comes from: Hugging Face first, and the copy kept in the Texo-web
 * repository on GitHub if Hugging Face can't be reached. One download uses one source
 * for every file, so a set is never mixed.
 */
const MODEL_SOURCES: { name: string; url: (path: string) => string }[] = [
  { name: "Hugging Face", url: (p) => `https://huggingface.co/${MODEL_ID}/resolve/main/${p}` },
  {
    name: "GitHub",
    url: (p) => `https://raw.githubusercontent.com/alephpi/Texo-web/4cff3bcff82846b31d7c1207d883e1b29d2b7db0/models/model/${p}`,
  },
];

const ROOT_DIR = "formula-reader";
const MANIFEST = "manifest.json";

interface Manifest {
  version: string;
  source: string;
  savedAt: number;
  files: Record<string, number>;
}

export interface StoredModel {
  bytes: number;
  savedAt: number;
  source: string;
}

/** OPFS file names can't contain "/": onnx/encoder_model.onnx → onnx__encoder_model.onnx. */
const fileName = (path: string) => path.replace(/\//g, "__");

export function isStorageAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.storage && typeof navigator.storage.getDirectory === "function";
}

async function versionDir(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const base = await root.getDirectoryHandle(ROOT_DIR, { create });
  return base.getDirectoryHandle(MODEL_VERSION, { create });
}

async function readManifest(dir: FileSystemDirectoryHandle): Promise<Manifest | null> {
  try {
    const file = await (await dir.getFileHandle(MANIFEST)).getFile();
    const manifest = JSON.parse(await file.text()) as Manifest;
    return manifest.version === MODEL_VERSION ? manifest : null;
  } catch {
    return null;
  }
}

/** The installed model, or null if it hasn't been downloaded (or a download didn't finish). */
export async function getStoredModel(): Promise<StoredModel | null> {
  if (!isStorageAvailable()) return null;
  try {
    const dir = await versionDir(false);
    const manifest = await readManifest(dir);
    if (!manifest) return null;
    let bytes = 0;
    for (const [name, size] of Object.entries(manifest.files)) {
      const file = await (await dir.getFileHandle(name)).getFile();
      if (file.size !== size) return null;
      bytes += size;
    }
    return { bytes, savedAt: manifest.savedAt, source: manifest.source };
  } catch {
    return null;
  }
}

/** Deletes every downloaded version of the reader. */
export async function removeStoredModel(): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(ROOT_DIR, { recursive: true });
  } catch {
    // Nothing was stored.
  }
}

/** A stored file's contents, for the worker to hand to Transformers.js and ONNX Runtime. */
export async function readStoredFile(path: string): Promise<File | null> {
  try {
    const dir = await versionDir(false);
    return await (await dir.getFileHandle(fileName(path))).getFile();
  } catch {
    return null;
  }
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  /** The file being fetched, for the progress line. */
  file: string;
  source: string;
}

/**
 * Downloads the reader into OPFS. Resolves when every file is stored and the manifest
 * written; a cancelled or failed download leaves nothing that counts as installed.
 */
export async function downloadModel(onProgress: (p: DownloadProgress) => void, signal: AbortSignal): Promise<StoredModel> {
  if (!isStorageAvailable()) throw new Error("This browser can't store files for the site (OPFS is unavailable), so the reader can't be kept.");

  const estimate = await navigator.storage.estimate?.().catch(() => null);
  if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < TOTAL_BYTES * 1.1) {
    throw new Error(`Not enough storage space: the reader needs ${Math.round(TOTAL_BYTES / 1e6)} MB.`);
  }

  // Start clean: an earlier attempt may have left partial files.
  await removeStoredModel();
  const dir = await versionDir(true);

  // Pick the source with the small config file, then take every file from it.
  let source = MODEL_SOURCES[0];
  let firstResponse: Response | null = null;
  const failures: string[] = [];
  for (const candidate of MODEL_SOURCES) {
    try {
      firstResponse = await fetchOk(candidate.url(MODEL_FILES[0].path), signal);
      source = candidate;
      break;
    } catch (e: any) {
      if (signal.aborted) throw e;
      failures.push(`${candidate.name}: ${e?.message || e}`);
    }
  }
  if (!firstResponse) throw new Error(`Couldn't reach the model download (${failures.join("; ")}).`);

  let loaded = 0;
  const report = (file: string) => onProgress({ loaded, total: TOTAL_BYTES, file, source: source.name });
  const sizes: Record<string, number> = {};

  const store = async (file: ModelFile, response: Response) => {
    report(file.path);
    const size = await writeResponse(dir, fileName(file.path), response, (n) => {
      loaded += n;
      report(file.path);
    }, signal);
    if (size === 0) throw new Error(`${file.path} came back empty.`);
    sizes[fileName(file.path)] = size;
  };

  await store(MODEL_FILES[0], firstResponse);
  for (const file of MODEL_FILES.slice(1)) await store(file, await fetchOk(source.url(file.path), signal));
  await store(RUNTIME_FILE, await fetchOk(ortWasmUrl, signal));

  const manifest: Manifest = { version: MODEL_VERSION, source: source.name, savedAt: Date.now(), files: sizes };
  await writeResponse(dir, MANIFEST, new Response(JSON.stringify(manifest)), () => {}, signal);

  return { bytes: Object.values(sizes).reduce((a, b) => a + b, 0), savedAt: manifest.savedAt, source: source.name };
}
