/**
 * The voice command matcher's model, kept in the browser's Origin Private File System (OPFS).
 *
 * The model is all-MiniLM-L6-v2 (int8, about 23 MB), a sentence-embedding model: it turns a
 * phrase into a vector so phrases that mean the same thing land close together. It is downloaded
 * once, streamed straight to disk, and read from there after, so it is never fetched twice.
 *
 * Layout: voice-matcher/<MODEL_VERSION>/<file>, plus manifest.json, written last. A download that
 * stopped halfway has no manifest, so it never counts as installed.
 */
import { fetchOk, writeResponse } from "../../utils/opfsDownload";

/** Folder name for this model build. Changing it makes every browser download afresh. */
export const MODEL_VERSION = "minilm-l6-v2-q8-1";
export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
/** Pinned, so the files can't change underneath a stored manifest. */
const REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";

export interface ModelFile {
  /** Path as Transformers.js asks for it. */
  path: string;
  /** Expected size, for progress before the server says. */
  size: number;
}

export const MODEL_FILES: ModelFile[] = [
  { path: "config.json", size: 650 },
  { path: "tokenizer.json", size: 711661 },
  { path: "tokenizer_config.json", size: 366 },
  { path: "onnx/model_quantized.onnx", size: 22972370 },
];

export const TOTAL_BYTES = MODEL_FILES.reduce((sum, f) => sum + f.size, 0);

const url = (path: string) => `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${path}`;

const ROOT_DIR = "voice-matcher";
const MANIFEST = "manifest.json";

interface Manifest {
  version: string;
  savedAt: number;
  files: Record<string, number>;
}

export interface StoredModel {
  bytes: number;
  savedAt: number;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
}

/** OPFS file names can't contain "/": onnx/model_quantized.onnx → onnx__model_quantized.onnx. */
const fileName = (path: string) => path.replace(/\//g, "__");

export function isStorageAvailable(): boolean {
  return typeof navigator !== "undefined" && !!navigator.storage && typeof navigator.storage.getDirectory === "function";
}

async function versionDir(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const base = await root.getDirectoryHandle(ROOT_DIR, { create });
  return base.getDirectoryHandle(MODEL_VERSION, { create });
}

/** The installed model, or null if it hasn't been downloaded (or a download didn't finish). */
export async function getStoredModel(): Promise<StoredModel | null> {
  if (!isStorageAvailable()) return null;
  try {
    const dir = await versionDir(false);
    const manifest = JSON.parse(await (await (await dir.getFileHandle(MANIFEST)).getFile()).text()) as Manifest;
    if (manifest.version !== MODEL_VERSION) return null;
    let bytes = 0;
    for (const [name, size] of Object.entries(manifest.files)) {
      const file = await (await dir.getFileHandle(name)).getFile();
      if (file.size !== size) return null;
      bytes += size;
    }
    return { bytes, savedAt: manifest.savedAt };
  } catch {
    return null;
  }
}

/** Deletes every downloaded version of the model. */
export async function removeStoredModel(): Promise<void> {
  if (!isStorageAvailable()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(ROOT_DIR, { recursive: true });
  } catch {
    // Nothing was stored.
  }
}

/** A stored file's contents, for the worker to hand to Transformers.js. */
export async function readStoredFile(path: string): Promise<File | null> {
  try {
    const dir = await versionDir(false);
    return await (await dir.getFileHandle(fileName(path))).getFile();
  } catch {
    return null;
  }
}

/**
 * Downloads the model into OPFS. Resolves when every file is stored and the manifest written; a
 * cancelled or failed download leaves nothing that counts as installed.
 */
export async function downloadModel(onProgress: (p: DownloadProgress) => void, signal: AbortSignal): Promise<StoredModel> {
  if (!isStorageAvailable()) throw new Error("This browser can't store files for the site (OPFS is unavailable).");

  // Start clean: an earlier attempt may have left partial files.
  await removeStoredModel();
  const dir = await versionDir(true);

  let loaded = 0;
  const sizes: Record<string, number> = {};
  for (const file of MODEL_FILES) {
    const size = await writeResponse(dir, fileName(file.path), await fetchOk(url(file.path), signal), (n) => {
      loaded += n;
      onProgress({ loaded, total: TOTAL_BYTES });
    }, signal);
    if (size === 0) throw new Error(`${file.path} came back empty.`);
    sizes[fileName(file.path)] = size;
  }

  const manifest: Manifest = { version: MODEL_VERSION, savedAt: Date.now(), files: sizes };
  await writeResponse(dir, MANIFEST, new Response(JSON.stringify(manifest)), () => {}, signal);
  return { bytes: Object.values(sizes).reduce((a, b) => a + b, 0), savedAt: manifest.savedAt };
}
