/**
 * The ffmpeg engine (ffmpeg.wasm core: a small loader plus a ~31 MB WebAssembly binary),
 * downloaded once and kept on the device so the audio tools work offline afterwards.
 *
 * Kept in the Origin Private File System (OPFS), streamed straight to disk; where OPFS
 * isn't available or can't be written from the page (older Safari), in IndexedDB instead.
 * A manifest is written last, so a download that stopped halfway never counts as installed.
 */
import { fetchOk, writeResponse } from "../opfsDownload";

/** The core build (single-threaded: needs no cross-origin isolation headers). */
export const CORE_VERSION = "0.12.10";

const FILES = [
  { name: "ffmpeg-core.js", size: 112_000, type: "text/javascript" },
  { name: "ffmpeg-core.wasm", size: 32_130_000, type: "application/wasm" },
];
export const CORE_BYTES = FILES.reduce((n, f) => n + f.size, 0);

const SOURCES = [
  { name: "jsDelivr", url: (f: string) => `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm/${f}` },
  { name: "unpkg", url: (f: string) => `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm/${f}` },
];

const DIR = "ffmpeg-core";
const MANIFEST = "manifest.json";
const DB = "ffmpeg-core";
const STORE = "files";

export type CoreLocation = "opfs" | "indexeddb";

interface Manifest {
  version: string;
  source: string;
  savedAt: number;
  files: Record<string, number>;
}

export interface StoredCore {
  where: CoreLocation;
  bytes: number;
  savedAt: number;
}

export interface CoreProgress {
  loaded: number;
  total: number;
  source: string;
  where: CoreLocation;
}

/** The download itself failed (offline, server error): keeping it elsewhere won't help. */
class NetworkError extends Error {}

async function get(url: string, signal: AbortSignal) {
  try {
    return await fetchOk(url, signal);
  } catch (e: any) {
    if (signal.aborted || e?.name === "AbortError") throw e;
    throw new NetworkError(e?.message || String(e));
  }
}

async function pickSource(signal: AbortSignal) {
  const failures: string[] = [];
  for (const source of SOURCES) {
    try {
      return { source, first: await get(source.url(FILES[0].name), signal) };
    } catch (e: any) {
      if (signal.aborted) throw e;
      failures.push(`${source.name}: ${e?.message || e}`);
    }
  }
  throw new NetworkError(`Couldn't reach the download (${failures.join("; ")}).`);
}

const sum = (m: Manifest) => Object.values(m.files).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- OPFS

const hasOpfs = () => typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";

async function opfsDir(create: boolean) {
  const root = await navigator.storage.getDirectory();
  return (await root.getDirectoryHandle(DIR, { create })).getDirectoryHandle(CORE_VERSION, { create });
}

async function opfsManifest(): Promise<Manifest | null> {
  if (!hasOpfs()) return null;
  try {
    const dir = await opfsDir(false);
    const m = JSON.parse(await (await (await dir.getFileHandle(MANIFEST)).getFile()).text()) as Manifest;
    for (const [name, size] of Object.entries(m.files)) if ((await (await dir.getFileHandle(name)).getFile()).size !== size) return null;
    return m.version === CORE_VERSION ? m : null;
  } catch {
    return null;
  }
}

async function opfsRemove() {
  if (hasOpfs()) await (await navigator.storage.getDirectory()).removeEntry(DIR, { recursive: true }).catch(() => {});
}

async function toOpfs(onProgress: (p: CoreProgress) => void, signal: AbortSignal): Promise<StoredCore> {
  await opfsRemove();
  const dir = await opfsDir(true);
  const { source, first } = await pickSource(signal);
  let loaded = 0;
  const files: Record<string, number> = {};
  for (const f of FILES) {
    const res = f === FILES[0] ? first : await get(source.url(f.name), signal);
    const size = await writeResponse(dir, f.name, res, (n) => onProgress({ loaded: (loaded += n), total: CORE_BYTES, source: source.name, where: "opfs" }), signal);
    if (!size) throw new NetworkError(`${f.name} came back empty.`);
    files[f.name] = size;
  }
  const m: Manifest = { version: CORE_VERSION, source: source.name, savedAt: Date.now(), files };
  await writeResponse(dir, MANIFEST, new Response(JSON.stringify(m)), () => {}, signal);
  return { where: "opfs", bytes: sum(m), savedAt: m.savedAt };
}

// ---------------------------------------------------------------- IndexedDB

const hasIdb = () => typeof indexedDB !== "undefined";

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => (db.close(), resolve(req ? (req.result as T) : undefined));
      tx.onerror = tx.onabort = () => (db.close(), reject(tx.error || new Error("Storage write failed")));
    };
  });
}

