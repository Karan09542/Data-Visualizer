/**
 * Keeping installed Python packages on the device, so a refresh - or opening the app offline -
 * does not download them again.
 *
 * Two kinds of thing are kept:
 *
 * - Package files as downloaded (wheels, and the archives Pyodide ships shared libraries and the
 *   standard library in), keyed by URL. Pyodide's loader asks for these on every start; the
 *   workers' fetch is pointed here first. Each is its own file, read only when asked for.
 * - The installed files of packages that came from PyPI, in a folder mounted straight into Python
 *   (`/opt/py_packages`, first on sys.path). Those import after a refresh with no install step at
 *   all - the part that used to fail offline, since micropip has to ask PyPI before installing.
 *
 * Both live in the Origin Private File System where the browser can write it, and in IndexedDB
 * where it cannot. The mounted folder is kept to installed PyPI files on purpose: Pyodide copies a
 * mounted folder into memory whole when it mounts it, so the wheels - hundreds of MB once numpy,
 * pandas and scipy are in - stay outside it and are read one at a time.
 */
import { pyDb, getWheelsCacheSize, clearWheelsCache } from "./pyDb";
import { createDeviceFileStore, opfsDirectory } from "./deviceFileStore";

/** Where the kept PyPI packages appear inside Python. */
export const PERSIST_MOUNT = "/opt/py_packages";

const OPFS_ROOT = "py_packages";
/** Emscripten's IDBFS names its IndexedDB database after the mount point. */
const IDBFS_DATABASE = PERSIST_MOUNT;

export type PackageStorageBackend = "opfs" | "indexeddb";

/** The app's Python package folder in OPFS, or null where OPFS cannot be written. */
const opfsRoot = () => opfsDirectory([OPFS_ROOT]);

/** Downloaded package files: OPFS `py_packages/wheels`, or IndexedDB where OPFS cannot be written. */
const wheelStore = createDeviceFileStore({ opfsPath: [OPFS_ROOT, "wheels"], table: () => pyDb.wheels });

export async function packageStorageBackend(): Promise<PackageStorageBackend> {
  return (await opfsRoot()) ? "opfs" : "indexeddb";
}

// ------------------------------------------------------------------ package files, by URL

