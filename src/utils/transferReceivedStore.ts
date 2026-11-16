/**
 * Files received through the Transfer node, kept in OPFS until the user saves or deletes them.
 *
 * Incoming chunks go to a worker that writes them straight to disk (see transferWriteWorker), so
 * a large file never sits in memory. The list of files (name, size, sender, state) is kept in
 * localStorage: small, synchronous, and readable even where the main thread cannot write OPFS.
 */
import { downloadBlob } from './downloadUtils';

const FOLDER = 'transfer-received';
/** Where transferThumbs keeps previews (named here too, so deleting a file removes its preview). */
const THUMBS = 'transfer-received-thumbs';
const RECORDS_KEY = 'dv-transfer-received-v1';
const SETTINGS_KEY = 'dv-transfer-received-settings-v1';

export type ReceivedStatus = 'receiving' | 'partial' | 'complete' | 'damaged';

export interface ReceivedFileRecord {
  id: string;
  name: string;
  size: number;
  mime: string;
  /** Bytes on disk so far. */
  received: number;
  status: ReceivedStatus;
  receivedAt: number;
  from?: string;
  savedAt?: number;
}

export type AutoClean = 'off' | 'saved' | '1d' | '7d' | '30d';
export interface ReceivedSettings {
  autoClean: AutoClean;
  /** How the panel shows files. */
  view: 'list' | 'grid';
  /** Picture and video previews in the panel. */
  previews: boolean;
  /** The panel fills the screen. */
  fullscreen: boolean;
  /** The order files are listed in. */
  sort: ReceivedSort;
}
export type ReceivedSort = 'newest' | 'oldest' | 'largest' | 'name';

/* ---------------------------------------------------------------- records */

const storedName = (id: string) => `${id}.bin`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// A transfer cannot outlive the page, so anything still "receiving" was interrupted.
let records: ReceivedFileRecord[] = readJSON<ReceivedFileRecord[]>(RECORDS_KEY, []).map((r) =>
  r.status === 'receiving' ? { ...r, status: 'partial' } : r,
);
let settings: ReceivedSettings = { autoClean: 'off', view: 'list', previews: true, fullscreen: false, sort: 'newest', ...readJSON<Partial<ReceivedSettings>>(SETTINGS_KEY, {}) };

const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const persist = () => {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    /* storage full or blocked: the list is rebuilt from what survives */
  }
};
/** Something changed: tell the panel now, write the list soon (progress changes it often). */
const changed = (immediate = false) => {
  listeners.forEach((fn) => fn());
  if (immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    persist();
  } else if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist();
    }, 1000);
  }
};

const patch = (id: string, p: Partial<ReceivedFileRecord>, immediate = false) => {
  records = records.map((r) => (r.id === id ? { ...r, ...p } : r));
  changed(immediate);
};

export const listReceived = (): ReceivedFileRecord[] => records;
export const getReceivedRecord = (id: string) => records.find((r) => r.id === id);

export function subscribeReceived(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getReceivedSettings = () => settings;
export function setReceivedSettings(next: Partial<ReceivedSettings>) {
  settings = { ...settings, ...next };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* kept for this session only */
  }
  changed();
  if ('autoClean' in next) void applyAutoClean();
}

/* ------------------------------------------------------------------ OPFS */

let folderP: Promise<FileSystemDirectoryHandle | null> | null = null;
const folder = () =>
  (folderP ??= (async () => {
    try {
      const root = await navigator.storage.getDirectory();
      return await root.getDirectoryHandle(FOLDER, { create: true });
    } catch {
      return null;
    }
  })());

/** The stored file, under its real name and type; null when it is gone. */
export async function getReceivedFile(id: string): Promise<File | null> {
  const r = getReceivedRecord(id);
  const dir = await folder();
  if (!r || !dir) return null;
  try {
    const f = await (await dir.getFileHandle(storedName(id))).getFile();
    return new File([f], r.name, { type: r.mime || f.type, lastModified: r.receivedAt });
  } catch {
    return null;
  }
}

const thumbsFolder = async () => {
  try {
    return await (await navigator.storage.getDirectory()).getDirectoryHandle(THUMBS, { create: true });
  } catch {
    return null;
  }
};

export async function deleteReceived(ids: string[]): Promise<void> {
  const dir = await folder();
  const thumbs = await thumbsFolder();
  const gone = new Set<string>();
  for (const id of ids) {
    const r = getReceivedRecord(id);
    if (!r || r.status === 'receiving') continue; // still being written
    try {
      await dir?.removeEntry(storedName(id));
    } catch {
      /* already gone */
    }
    thumbs?.removeEntry(`${id}.jpg`).catch(() => {});
    gone.add(id);
  }
  if (!gone.size) return;
  records = records.filter((r) => !gone.has(r.id));
  changed(true);
}