const idbGet = <T,>(key: string) => idb<T>("readonly", (s) => s.get(key) as IDBRequest<T>);
const idbPut = (key: string, value: unknown) => idb("readwrite", (s) => void s.put(value, key));

async function idbManifest(): Promise<Manifest | null> {
  if (!hasIdb()) return null;
  try {
    const m = await idbGet<Manifest>(`${CORE_VERSION}/${MANIFEST}`);
    if (!m || m.version !== CORE_VERSION) return null;
    for (const [name, size] of Object.entries(m.files)) if ((await idbGet<Blob>(`${CORE_VERSION}/${name}`))?.size !== size) return null;
    return m;
  } catch {
    return null;
  }
}

const idbRemove = () =>
  hasIdb()
    ? new Promise<void>((r) => {
        const req = indexedDB.deleteDatabase(DB);
        req.onsuccess = req.onerror = req.onblocked = () => r();
      })
    : Promise.resolve();

async function toIdb(onProgress: (p: CoreProgress) => void, signal: AbortSignal): Promise<StoredCore> {
  await idbRemove();
  const { source, first } = await pickSource(signal);
  let loaded = 0;
  const files: Record<string, number> = {};
  for (const f of FILES) {
    const res = f === FILES[0] ? first : await get(source.url(f.name), signal);
    const reader = res.body!.getReader();
    const parts: BlobPart[] = [];
    for (;;) {
      if (signal.aborted) throw (reader.cancel().catch(() => {}), new DOMException("Download cancelled", "AbortError"));
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      onProgress({ loaded: (loaded += value.byteLength), total: CORE_BYTES, source: source.name, where: "indexeddb" });
    }
    const blob = new Blob(parts, { type: f.type });
    if (!blob.size) throw new NetworkError(`${f.name} came back empty.`);
    await idbPut(`${CORE_VERSION}/${f.name}`, blob);
    files[f.name] = blob.size;
  }
  const m: Manifest = { version: CORE_VERSION, source: source.name, savedAt: Date.now(), files };
  await idbPut(`${CORE_VERSION}/${MANIFEST}`, m);
  return { where: "indexeddb", bytes: sum(m), savedAt: m.savedAt };
}

// ---------------------------------------------------------------- public

/** The installed engine, or null if it isn't downloaded (or a download didn't finish). */
export async function getStoredCore(): Promise<StoredCore | null> {
  const o = await opfsManifest();
  if (o) return { where: "opfs", bytes: sum(o), savedAt: o.savedAt };
  const i = await idbManifest();
  return i ? { where: "indexeddb", bytes: sum(i), savedAt: i.savedAt } : null;
}

/** The engine's files, typed for blob: URLs. */
export async function readCoreFiles(): Promise<{ js: Blob; wasm: Blob } | null> {
  const read = async (fetchOne: (name: string) => Promise<Blob | undefined>) => {
    const [js, wasm] = await Promise.all(FILES.map((f) => fetchOne(f.name)));
    return js && wasm ? { js: new Blob([js], { type: FILES[0].type }), wasm: new Blob([wasm], { type: FILES[1].type }) } : null;
  };
  if (await opfsManifest()) {
    const dir = await opfsDir(false);
    return read(async (n) => (await dir.getFileHandle(n)).getFile());
  }
  if (await idbManifest()) return read((n) => idbGet<Blob>(`${CORE_VERSION}/${n}`));
  return null;
}

export async function removeStoredCore() {
  await opfsRemove();
  await idbRemove();
}

/** Downloads the engine into OPFS, or IndexedDB where OPFS can't be written. */
export async function downloadCore(onProgress: (p: CoreProgress) => void, signal: AbortSignal): Promise<StoredCore> {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  if (est?.quota != null && est.usage != null && est.quota - est.usage < CORE_BYTES * 1.2) {
    throw new Error(`Not enough storage space: the audio engine needs about ${Math.round(CORE_BYTES / 1e6)} MB.`);
  }
  navigator.storage?.persist?.().catch(() => {});
  if (hasOpfs()) {
    try {
      return await toOpfs(onProgress, signal);
    } catch (e: any) {
      await opfsRemove();
      if (signal.aborted || e?.name === "AbortError" || e instanceof NetworkError) throw e;
      console.warn("[ffmpeg] OPFS can't be written here; keeping the engine in IndexedDB", e);
    }
  }
  if (!hasIdb()) throw new Error("This browser can't store files for the site, so the audio engine can't be kept.");
  return toIdb(onProgress, signal);
}
