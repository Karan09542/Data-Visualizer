/**
 * Files kept on the device, keyed by URL: OPFS where the browser can write it, IndexedDB where it
 * cannot. Python wheels and npm modules both live here, each in their own folder and table.
 */
import type { Table } from "dexie";

export type StorageBackend = "opfs" | "indexeddb";

export interface StoredFileRecord {
  url: string;
  data: ArrayBuffer;
  cachedAt: number;
}

let storageRoot: Promise<FileSystemDirectoryHandle | null> | null = null;

/**
 * OPFS's root, or null where it cannot be written - older Safari lacks createWritable, and
 * private windows may refuse the directory altogether.
 */
function writableOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!storageRoot) {
    storageRoot = (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return null;
        if (typeof FileSystemFileHandle === "undefined" || !("createWritable" in FileSystemFileHandle.prototype)) return null;
        return await navigator.storage.getDirectory();
      } catch {
        return null;
      }
    })();
  }
  return storageRoot;
}

/**
 * A folder in OPFS, created as needed; null where OPFS cannot be written. Looked up on every call
 * rather than kept, so a folder that has been cleared is simply made again.
 */
export async function opfsDirectory(path: string[]): Promise<FileSystemDirectoryHandle | null> {
  const root = await writableOpfsRoot();
  if (!root) return null;
  try {
    let dir = root;
    for (const name of path) dir = await dir.getDirectoryHandle(name, { create: true });
    return dir;
  } catch {
    return null;
  }
}

const fnv1a = (text: string, seed: number): string => {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

/** A short, stable file name for a URL: two hashes, then the original name for readability. */
export const fileNameFor = (url: string): string => {
  let last = url.split(/[?#]/)[0].split("/").pop() || "file";
  try {
    last = decodeURIComponent(last);
  } catch {
    // Not valid percent-encoding: use it as it is.
  }
  const base = last.replace(/[^\w.+-]/g, "_").slice(-80);
  return `${fnv1a(url, 0x811c9dc5)}${fnv1a(url, 0x01000193)}-${base}`;
};

export async function directorySize(dir: FileSystemDirectoryHandle): Promise<number> {
  let total = 0;
  for await (const handle of (dir as any).values()) {
    if (handle.kind === "file") total += (await handle.getFile()).size;
    else total += await directorySize(handle);
  }
  return total;
}

export interface DeviceFileStore {
  /** The kept copy, or null when it has never been stored on this device. */
  read(url: string): Promise<ArrayBuffer | null>;
  /** Stores a file; returns where it went. */
  write(url: string, data: ArrayBuffer): Promise<StorageBackend>;
  /** Deletes the kept copy, wherever it is. */
  remove(url: string): Promise<void>;
  size(): Promise<number>;
  clear(): Promise<void>;
  backend(): Promise<StorageBackend>;
}

export function createDeviceFileStore(options: {
  /** Folder path inside OPFS. */
  opfsPath: string[];
  /** IndexedDB table used where OPFS is missing - and read from for copies kept before OPFS was. */
  table: () => Table<StoredFileRecord, string>;
}): DeviceFileStore {
  const folder = () => opfsDirectory(options.opfsPath);

  const write = async (url: string, data: ArrayBuffer): Promise<StorageBackend> => {
    const dir = await folder();
    if (dir) {
      try {
        const handle = await dir.getFileHandle(fileNameFor(url), { create: true });
        const writable = await (handle as any).createWritable();
        await writable.write(data);
        await writable.close();
        return "opfs";
      } catch (err) {
        console.warn("[Device storage] OPFS write failed, keeping it in IndexedDB instead:", err);
      }
    }
    await options.table().put({ url, data, cachedAt: Date.now() });
    return "indexeddb";
  };

  const read = async (url: string): Promise<ArrayBuffer | null> => {
    const dir = await folder();
    if (dir) {
      try {
        const handle = await dir.getFileHandle(fileNameFor(url));
        return await (await handle.getFile()).arrayBuffer();
      } catch {
        // Not in OPFS - it may still be in IndexedDB.
      }
    }
    try {
      const record = await options.table().get(url);
      if (record?.data) {
        if (dir) {
          // Moved across once, so the IndexedDB copy does not linger next to the OPFS one.
          void write(url, record.data)
            .then((where) => (where === "opfs" ? options.table().delete(url) : undefined))
            .catch(() => {});
        }
        return record.data;
      }
    } catch {
      // IndexedDB unavailable too: treat as not kept.
    }
    return null;
  };

  return {
    read,
    write,
    remove: async (url: string) => {
      const dir = await folder();
      if (dir) await dir.removeEntry(fileNameFor(url)).catch(() => {});
      try {
        await options.table().delete(url);
      } catch {
        // No IndexedDB: nothing kept there.
      }
    },
    size: async () => {
      let bytes = 0;
      const dir = await folder();
      if (dir) bytes += await directorySize(dir).catch(() => 0);
      try {
        // One record at a time: loading the whole table would hold every file in memory at once.
        await options.table().each((record) => {
          if (record.data) bytes += record.data.byteLength;
        });
      } catch {
        // No IndexedDB: nothing kept there.
      }
      return bytes;
    },
    clear: async () => {
      const dir = await folder();
      if (dir) {
        const names: string[] = [];
        for await (const [name] of (dir as any).entries()) names.push(name);
        for (const name of names) await dir.removeEntry(name, { recursive: true }).catch(() => {});
      }
      try {
        await options.table().clear();
      } catch {
        // No IndexedDB: nothing kept there.
      }
    },
    backend: async () => ((await folder()) ? "opfs" : "indexeddb"),
  };
}
