/**
 * Small previews: a scaled-down image, or a video's first frame.
 *
 * Made only when asked for (by tiles on screen), at most a few at a time, and skipped when the
 * tile has scrolled away before its turn. Kept in memory for the session (a few hundred small
 * JPEGs); previews of stored received files are also kept in OPFS
 * (`transfer-received-thumbs`), so they are not decoded again next time.
 *
 * Two ways in: `getThumbnail(id)` for a file in Received files, and `getThumbFor(key, …)` for
 * anything else - a picked File, or a chat attachment's address.
 */
import { getReceivedFile, getReceivedRecord, listReceived, subscribeReceived, type ReceivedFileRecord } from './transferReceivedStore';

export const THUMBS_FOLDER = 'transfer-received-thumbs';
const SIZE = 256; // longest side, px
const PARALLEL = 3;
const MEMORY_LIMIT = 400;

export type ThumbKind = 'image' | 'video';

export function thumbKind(r: Pick<ReceivedFileRecord, 'name' | 'mime'>): ThumbKind | null {
  const m = r.mime || '';
  const ext = r.name.split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/') || /^(png|jpe?g|gif|webp|avif|bmp|svg|ico|heic)$/.test(ext)) return 'image';
  if (m.startsWith('video/') || /^(mp4|webm|mov|m4v|mkv|ogv)$/.test(ext)) return 'video';
  return null;
}

/* ---- memory cache (insertion order = age) */
const memory = new Map<string, string | null>();
const remember = (id: string, url: string | null) => {
  memory.delete(id);
  memory.set(id, url);
  while (memory.size > MEMORY_LIMIT) {
    const [oldId, oldUrl] = memory.entries().next().value as [string, string | null];
    memory.delete(oldId);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  }
};
// Files deleted from the store take their previews with them (general previews, "g:…", stay).
subscribeReceived(() => {
  const live = new Set(listReceived().map((r) => r.id));
  for (const [id, url] of memory) {
    if (!id.startsWith('g:') && !live.has(id)) {
      memory.delete(id);
      if (url) URL.revokeObjectURL(url);
    }
  }
});

/** A preview already made, without waiting: undefined when there is none yet. */
export const peekThumbnail = (id: string): string | null | undefined => memory.get(id);

/* ---- disk cache */
let dirP: Promise<FileSystemDirectoryHandle | null> | null = null;
const thumbsDir = () =>
  (dirP ??= (async () => {
    try {
      return await (await navigator.storage.getDirectory()).getDirectoryHandle(THUMBS_FOLDER, { create: true });
    } catch {
      return null;
    }
  })());

async function readCached(id: string): Promise<Blob | null> {
  try {
    const f = await (await (await thumbsDir())!.getFileHandle(`${id}.jpg`)).getFile();
    return f.size ? f : null;
  } catch {
    return null;
  }
}
async function writeCached(id: string, blob: Blob) {
  try {
    const h = await (await thumbsDir())!.getFileHandle(`${id}.jpg`, { create: true });
    const w = await (h as any).createWritable();
    await w.write(blob);
    await w.close();
  } catch {
    /* no main-thread OPFS writer (older Safari): memory only */
  }
}

/* ---- a few at a time */
let running = 0;
const waiting: (() => void)[] = [];
const takeSlot = () =>
  new Promise<void>((resolve) => {
    if (running < PARALLEL) {
      running++;
      resolve();
    } else waiting.push(() => {
      running++;
      resolve();
    });
  });
const freeSlot = () => {
  running--;
  waiting.shift()?.();
};

/* ---- making one */
function toJpeg(source: CanvasImageSource, w: number, h: number, size = SIZE): Promise<Blob | null> {
  if (!w || !h) return Promise.resolve(null);
  const k = Math.min(1, size / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.78));
}

