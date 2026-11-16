/// <reference lib="webworker" />
/**
 * Writes received transfer files into OPFS, off the main thread. A sync access handle writes in
 * place (no swap file, nothing held in memory) and is the one OPFS writer every current browser
 * has, Safari included. Messages are handled strictly in order.
 *
 *   probe                       → { op: 'probe', ok }
 *   open  { id, name, offset }  → { op: 'open', id, ok, error? }   offset > 0 keeps what is there
 *   write { id, buf, off, len } (buf transferred; bytes off..off+len of it are written)
 *   close { id }                → { op: 'close', id, ok, error? }
 *   abort { id, name, keep }    → { op: 'abort', id }               keep = leave the partial file
 *   A failed write answers { op: 'error', id, error } once, and later writes to it are dropped.
 */

const FOLDER = 'transfer-received';
const FLUSH_EVERY = 8 * 1024 * 1024;

interface Open {
  handle: any;
  at: number;
  sinceFlush: number;
  failed: boolean;
}

const open = new Map<string, Open>();
let folder: Promise<FileSystemDirectoryHandle> | null = null;
const dir = () =>
  (folder ??= navigator.storage.getDirectory().then((root) => root.getDirectoryHandle(FOLDER, { create: true })));

const post = (m: any) => (self as unknown as Worker).postMessage(m);

async function handle(m: any) {
  switch (m.op) {
    case 'probe': {
      let ok = false;
      try {
        ok =
          typeof FileSystemFileHandle !== 'undefined' &&
          'createSyncAccessHandle' in FileSystemFileHandle.prototype &&
          !!(await dir());
      } catch {
        ok = false;
      }
      post({ op: 'probe', ok });
      return;
    }
    case 'open': {
      try {
        const fh = await (await dir()).getFileHandle(m.name, { create: true });
        const h = await (fh as any).createSyncAccessHandle();
        // Older Safari and Chrome had promise-returning versions of these: awaiting covers both.
        await h.truncate(m.offset || 0);
        open.set(m.id, { handle: h, at: m.offset || 0, sinceFlush: 0, failed: false });
        post({ op: 'open', id: m.id, ok: true });
      } catch (err: any) {
        post({ op: 'open', id: m.id, ok: false, error: err?.name || String(err) });
      }
      return;
    }
    case 'write': {
      const f = open.get(m.id);
      if (!f || f.failed) return;
      try {
        const data = new Uint8Array(m.buf, m.off || 0, m.len ?? m.buf.byteLength - (m.off || 0));
        const n = await f.handle.write(data, { at: f.at });
        f.at += typeof n === 'number' ? n : data.byteLength;
        f.sinceFlush += data.byteLength;
        if (f.sinceFlush >= FLUSH_EVERY) {
          await f.handle.flush();
          f.sinceFlush = 0;
        }
      } catch (err: any) {
        f.failed = true;
        post({ op: 'error', id: m.id, error: err?.name || String(err) });
      }
      return;
    }
    case 'close': {
      const f = open.get(m.id);
      open.delete(m.id);
      try {
        if (f) {
          await f.handle.flush();
          await f.handle.close();
        }
        post({ op: 'close', id: m.id, ok: !!f && !f.failed, error: f?.failed ? 'WriteFailed' : undefined });
      } catch (err: any) {
        post({ op: 'close', id: m.id, ok: false, error: err?.name || String(err) });
      }
      return;
    }
    case 'abort': {
      const f = open.get(m.id);
      open.delete(m.id);
      try {
        if (f) {
          await f.handle.flush();
          await f.handle.close();
        }
      } catch {
        /* closing a broken handle */
      }
      if (!m.keep) {
        try {
          await (await dir()).removeEntry(m.name);
        } catch {
          /* already gone */
        }
      }
      post({ op: 'abort', id: m.id });
      return;
    }
  }
}

let queue: Promise<void> = Promise.resolve();
self.onmessage = (e: MessageEvent) => {
  queue = queue.then(() => handle(e.data)).catch(() => {});
};