/**
 * Brings the list and the folder back in step: entries whose file is gone are dropped, files no
 * entry points at are deleted, sizes are read from disk. Then auto-clean runs.
 */
export async function refreshReceived(): Promise<void> {
  const dir = await folder();
  if (!dir) return;
  const onDisk = new Map<string, number>();
  try {
    for await (const h of (dir as any).values()) {
      if (h.kind === 'file') onDisk.set(h.name, (await h.getFile()).size);
    }
  } catch {
    return;
  }
  const known = new Set(records.map((r) => storedName(r.id)));
  for (const name of onDisk.keys()) {
    if (!known.has(name)) {
      try {
        await dir.removeEntry(name);
      } catch {
        /* in use */
      }
    }
  }
  // Previews whose file is gone.
  const thumbs = await thumbsFolder();
  if (thumbs) {
    const ids = new Set(records.map((r) => `${r.id}.jpg`));
    try {
      for await (const h of (thumbs as any).values()) if (!ids.has(h.name)) await thumbs.removeEntry(h.name).catch(() => {});
    } catch {
      /* listing not supported */
    }
  }
  records = records
    .filter((r) => r.status === 'receiving' || onDisk.has(storedName(r.id)))
    .map((r) => (r.status === 'receiving' ? r : { ...r, received: onDisk.get(storedName(r.id)) ?? r.received }));
  changed(true);
  await applyAutoClean();
}

const DAY = 24 * 60 * 60 * 1000;
export async function applyAutoClean(): Promise<void> {
  const a = settings.autoClean;
  if (a === 'off') return;
  const now = Date.now();
  const maxAge = a === '1d' ? DAY : a === '7d' ? 7 * DAY : a === '30d' ? 30 * DAY : Infinity;
  const old = records.filter(
    (r) => r.status !== 'receiving' && (a === 'saved' ? !!r.savedAt : now - r.receivedAt > maxAge),
  );
  if (old.length) await deleteReceived(old.map((r) => r.id));
}

export interface StorageInfo {
  /** Bytes the received files take. */
  used: number;
  /** What this site may still use, when the browser says. */
  free: number | null;
  quota: number | null;
  persisted: boolean;
}

export async function receivedStorageInfo(): Promise<StorageInfo> {
  const used = records.reduce((s, r) => s + (r.received || 0), 0);
  let free: number | null = null;
  let quota: number | null = null;
  let persisted = false;
  try {
    const e = await navigator.storage.estimate();
    if (e.quota != null) {
      quota = e.quota;
      free = Math.max(0, e.quota - (e.usage || 0));
    }
    persisted = (await navigator.storage.persisted?.()) ?? false;
  } catch {
    /* not reported */
  }
  return { used, free, quota, persisted };
}

/** Asks the browser not to clear these files when space runs low. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- saving */

const markSaved = (id: string) => {
  patch(id, { savedAt: Date.now() }, true);
  if (settings.autoClean === 'saved') void deleteReceived([id]);
};

/**
 * Saves one file to the device: the save dialog where there is one (writes straight from disk),
 * otherwise a normal download. Call it from a tap: the dialog needs one. False when cancelled.
 */
export async function saveReceivedToDevice(id: string): Promise<boolean> {
  const r = getReceivedRecord(id);
  if (!r) return false;
  const picker = (window as any).showSaveFilePicker;
  if (picker) {
    let writable: any;
    try {
      // Opened first, while the tap still counts.
      const handle = await picker({ suggestedName: r.name });
      writable = await handle.createWritable();
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
      writable = null; // the dialog failed: fall back to a download
    }
    if (writable) {
      const file = await getReceivedFile(id);
      if (!file) {
        await writable.abort?.();
        throw new Error('The file is no longer stored');
      }
      await file.stream().pipeTo(writable);
      markSaved(id);
      return true;
    }
  }
  const file = await getReceivedFile(id);
  if (!file) throw new Error('The file is no longer stored');
  downloadBlob(file, r.name);
  markSaved(id);
  return true;
}

/** Saves several: into a chosen folder where the browser can, otherwise as downloads. */
export async function saveManyToDevice(ids: string[]): Promise<number> {
  const picker = (window as any).showDirectoryPicker;
  let saved = 0;
  if (picker) {
    let dir: any;
    try {
      dir = await picker({ mode: 'readwrite' });
    } catch (err: any) {
      if (err?.name === 'AbortError') return 0;
      dir = null;
    }
    if (dir) {
      for (const id of ids) {
        const r = getReceivedRecord(id);
        const file = await getReceivedFile(id);
        if (!r || !file) continue;
        const fh = await dir.getFileHandle(r.name, { create: true });
        await file.stream().pipeTo(await fh.createWritable());
        markSaved(id);
        saved++;
      }
      return saved;
    }
  }
  for (const id of ids) {
    const r = getReceivedRecord(id);
    const file = await getReceivedFile(id);
    if (!r || !file) continue;
    downloadBlob(file, r.name);
    markSaved(id);
    saved++;
    await new Promise((res) => setTimeout(res, 300)); // browsers drop downloads fired together
  }
  return saved;
}

