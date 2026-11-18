/**
 * The Library: every file the audio tools make is kept on the device (OPFS), to play,
 * download, or carry on editing later. Without OPFS it's kept in memory for this visit.
 *
 * Layout: audio-library/<id>.<ext> plus index.json (newest first).
 */

export interface LibraryItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  /** The tool that made it */
  tool: string;
  createdAt: number;
}

const DIR = "audio-library";
const INDEX = "index.json";
const memory = new Map<string, { item: LibraryItem; blob: Blob }>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function onLibraryChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export const libraryOnDevice = () => typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";

async function dir(): Promise<FileSystemDirectoryHandle | null> {
  if (!libraryOnDevice()) return null;
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true }).catch(() => null);
}

async function write(d: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const w = await ((await d.getFileHandle(name, { create: true })) as any).createWritable();
  await w.write(data);
  await w.close();
}

async function readIndex(d: FileSystemDirectoryHandle): Promise<LibraryItem[]> {
  try {
    return JSON.parse(await (await (await d.getFileHandle(INDEX)).getFile()).text());
  } catch {
    return [];
  }
}

const fileName = (i: LibraryItem) => `${i.id}.${/\.([a-z0-9]{1,5})$/i.exec(i.name)?.[1]?.toLowerCase() ?? "bin"}`;

// one write at a time, so two saves never write the index together
let chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>) => {
  const p = chain.then(fn);
  chain = p.catch(() => {});
  return p;
};

export async function listLibrary(): Promise<LibraryItem[]> {
  const d = await dir();
  return [...[...memory.values()].map((m) => m.item), ...(d ? await readIndex(d) : [])].sort((a, b) => b.createdAt - a.createdAt);
}

export const saveToLibrary = (blob: Blob, name: string, tool: string) =>
  serial(async () => {
    const item: LibraryItem = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, size: blob.size, mime: blob.type || "application/octet-stream", tool, createdAt: Date.now() };
    try {
      const d = await dir();
      if (!d) throw new Error("no OPFS");
      await write(d, fileName(item), blob);
      await write(d, INDEX, JSON.stringify([item, ...(await readIndex(d))]));
    } catch {
      memory.set(item.id, { item, blob });
    }
    changed();
    return item;
  });

export async function readLibraryFile(item: LibraryItem): Promise<File> {
  const m = memory.get(item.id);
  if (m) return new File([m.blob], item.name, { type: item.mime });
  const d = await dir();
  if (!d) throw new Error("This file is no longer available.");
  return new File([await (await d.getFileHandle(fileName(item))).getFile()], item.name, { type: item.mime });
}

export const removeFromLibrary = (id: string) =>
  serial(async () => {
    if (!memory.delete(id)) {
      const d = await dir();
      if (d) {
        const index = await readIndex(d);
        const item = index.find((i) => i.id === id);
        if (item) await d.removeEntry(fileName(item)).catch(() => {});
        await write(d, INDEX, JSON.stringify(index.filter((i) => i.id !== id)));
      }
    }
    changed();
  });

export const clearLibrary = () =>
  serial(async () => {
    memory.clear();
    if (libraryOnDevice()) await (await navigator.storage.getDirectory()).removeEntry(DIR, { recursive: true }).catch(() => {});
    changed();
  });
