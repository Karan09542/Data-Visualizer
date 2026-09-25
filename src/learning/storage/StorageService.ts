/**
 * Offline storage for Learning Games: one JSON document per key.
 *
 * OPFS is preferred. Where it cannot be written (older Safari lacks createWritable, some private
 * windows refuse the directory) documents go to IndexedDB instead, and if neither works they are
 * kept in memory for the session so the feature still runs.
 */
import Dexie, { type Table } from "dexie";
import { opfsDirectory } from "../../utils/deviceFileStore";
import type { StorageKind } from "../types";

export interface StorageBackend {
  readonly kind: StorageKind;
  read(key: string): Promise<string | null>;
  write(key: string, data: string): Promise<void>;
}

const OPFS_FOLDER = ["learning-games"];

class OpfsBackend implements StorageBackend {
  readonly kind = "opfs" as const;

  private async dir(): Promise<FileSystemDirectoryHandle> {
    // Looked up each time so a folder cleared from site settings is simply made again.
    const dir = await opfsDirectory(OPFS_FOLDER);
    if (!dir) throw new Error("OPFS is not available");
    return dir;
  }

  async read(key: string): Promise<string | null> {
    try {
      const handle = await (await this.dir()).getFileHandle(`${key}.json`, { create: false });
      const file = await handle.getFile();
      return file.size === 0 ? null : await file.text();
    } catch (e) {
      if ((e as DOMException)?.name === "NotFoundError") return null;
      throw e;
    }
  }

  async write(key: string, data: string): Promise<void> {
    const handle = await (await this.dir()).getFileHandle(`${key}.json`, { create: true });
    // createWritable writes to a swap file and only replaces the original on close(), so a crash
    // mid-write leaves the previous version intact.
    const writable = await (handle as any).createWritable();
    try {
      await writable.write(data);
      await writable.close();
    } catch (e) {
      try { await writable.abort?.(); } catch { /* already closed */ }
      throw e;
    }
  }
}

interface DocRow {
  key: string;
  data: string;
  updatedAt: number;
}

class LearningDexie extends Dexie {
  docs!: Table<DocRow, string>;
  constructor() {
    super("LearningGamesDB");
    this.version(1).stores({ docs: "key" });
  }
}

class IndexedDbBackend implements StorageBackend {
  readonly kind = "indexeddb" as const;
  private db = new LearningDexie();

  async read(key: string): Promise<string | null> {
    const row = await this.db.docs.get(key);
    return row?.data ?? null;
  }

  async write(key: string, data: string): Promise<void> {
    await this.db.docs.put({ key, data, updatedAt: Date.now() });
  }
}

class MemoryBackend implements StorageBackend {
  readonly kind = "memory" as const;
  private docs = new Map<string, string>();

  async read(key: string) {
    return this.docs.get(key) ?? null;
  }

  async write(key: string, data: string) {
    this.docs.set(key, data);
  }
}

const PROBE_KEY = "__probe";

/** A backend is usable only if a write can be read back; some browsers expose APIs that then throw. */
async function probe(backend: StorageBackend): Promise<boolean> {
  try {
    const token = String(Date.now());
    await backend.write(PROBE_KEY, token);
    return (await backend.read(PROBE_KEY)) === token;
  } catch {
    return false;
  }
}

/**
 * Copies documents from IndexedDB into OPFS the first time OPFS is used, for people whose
 * browser gained OPFS support after they had already saved words through the fallback.
 */
async function migrateFromIndexedDb(opfs: StorageBackend, keys: readonly string[]): Promise<void> {
  try {
    if (!(await Dexie.exists("LearningGamesDB"))) return;
    const idb = new IndexedDbBackend();
    for (const key of keys) {
      if ((await opfs.read(key)) !== null) continue;
      const data = await idb.read(key);
      if (data !== null) await opfs.write(key, data);
    }
  } catch (e) {
    console.warn("[learning] could not migrate IndexedDB data to OPFS", e);
  }
}

export class StorageService {
  /** Writes waiting for the one in flight on the same key; only the newest is kept. */
  private pending = new Map<string, string>();
  private inFlight = new Map<string, Promise<void>>();

  private constructor(private backend: StorageBackend) {}

  get kind(): StorageKind {
    return this.backend.kind;
  }

  static async create(keys: readonly string[]): Promise<StorageService> {
    const opfs = new OpfsBackend();
    if (await probe(opfs)) {
      await migrateFromIndexedDb(opfs, keys);
      return new StorageService(opfs);
    }
    const idb = new IndexedDbBackend();
    if (await probe(idb)) return new StorageService(idb);
    console.warn("[learning] no persistent storage available; progress lasts until the tab closes");
    return new StorageService(new MemoryBackend());
  }

  /** Reads and parses a document, or null if it is missing or unreadable. */
  async load<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.backend.read(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (e) {
      console.warn(`[learning] could not read "${key}"`, e);
      return null;
    }
  }

  /**
   * Saves a document. Writes to the same key never overlap: while one is running, later values
   * replace each other and only the last is written when it finishes.
   */
  save(key: string, value: unknown): Promise<void> {
    this.pending.set(key, JSON.stringify(value));
    const running = this.inFlight.get(key);
    if (running) return running;

    const run = (async () => {
      try {
        while (this.pending.has(key)) {
          const data = this.pending.get(key)!;
          this.pending.delete(key);
          await this.backend.write(key, data);
        }
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, run);
    return run;
  }

  /** Resolves once every queued write has reached storage. */
  async flush(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled([...this.inFlight.values()]);
    }
  }

  isBusy(key: string): boolean {
    return this.inFlight.has(key) || this.pending.has(key);
  }
}

/** Asks the browser not to evict our storage under pressure. Best effort; ignored where unsupported. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    // Not supported or refused: storage stays "best effort".
  }
}
