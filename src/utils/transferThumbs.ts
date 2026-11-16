/**
 * Small previews for received files: a scaled-down image, or a video's first frame.
 *
 * Made only when asked for (the panel asks for rows on screen), at most a few at a time, and
 * skipped when the row has scrolled away before its turn. Kept in memory for the session and in
 * OPFS (`transfer-received-thumbs`), so reopening the panel does not decode the photos again.
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
// Files deleted from the store take their previews with them.
subscribeReceived(() => {
  const live = new Set(listReceived().map((r) => r.id));
  for (const [id, url] of memory) {
    if (!live.has(id)) {
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
function toJpeg(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  if (!w || !h) return Promise.resolve(null);
  const k = Math.min(1, SIZE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.78));
}

async function imageThumb(file: File): Promise<Blob | null> {
  try {
    // Decoded straight to the small size where the browser can.
    const bmp = await createImageBitmap(file, { resizeWidth: SIZE, resizeQuality: 'medium' } as any);
    const out = await toJpeg(bmp, bmp.width, bmp.height);
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
    return await toJpeg(img, img.naturalWidth || SIZE, img.naturalHeight || SIZE);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function videoThumb(file: File): Promise<Blob | null> {
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
      toJpeg(v, v.videoWidth, v.videoHeight).then(finish, () => finish(null));
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}

const making = new Map<string, Promise<string | null | undefined>>();
/** Everyone waiting for a preview: it is made while any of them still wants it. */
const wanters = new Map<string, Set<() => boolean>>();
const anyoneWants = (id: string) => [...(wanters.get(id) ?? [])].some((f) => f());

/**
 * The preview's URL; null when the file has none (not a picture, or it would not decode);
 * undefined when skipped because `stillWanted` said no before its turn came.
 */
export async function getThumbnail(id: string, stillWanted: () => boolean): Promise<string | null | undefined> {
  let set = wanters.get(id);
  if (!set) wanters.set(id, (set = new Set()));
  set.add(stillWanted);
  try {
    // A job skipped for an earlier asker (a tile that left the screen) is started again.
    for (;;) {
      const r = await shared(id);
      if (r !== undefined || !stillWanted()) return r;
    }
  } finally {
    set.delete(stillWanted);
    if (!set.size && wanters.get(id) === set) wanters.delete(id);
  }
}

function shared(id: string): Promise<string | null | undefined> {
  if (memory.has(id)) return Promise.resolve(memory.get(id));
  const already = making.get(id);
  if (already) return already;

  const job = (async () => {
    const cached = await readCached(id);
    if (cached) {
      const url = URL.createObjectURL(cached);
      remember(id, url);
      return url;
    }
    await takeSlot();
    try {
      if (!anyoneWants(id)) return undefined;
      const rec = getReceivedRecord(id);
      const kind = rec && rec.status === 'complete' ? thumbKind(rec) : null;
      const file = kind ? await getReceivedFile(id) : null;
      const blob = file ? await (kind === 'video' ? videoThumb(file) : imageThumb(file)) : null;
      if (!blob) {
        remember(id, null);
        return null;
      }
      void writeCached(id, blob);
      const url = URL.createObjectURL(blob);
      remember(id, url);
      return url;
    } finally {
      freeSlot();
    }
  })().catch((err) => {
    console.warn('[Received files] preview failed', err);
    return null;
  });
  making.set(id, job);
  void job.then(() => making.delete(id));
  return job;
}