async function imageThumb(file: Blob, size = SIZE): Promise<Blob | null> {
  try {
    // Decoded straight to the small size where the browser can.
    const bmp = await createImageBitmap(file, { resizeWidth: size, resizeQuality: 'medium' } as any);
    const out = await toJpeg(bmp, bmp.width, bmp.height, size);
    bmp.close();
    if (out) return out;
  } catch {
    /* SVG, or no resize support: through an <img> */
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return await toJpeg(img, img.naturalWidth || size, img.naturalHeight || size, size);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function videoThumb(file: Blob, size = SIZE): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let done = false;
    const finish = (b: Blob | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      resolve(b);
    };
    const timer = setTimeout(() => finish(null), 8000);
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.onloadeddata = () => {
      // A little in: the very first frame is often black.
      v.currentTime = Math.min(0.5, (v.duration || 1) / 10);
    };
    v.onseeked = () => {
      toJpeg(v, v.videoWidth, v.videoHeight, size).then(finish, () => finish(null));
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}

const making = new Map<string, Promise<string | null | undefined>>();
/** Everyone waiting for a preview: it is made while any of them still wants it. */
const wanters = new Map<string, Set<() => boolean>>();
const anyoneWants = (key: string) => [...(wanters.get(key) ?? [])].some((f) => f());

interface Source {
  key: string;
  size: number;
  /** The kind, or how to work it out when the job's turn comes. */
  kind: () => ThumbKind | null;
  load: () => Promise<Blob | null>;
  /** Also cache the preview in OPFS under this id. */
  disk?: string;
}

async function want(src: Source, stillWanted: () => boolean): Promise<string | null | undefined> {
  let set = wanters.get(src.key);
  if (!set) wanters.set(src.key, (set = new Set()));
  set.add(stillWanted);
  try {
    // A job skipped for an earlier asker (a tile that left the screen) is started again.
    for (;;) {
      const r = await shared(src);
      if (r !== undefined || !stillWanted()) return r;
    }
  } finally {
    set.delete(stillWanted);
    if (!set.size && wanters.get(src.key) === set) wanters.delete(src.key);
  }
}

function shared(src: Source): Promise<string | null | undefined> {
  const { key } = src;
  if (memory.has(key)) return Promise.resolve(memory.get(key));
  const already = making.get(key);
  if (already) return already;

  const job = (async () => {
    if (src.disk) {
      const cached = await readCached(src.disk);
      if (cached) {
        const url = URL.createObjectURL(cached);
        remember(key, url);
        return url;
      }
    }
    await takeSlot();
    try {
      if (!anyoneWants(key)) return undefined;
      const kind = src.kind();
      const file = kind ? await src.load() : null;
      const blob = file ? await (kind === 'video' ? videoThumb(file, src.size) : imageThumb(file, src.size)) : null;
      if (!blob) {
        remember(key, null);
        return null;
      }
      if (src.disk) void writeCached(src.disk, blob);
      const url = URL.createObjectURL(blob);
      remember(key, url);
      return url;
    } finally {
      freeSlot();
    }
  })().catch((err) => {
    console.warn('[Thumbnails] preview failed', err);
    return null;
  });
  making.set(key, job);
  void job.then(() => making.delete(key));
  return job;
}

/**
 * A stored received file's preview URL; null when it has none (not a picture, or it would not
 * decode); undefined when skipped because `stillWanted` said no before its turn came.
 */
export function getThumbnail(id: string, stillWanted: () => boolean): Promise<string | null | undefined> {
  return want(
    {
      key: id,
      size: SIZE,
      disk: id,
      kind: () => {
        const rec = getReceivedRecord(id);
        return rec && rec.status === 'complete' ? thumbKind(rec) : null;
      },
      load: () => getReceivedFile(id),
    },
    stillWanted,
  );
}

const generalKey = (key: string, size: number) => `g:${size}:${key}`;

/** A preview of anything else (a picked File, a chat attachment), made from `load`. */
export function getThumbFor(
  key: string,
  kind: ThumbKind,
  load: () => Promise<Blob | null>,
  stillWanted: () => boolean,
  size = SIZE,
): Promise<string | null | undefined> {
  return want({ key: generalKey(key, size), size, kind: () => kind, load }, stillWanted);
}

/** A general preview already made, without waiting: undefined when there is none yet. */
export const peekThumbFor = (key: string, size = SIZE): string | null | undefined => memory.get(generalKey(key, size));