/** Files worth keeping: wheels, and the zip archives Pyodide ships shared libraries and the stdlib in. */
export const isCacheablePackageUrl = (url: string): boolean => {
  const path = url.split(/[?#]/)[0];
  return path.endsWith(".whl") || (path.includes("/pyodide/") && path.endsWith(".zip"));
};

const contentTypeFor = (url: string) => (url.split(/[?#]/)[0].endsWith(".zip") ? "application/zip" : "application/octet-stream");

/** Writes a downloaded package file to device storage. Returns where it went. */
export const storePackageFile = (url: string, data: ArrayBuffer) => wheelStore.write(url, data);

/** A kept package file, or null when it has never been downloaded on this device. */
export const readStoredPackageFile = (url: string) => wheelStore.read(url);

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Wraps fetch so package files come from device storage when kept, and are kept as they
 * download. Every other request goes straight to `network`.
 */
export function keptPackageFetch(
  network: FetchLike,
  options: {
    /** Whether to use and fill device storage (the "keep packages" setting). */
    shouldKeep: () => boolean;
    /** Told about every package URL requested - lets an install learn which wheels it pulled. */
    onPackageUrl?: (url: string) => void;
    /** Filled with pending writes, so an install can wait until everything is really saved. */
    pending?: Set<Promise<unknown>>;
  }
): FetchLike {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isCacheablePackageUrl(url)) return network(input, init);

    options.onPackageUrl?.(url);

    if (options.shouldKeep()) {
      const stored = await readStoredPackageFile(url).catch(() => null);
      if (stored) {
        return new Response(stored, {
          status: 200,
          headers: {
            "Content-Type": contentTypeFor(url),
            "Content-Length": String(stored.byteLength),
            "X-Cache": "device",
          },
        });
      }
    }

    const response = await network(input, init);
    if (response.ok && options.shouldKeep()) {
      const write = response
        .clone()
        .arrayBuffer()
        .then((buffer) => storePackageFile(url, buffer))
        .catch((err) => console.warn("[Py packages] Could not keep", url, err));
      options.pending?.add(write);
      void write.finally(() => options.pending?.delete(write));
    }
    return response;
  };
}

// ------------------------------------------------------------------ the folder mounted into Python

export interface MountedPackages {
  /** "memory" when neither OPFS nor IndexedDB could be used: packages then last until a refresh. */
  backend: PackageStorageBackend | "memory";
  /** Writes what changed in the folder back to device storage. */
  persist: () => Promise<void>;
}

const syncfs = (FS: any, populate: boolean) =>
  new Promise<void>((resolve, reject) => FS.syncfs(populate, (err: unknown) => (err ? reject(err) : resolve())));

/** Runs one at a time: Emscripten does not allow two syncs of a file system to overlap. */
const oneAtATime = (task: () => Promise<void>) => {
  let chain: Promise<void> = Promise.resolve();
  return () => (chain = chain.then(task, task));
};

/**
 * Mounts the kept-packages folder at PERSIST_MOUNT: OPFS through `mountNativeFS` where it can be
 * written, IndexedDB through IDBFS otherwise. Its contents are loaded as it mounts.
 */
export async function mountPersistentPackages(pyodide: any): Promise<MountedPackages> {
  const FS = pyodide.FS;
  try {
    FS.mkdirTree("/opt");
  } catch {
    // Already there.
  }

  const root = await opfsRoot();
  if (root) {
    try {
      const site = await root.getDirectoryHandle("site", { create: true });
      const nativefs = await pyodide.mountNativeFS(PERSIST_MOUNT, site);
      return { backend: "opfs", persist: oneAtATime(() => nativefs.syncfs()) };
    } catch (err) {
      console.warn("[Py packages] Could not mount OPFS, using IndexedDB:", err);
      try {
        FS.unmount(PERSIST_MOUNT);
      } catch {
        // Never got mounted.
      }
    }
  }

  try {
    try {
      FS.mkdirTree(PERSIST_MOUNT);
    } catch {
      // Already there.
    }
    FS.mount(FS.filesystems.IDBFS, {}, PERSIST_MOUNT);
    await syncfs(FS, true);
    return { backend: "indexeddb", persist: oneAtATime(() => syncfs(FS, false)) };
  } catch (err) {
    console.warn("[Py packages] No device storage for packages; they will not survive a refresh:", err);
    try {
      FS.mkdirTree(PERSIST_MOUNT);
    } catch {
      // Already there.
    }
    return { backend: "memory", persist: async () => {} };
  }
}

/**
 * Python side of the kept folder. Run once after mounting; defines `_dv_*` helpers in __main__.
 *
 * Distribution names are compared in normalised form (PEP 503), since what the user typed,
 * the wheel file name and the dist-info folder may each spell a name differently.
 */
export const PERSIST_HELPERS_PY = `
import sys, os, json, re, shutil, importlib
import importlib.metadata as _dv_md

_DV_DIR = '${PERSIST_MOUNT}'
if _DV_DIR not in sys.path:
    sys.path.insert(0, _DV_DIR)
# Importing from the kept folder would otherwise leave __pycache__ files in it that no package owns.
sys.dont_write_bytecode = True
importlib.invalidate_caches()

def _dv_norm(name):
    return re.sub(r'[-_.]+', '-', name or '').lower()

def _dv_dists(paths):
    out = {}
    for d in _dv_md.distributions(path=paths):
        try:
            name = _dv_norm(d.metadata['Name'])
        except Exception:
            continue
        if name and name not in out:
            out[name] = d
    return out

def _dv_elsewhere():
    return [p for p in sys.path if p and not p.startswith(_DV_DIR)]

def _dv_snapshot():
    """Installed distributions outside the kept folder, name -> version."""
    return json.dumps({n: d.version for n, d in _dv_dists(_dv_elsewhere()).items()})

def _dv_kept():
    """Distributions in the kept folder, name -> version."""
    return json.dumps({n: d.version for n, d in _dv_dists([_DV_DIR]).items()})

def _dv_remove(dist):
    root = str(dist.locate_file(''))
    for f in list(dist.files or []):
        p = os.path.normpath(os.path.join(root, str(f)))
        if p.startswith(_DV_DIR + '/') and os.path.isfile(p):
            os.remove(p)
    for dirpath, _dirs, _files in os.walk(_DV_DIR, topdown=False):
        if dirpath != _DV_DIR and not os.listdir(dirpath):
            os.rmdir(dirpath)

def _dv_requirements(dist):
    out = []
    for req in dist.requires or []:
        # Optional extras are not part of what the package needs to import.
        if re.search(r'extra\\s*==', req):
            continue
        m = re.match(r'\\s*([A-Za-z0-9][A-Za-z0-9._-]*)', req)
        if m:
            out.append(_dv_norm(m.group(1)))
    return out

def _dv_keep_new(before_json):
    """Copies distributions installed since the snapshot into the kept folder.

    Pure-Python ones are copied file by file. Ones with compiled code are only reported: they
    are loaded through Pyodide's loader on start-up instead, which also brings in the shared
    libraries they link against.
    """
    before = json.loads(before_json)
    kept, native = [], []
    for name, d in _dv_dists(_dv_elsewhere()).items():
        if before.get(name) == d.version:
            continue
        files = list(d.files or [])
        if not files:
            continue
        if any(str(f).endswith('.so') for f in files):
            native.append({'name': name, 'version': d.version})
            continue
        # A new version replaces the kept one outright, so no stale module survives an upgrade.
        old = _dv_dists([_DV_DIR]).get(name)
        if old is not None:
            _dv_remove(old)
        root = str(d.locate_file(''))
        for f in files:
            rel = str(f)
            if rel.startswith('..') or os.path.isabs(rel):
                continue  # console scripts and the like live outside site-packages
            src = os.path.join(root, rel)
            if not os.path.isfile(src):
                continue
            dst = os.path.join(_DV_DIR, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copyfile(src, dst)
        kept.append({'name': name, 'version': d.version})
    importlib.invalidate_caches()
    return json.dumps({'kept': kept, 'native': native})

def _dv_gc(roots_json):
    """Removes kept distributions that no installed package needs any more.

    Starts from the installed packages and follows their requirements through the kept folder,
    so a dependency two packages share stays while either of them is installed.
    """
    kept = _dv_dists([_DV_DIR])
    needed, queue = set(), [_dv_norm(n) for n in json.loads(roots_json)]
    while queue:
        name = queue.pop()
        if name in needed or name not in kept:
            continue
        needed.add(name)
        queue.extend(_dv_requirements(kept[name]))
    removed = []
    for name, d in kept.items():
        if name not in needed:
            _dv_remove(d)
            removed.append(name)
    if removed:
        importlib.invalidate_caches()
    return json.dumps(removed)
`;

// ------------------------------------------------------------------ size and clearing (main thread)

async function dirSize(dir: FileSystemDirectoryHandle): Promise<number> {
  let total = 0;
  for await (const handle of (dir as any).values()) {
    if (handle.kind === "file") total += (await handle.getFile()).size;
    else total += await dirSize(handle);
  }
  return total;
}

/** What kept packages take up on this device. IDBFS contents are not counted; they are small. */
export async function packageStorageInfo(): Promise<{ backend: PackageStorageBackend; bytes: number }> {
  const root = await opfsRoot();
  let bytes = 0;
  if (root) bytes += await dirSize(root).catch(() => 0);
  bytes += await getWheelsCacheSize();
  return { backend: root ? "opfs" : "indexeddb", bytes };
}

/** Deletes every kept package file and folder. Stop the Python worker first. */
export async function clearPackageStorage(): Promise<void> {
  const root = await opfsRoot();
  if (root) {
    const names: string[] = [];
    for await (const [name] of (root as any).entries()) names.push(name);
    for (const name of names) await root.removeEntry(name, { recursive: true }).catch(() => {});
  }
  await clearWheelsCache();
  await new Promise<void>((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(IDBFS_DATABASE);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