/* -------------------------------------------------------------- receiving */

type Pending = { resolve: (m: any) => void };
let worker: Worker | null = null;
let probeP: Promise<boolean> | null = null;
const waiting = new Map<string, Pending>();
const errorHandlers = new Map<string, (error: string) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/transferWriteWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.op === 'error') {
      errorHandlers.get(m.id)?.(m.error);
      return;
    }
    const key = `${m.op}:${m.id ?? ''}`;
    const w = waiting.get(key);
    if (w) {
      waiting.delete(key);
      w.resolve(m);
    }
  };
  return worker;
}

const ask = (msg: any): Promise<any> =>
  new Promise((resolve) => {
    const w = getWorker();
    if (!w) return resolve({ ok: false, error: 'NoWorker' });
    waiting.set(`${msg.op}:${msg.id ?? ''}`, { resolve });
    w.postMessage(msg);
  });

/** Whether received files can go to OPFS here (worker + sync access handles). */
export function receivedStoreAvailable(): Promise<boolean> {
  return (probeP ??= (async () => {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory || typeof Worker === 'undefined') return false;
    const timeout = new Promise<{ ok: boolean }>((r) => setTimeout(() => r({ ok: false }), 4000));
    const res = await Promise.race([ask({ op: 'probe' }), timeout]);
    return !!res.ok;
  })());
}

export interface ReceiveSink {
  /** Takes ownership of the chunk's buffer (it is moved to the worker, not copied). */
  write(chunk: Uint8Array): void;
  /** All bytes are in: the stored file, or null if writing failed. */
  close(): Promise<File | null>;
  /** Stops; `keep` leaves the partial file listed (for resuming), otherwise it is deleted. */
  abort(keep?: boolean): Promise<void>;
  /** The checksum did not match. */
  markDamaged(): void;
}

/**
 * Starts receiving a file into OPFS, or null where that cannot be done (the caller falls back).
 * `onError` hears of a failed write, such as the disk filling up.
 */
export async function openReceiveSink(
  meta: { id: string; name: string; size: number; mime?: string; from?: string },
  onError?: (error: string) => void,
): Promise<ReceiveSink | null> {
  if (!(await receivedStoreAvailable())) return null;
  const res = await ask({ op: 'open', id: meta.id, name: storedName(meta.id), offset: 0 });
  if (!res.ok) return null;

  records = [
    ...records.filter((r) => r.id !== meta.id),
    {
      id: meta.id,
      name: meta.name || 'file',
      size: meta.size,
      mime: meta.mime || '',
      received: 0,
      status: 'receiving',
      receivedAt: Date.now(),
      from: meta.from,
    },
  ];
  changed(true);

  let done = false;
  let received = 0;
  let lastTick = 0;
  if (onError) {
    errorHandlers.set(meta.id, (err) => {
      errorHandlers.delete(meta.id);
      onError(err);
    });
  }
  const w = getWorker()!;

  return {
    write(chunk) {
      if (done) return;
      const buf = chunk.buffer as ArrayBuffer;
      const len = chunk.byteLength; // read before the buffer moves: it is empty afterwards
      w.postMessage({ op: 'write', id: meta.id, buf, off: chunk.byteOffset, len }, [buf]);
      received += len;
      const now = performance.now();
      if (now - lastTick > 500) {
        lastTick = now;
        patch(meta.id, { received });
      }
    },
    async close() {
      if (done) return null;
      done = true;
      errorHandlers.delete(meta.id);
      const r = await ask({ op: 'close', id: meta.id });
      const current = getReceivedRecord(meta.id);
      patch(meta.id, { received, status: r.ok ? (current?.status === 'damaged' ? 'damaged' : 'complete') : 'partial' }, true);
      return r.ok ? getReceivedFile(meta.id) : null;
    },
    async abort(keep = false) {
      if (done) return;
      done = true;
      errorHandlers.delete(meta.id);
      await ask({ op: 'abort', id: meta.id, name: storedName(meta.id), keep });
      if (keep) patch(meta.id, { received, status: 'partial' }, true);
      else {
        records = records.filter((r) => r.id !== meta.id);
        changed(true);
      }
    },
    markDamaged() {
      patch(meta.id, { status: 'damaged' }, true);
    },
  };
}

/** Whether `bytes` more will fit; free is null when the browser does not say. */
export async function hasRoomFor(bytes: number): Promise<{ ok: boolean; free: number | null }> {
  try {
    const e = await navigator.storage.estimate();
    if (e.quota == null) return { ok: true, free: null };
    const free = e.quota - (e.usage || 0);
    return { ok: free > bytes + 16 * 1024 * 1024, free };
  } catch {
    return { ok: true, free: null };
  }
}
