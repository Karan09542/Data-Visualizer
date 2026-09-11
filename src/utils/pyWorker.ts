import { loadPyodide } from "pyodide";
import { getInstalledPackages, saveInstalledPackage, PyPackageMetadata } from "./pyDb";
import { keptPackageFetch, mountPersistentPackages, MountedPackages, PERSIST_HELPERS_PY, PERSIST_MOUNT } from "./pyPackageStorage";
import { __dvPostCloneable } from "./cloneSafe.js";

let activeEnabledProxies: string[] = [];

/** Every message out of this worker: a value the browser cannot copy is described, not dropped. */
const post = (message: any) => __dvPostCloneable(self as any, message);
void PERSIST_MOUNT;

// Set up shims for window and document so python scripts can import them and perform actions like downloads
(self as any).window = self;

const mockDocument = {
  body: {
    appendChild: (element: any) => {
      return element;
    },
    removeChild: (element: any) => {
      return element;
    },
  },
  createElement: (tagName: string) => {
    if (typeof tagName === "string" && tagName.toLowerCase() === "a") {
      return {
        tagName: "A",
        href: "",
        download: "",
        click: function (this: any) {
          post({
            type: "trigger_download",
            url: this.href,
            filename: this.download,
          });
        },
      };
    }
    return {};
  },
};

(self as any).document = mockDocument;

let cacheEnabled = true;

const originalFetch = self.fetch;

const requestUrl = (input: RequestInfo | URL) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** The network, with the configured CORS proxies as a fallback for cross-origin failures. */
const networkFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const urlStr = requestUrl(input);
  try {
    return await originalFetch(input, init);
  } catch (err: any) {
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      if (
        typeof urlStr === "string" &&
        (urlStr.startsWith("http://") || urlStr.startsWith("https://"))
      ) {
        let isCrossOrigin = false;
        try {
          const parsed = new URL(urlStr);
          isCrossOrigin = parsed.origin !== self.location.origin;
        } catch (e) {}

        if (isCrossOrigin) {
          for (const proxyBaseUrl of activeEnabledProxies) {
            if (urlStr.includes(proxyBaseUrl)) continue;
            try {
              console.warn(
                `[Pyodide Fetch]: CORS or network error for ${urlStr}. Retrying via proxy: ${proxyBaseUrl}`,
              );
              const proxyUrl = proxyBaseUrl + urlStr;
              return await originalFetch(proxyUrl, init);
            } catch (proxyErr) {
              console.warn(`[Pyodide Fetch]: Proxy fallback failed for ${proxyBaseUrl}`, proxyErr);
            }
          }
        }
      }
    }
    throw err;
  }
};

/** Package URLs requested during the install in progress, so compiled parts can be traced to their wheel. */
let installRecording: string[] | null = null;
/** Package files still being written to device storage. */
const pendingPackageWrites = new Set<Promise<unknown>>();

// Package files (wheels, Pyodide's shared-library archives) come from device storage when kept,
// and are kept as they download - see pyPackageStorage.
self.fetch = keptPackageFetch(networkFetch, {
  shouldKeep: () => cacheEnabled,
  onPackageUrl: (url) => installRecording?.push(url),
  pending: pendingPackageWrites,
});

let pyodide: any = null;
let currentFlushInterval: any = null;
let activeAddLog: ((logType: string, args: any[]) => void) | null = null;
let currentSessionId: string = "";

self.addEventListener("error", (e) => {
  e.preventDefault();
  post({
    type: "finish",
    success: false,
    error: e.message || "Worker global error",
  });
});

self.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  let msg = "Worker unhandled rejection";
  try {
    msg = e.reason ? String(e.reason.message || e.reason) : msg;
  } catch (err) { }
  post({ type: "finish", success: false, error: msg });
});

/** The kept-packages folder, once mounted on cold boot. */
let kept: MountedPackages | null = null;

const normalizeName = (name: string) => name.toLowerCase().replace(/[-_.]+/g, "-");

/** Whether Pyodide's loader has this package in. An unknown name is reported, not thrown, so this is what counts. */
const isLoaded = (name: string) =>
  Object.keys(pyodide?.loadedPackages || {}).some((k) => normalizeName(k) === normalizeName(name));

/** Whether the name is one of Pyodide's prebuilt packages, when the lock file is at hand. */
const isPrebuiltName = (name: string) => {
  const lock = pyodide?._api?.lockfile_packages;
  return !lock || normalizeName(name) in lock;
};

const useAggBackend = (name: string) => {
  if (name !== "matplotlib") return;
  try {
    pyodide.runPython("import matplotlib; matplotlib.use('Agg')");
  } catch { }
};

function detectVersion(name: string): string {
  useAggBackend(name);
  pyodide.globals.set("_dv_pkg", name);
  try {
    return pyodide.runPython("import importlib.metadata as meta; meta.version(_dv_pkg)") || "latest";
  } catch {
    try {
      return pyodide.runPython(`import ${name}; ${name}.__version__`) || "latest";
    } catch {
      return "latest";
    }
  }
}

/** The wheel a distribution came from, among the URLs the install requested. */
function wheelUrlFor(name: string, version: string): string | undefined {
  const prefix = `${name.replace(/-/g, "_")}-${version}-`.toLowerCase();
  return (installRecording || []).find((url) => {
    const file = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "").toLowerCase();
    return file.endsWith(".whl") && file.startsWith(prefix);
  });
}

const flushPackageWrites = () => Promise.allSettled(Array.from(pendingPackageWrites));

interface InstallResult {
  success: boolean;
  version?: string;
  error?: string;
  method?: "pyodide" | "pypi";
  persisted?: { name: string; version: string }[];
  native?: { name: string; version: string; url?: string }[];
}

async function installPackageInWorker(
  name: string,
  addLog: (type: string, args: any[]) => void,
): Promise<InstallResult> {
  installRecording = [];
  try {
    addLog("log", [
      `[Pyodide Pip]: Checking prebuilt bundle or PyPI for "${name}"...`,
    ]);

    // 1. Pyodide's prebuilt set. Its wheels are kept as they download, so the next start
    //    loads them from the device.
    if (isPrebuiltName(name)) {
      try {
        await pyodide.loadPackage(name);
      } catch { }
      if (isLoaded(name)) {
        const version = detectVersion(name);
        await flushPackageWrites();
        addLog("log", [
          `[Pyodide Pip]: Successfully loaded prebuilt library "${name}" (v${version})`,
        ]);
        return { success: true, version, method: "pyodide" };
      }
    }

    // 2. PyPI through micropip. What it installs is copied into the kept folder, since micropip
    //    cannot run offline - it asks PyPI before it installs anything.
    addLog("log", [
      `[Pyodide Pip]: "${name}" is not prebuilt or failed to load directly. Installing from PyPI via micropip...`,
    ]);
    try {
      await pyodide.loadPackage("micropip");
      // Taken after micropip itself is in, so it is not mistaken for part of this package.
      const before = kept ? pyodide.runPython("_dv_snapshot()") : "{}";
      pyodide.globals.set("_dv_pkg", name);
      await pyodide.runPythonAsync("import micropip\nawait micropip.install(_dv_pkg)");
      const version = detectVersion(name);
      addLog("log", [
        `[Pyodide Pip]: Successfully installed "${name}" (v${version}) from PyPI!`,
      ]);

      const result: InstallResult = { success: true, version, method: "pypi", persisted: [], native: [] };
      if (cacheEnabled && kept && kept.backend !== "memory") {
        try {
          pyodide.globals.set("_dv_before", before);
          const saved = JSON.parse(pyodide.runPython("_dv_keep_new(_dv_before)"));
          result.persisted = saved.kept;
          result.native = saved.native.map((d: { name: string; version: string }) => ({ ...d, url: wheelUrlFor(d.name, d.version) }));
          await kept.persist();
          await flushPackageWrites();
          addLog("log", [
            `[Pyodide Pip]: Saved "${name}" on this device (${kept.backend === "opfs" ? "OPFS" : "IndexedDB"}). It loads after a refresh without downloading, even offline.`,
          ]);
        } catch (saveErr: any) {
          addLog("warn", [
            `[Pyodide Pip]: "${name}" is installed, but could not be saved on this device: ${saveErr?.message || saveErr}`,
          ]);
        }
      }
      return result;
    } catch (micropipErr: any) {
      const msg = micropipErr.message || String(micropipErr);
      addLog("error", [
        `[Pyodide Pip]: Installation error for "${name}": ${msg}`,
      ]);
      return { success: false, error: msg };
    }
  } finally {
    installRecording = null;
  }
}

/** Loads a compiled distribution by name through Pyodide's loader, or from the wheel it came in. */
async function loadCompiledPart(dep: { name: string; url?: string }) {
  try {
    await pyodide.loadPackage(dep.name);
  } catch { }
  if (isLoaded(dep.name)) return;
  if (dep.url) {
    await pyodide.loadPackage(dep.url);
    return;
  }
  throw new Error(`its compiled part "${dep.name}" is not available`);
}

/**
 * Brings back every installed package on cold boot. PyPI packages whose files are kept are
 * importable already; prebuilt ones go through Pyodide's loader, fed from device storage.
 * Only what is missing from the device is downloaded.
 */
async function restorePackages(addLog: (type: string, args: any[]) => void) {
  let installed: PyPackageMetadata[] = [];
  try {
    addLog("log", [
      "[Pyodide Backend]: Scanning workspace registry for installed packages...",
    ]);
    installed = (await getInstalledPackages()).filter((p) => p.status === "installed");
  } catch (dbErr: any) {
    console.warn("Could not scan IndexedDB in worker coldboot", dbErr);
    return;
  }

  // Files of packages uninstalled since last time go now; whatever the others still need stays.
  if (kept && kept.backend !== "memory") {
    try {
      const roots = installed
        .filter((p) => p.method === "pypi")
        .flatMap((p) => [p.name, ...(p.persisted || []).map((d) => d.name)]);
      pyodide.globals.set("_dv_roots", JSON.stringify(roots));
      const removed: string[] = JSON.parse(pyodide.runPython("_dv_gc(_dv_roots)"));
      if (removed.length) {
        await kept.persist();
        addLog("log", [`[Pyodide Backend]: Removed files of uninstalled packages: ${removed.join(", ")}`]);
      }
    } catch (gcErr) {
      console.warn("[Pyodide Backend]: Could not tidy kept packages", gcErr);
    }
  }

  if (!installed.length) {
    addLog("log", [
      "[Pyodide Backend]: No previously installed packages found. Clean environment.",
    ]);
    return;
  }

  addLog("log", [
    `[Pyodide Backend]: Restoring ${installed.length} installed package environments...`,
  ]);

  let onDevice: Record<string, string> = {};
  try {
    onDevice = kept ? JSON.parse(pyodide.runPython("_dv_kept()")) : {};
  } catch { }

  const ready: string[] = [];
  for (const pkg of installed) {
    try {
      const keptFiles =
        pkg.method === "pypi" &&
        (pkg.persisted?.length ?? 0) > 0 &&
        pkg.persisted!.every((d) => d.name in onDevice);

      if (keptFiles) {
        for (const dep of pkg.native || []) await loadCompiledPart(dep);
        addLog("log", [`[Pyodide Backend]: "${pkg.name}" loaded from this device (no download).`]);
        ready.push(pkg.name);
        continue;
      }

      if (pkg.method !== "pypi" && isPrebuiltName(pkg.name)) {
        addLog("log", [`[Pyodide Backend]: Restoring package "${pkg.name}"...`]);
        try {
          await pyodide.loadPackage(pkg.name);
        } catch { }
        if (isLoaded(pkg.name)) {
          useAggBackend(pkg.name);
          ready.push(pkg.name);
          continue;
        }
      }

      // Installed before packages were kept, or the device copy was cleared: install it again,
      // which also keeps it from now on.
      if (!self.navigator.onLine) {
        throw new Error("offline, and it has not been saved on this device yet");
      }
      const res = await installPackageInWorker(pkg.name, addLog);
      if (!res.success) throw new Error(res.error || "installation failed");
      await saveInstalledPackage({
        ...pkg,
        version: res.version || pkg.version,
        method: res.method,
        persisted: res.persisted,
        native: res.native,
      });
      ready.push(pkg.name);
    } catch (loadErr: any) {
      addLog("error", [
        `[Pyodide Backend]: Failed to load and restore "${pkg.name}": ${loadErr?.message || loadErr}`,
      ]);
    }
  }

  addLog("log", [
    `[Pyodide Backend]: Environment restored. Ready packages: ${ready.join(", ") || "none"}`,
  ]);
}

/**
 * Empty `__init__.py` files this worker puts in folders so Python can import from them. They are
 * the worker's doing, not the script's, so they stay out of the workspace - unless a script
 * writes something into one.
 */
let scaffoldedFiles: Record<string, string> = {};

/**
 * Folders that belong to the runtime rather than the workspace. Installing a package drops files
 * in several of these - "share/man/man1/ttx.1" comes with fonttools - and none of them are the
 * reader's files.
 */
const SYSTEM_DIRS = new Set([
  "lib", "lib64", "proc", "dev", "tmp", "home", "opt", "usr", "etc", "bin", "sbin", "boot",
  "share", "include", "var", "run", "srv", "mnt", "media", "root", "local", "__pycache__",
]);
/**
 * When this run began, rounded down to the second so a file system that keeps timestamps only to
 * the second still counts as having been written during it. A file the run did not touch cannot be
 * something the run wrote, and outside the workspace's own folders that is what decides.
 */
let runStartedAt = 0;

const markRunStart = () => {
  runStartedAt = Math.floor(Date.now() / 1000) * 1000;
};

const touchedThisRun = (stat: any) => {
  const at = stat && stat.mtime ? new Date(stat.mtime).getTime() : 0;
  return !runStartedAt || (at > 0 && at >= runStartedAt);
};

/** Files larger than this are left where they are; the workspace holds text, not archives. */
const MAX_SYNC_BYTES = 1024 * 1024;
const MAX_SYNC_FILES = 2000;

/**
 * What the workspace's files look like now, next to what they were when the run began: the
 * script's writes, the files it made, the ones it removed. Binary files and very large ones are
 * left alone, as are the runtime's own folders.
 */
function collectWorkspaceFileChanges(
  sent: Record<string, string>,
  entryPath: string,
): { path: string; content: string | null }[] {
  const changes: { path: string; content: string | null }[] = [];
  const seen = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  // Only where the workspace itself lives: the folders its files came from, and the script's own.
  const roots = new Set<string>(["/"]);
  const workspaceDirs = new Set<string>(["/"]);
  const noteDir = (path: string) => {
    const dir = path.slice(0, path.lastIndexOf("/")) || "/";
    roots.add(dir);
    let walk = dir;
    while (walk && walk !== "/") {
      workspaceDirs.add(walk);
      walk = walk.slice(0, walk.lastIndexOf("/")) || "/";
    }
  };
  Object.keys(sent).forEach(noteDir);
  if (entryPath) noteDir(entryPath);

  const walk = (dir: string, depth: number) => {
    if (depth > 6 || seen.size > MAX_SYNC_FILES) return;
    let entries: string[] = [];
    try {
      entries = pyodide.FS.readdir(dir);
    } catch (err) {
      return;
    }
    for (const entry of entries) {
      if (entry === "." || entry === "..") continue;
      const full = dir === "/" ? `/${entry}` : `${dir}/${entry}`;
      // A workspace folder may share a name with a system one; only the runtime's are skipped.
      if (SYSTEM_DIRS.has(entry) && !workspaceDirs.has(full)) continue;
      let stat: any;
      try {
        stat = pyodide.FS.stat(full);
      } catch (err) {
        continue;
      }
      const ours = workspaceDirs.has(full) || sent[full] !== undefined;
      if (pyodide.FS.isDir(stat.mode)) {
        // Somewhere else entirely - a package's install directory - unless this run made it.
        if (ours || touchedThisRun(stat)) walk(full, depth + 1);
        continue;
      }
      if (!pyodide.FS.isFile(stat.mode) || seen.has(full)) continue;
      // A file the run never wrote is not a change, whoever put it there.
      if (!ours && !touchedThisRun(stat)) continue;
      seen.add(full);
      if (stat.size > MAX_SYNC_BYTES) continue;
      let text: string;
      try {
        text = decoder.decode(pyodide.FS.readFile(full));
      } catch (err) {
        continue; // not text: left where it is
      }
      if (sent[full] === text) continue;
      if (scaffoldedFiles[full] === text) continue; // this worker put it there
      changes.push({ path: full, content: text });
    }
  };

  roots.forEach((root) => walk(root, 0));

  for (const path of Object.keys(sent)) {
    if (seen.has(path)) continue;
    try {
      pyodide.FS.stat(path);
    } catch (err) {
      changes.push({ path, content: null }); // the script removed it
    }
  }

  return changes;
}

/** Tells the page what the run left behind, so the workspace can catch up. */
function reportWorkspaceFileChanges(data: any) {
  if (!data?.vfs || !pyodide) return;
  try {
    const changes = collectWorkspaceFileChanges(data.vfs, data.entryPath || "");
    if (changes.length) post({ type: "fs_changes", id: data.id, changes });
  } catch (err) {
    console.warn("[Pyodide]: Could not read back the workspace files", err);
  }
}

self.onmessage = async (e) => {
  const { code, input, id, type, cacheEnabled: msgCacheEnabled, enabledProxies } = e.data;
  if (msgCacheEnabled !== undefined) {
    cacheEnabled = msgCacheEnabled;
  }
  if (enabledProxies !== undefined) {
    activeEnabledProxies = enabledProxies;
  }
  currentSessionId = id || "";

  // Support clear logs if a command requests it
  if (type === "clear") {
    return;
  }

  let flushLogs = () => { };

  try {
    const getTime = () => {
      const d = new Date();
      return (
        d.getUTCHours().toString().padStart(2, "0") +
        ":" +
        d.getUTCMinutes().toString().padStart(2, "0") +
        ":" +
        d.getUTCSeconds().toString().padStart(2, "0") +
        "." +
        d.getUTCMilliseconds().toString().padStart(3, "0")
      );
    };

    let logBatch: any[] = [];
    flushLogs = () => {
      if (logBatch.length > 0) {
        post({ type: "logs", logs: logBatch });
        logBatch = [];
      }
    };

    if (currentFlushInterval) clearInterval(currentFlushInterval);
    currentFlushInterval = setInterval(flushLogs, 50);

    const addLog = (logType: string, args: any[]) => {
      const safeArgs = args.map((a) => {
        if (typeof a === "function") return "[Function]";
        if (a instanceof Error) return a.toString();
        return a;
      });
      logBatch.push({ type: logType, args: safeArgs, time: getTime() });
      if (logBatch.length >= 5000) flushLogs();
    };

    activeAddLog = addLog;

    // Cold boot initialization of Pyodide
    const coldBoot = !pyodide;
    if (coldBoot) {
      addLog("log", ["[Pyodide]: Starting Python runtime environment..."]);
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/",
      });
      pyodide.setStdout({
        batched: (msg: any) => {
          if (activeAddLog) {
            activeAddLog("log", [msg]);
          }
        },
      });
      pyodide.setStderr({
        batched: (msg: any) => {
          if (activeAddLog) {
            activeAddLog("error", [msg]);
          }
        },
      });
      pyodide.setStdin({
        stdin: () => {
          post({
            type: "need_prompt",
            sessionId: currentSessionId,
            promptText: "Python input requested",
            promptType: "input",
          });

          const xhr = new XMLHttpRequest();
          xhr.open(
            "GET",
            `${self.location.origin}/api/stdin-get?sessionId=${currentSessionId}`,
            false,
          );
          xhr.send();

          if (xhr.status === 200) {
            try {
              const res = JSON.parse(xhr.responseText);
              const val =
                res.value !== null && res.value !== undefined
                  ? String(res.value)
                  : "";
              if (activeAddLog) {
                activeAddLog("log", [val]);
              }
              return val + "\n";
            } catch (err) {
              console.error("Error parsing stdin result", err);
            }
          }
          return "\n";
        },
      });
      addLog("log", ["[Pyodide]: Runtime initialized successfully!"]);

      // The folder kept on this device, then everything that was installed.
      try {
        kept = await mountPersistentPackages(pyodide);
        pyodide.runPython(PERSIST_HELPERS_PY);
        if (kept.backend !== "memory") {
          addLog("log", [
            `[Pyodide Backend]: Packages are kept on this device (${kept.backend === "opfs" ? "OPFS" : "IndexedDB"}).`,
          ]);
        }
      } catch (mountErr: any) {
        kept = null;
        console.warn("[Pyodide]: Could not set up package storage", mountErr);
      }
      await restorePackages(addLog);
    }

    // Check if the current message is a dedicated installation request
    if (type === "install_package") {
      const { packageName, installId, cacheEnabled: msgCacheEnabled } = e.data;
      if (msgCacheEnabled !== undefined) {
        cacheEnabled = msgCacheEnabled;
      }
      const res = await installPackageInWorker(packageName, addLog);

      // Recorded here as well as by the page. Start-up tidies away kept files that no registered
      // package claims, so the entry has to exist before anything can start another worker - a
      // refresh straight after installing included.
      if (res.success) {
        try {
          await saveInstalledPackage({
            name: packageName,
            version: res.version || "latest",
            installedAt: new Date().toLocaleDateString(),
            status: "installed",
            method: res.method,
            persisted: res.persisted,
            native: res.native,
          });
        } catch (dbErr) {
          console.warn("[Pyodide]: Could not record the install", dbErr);
        }
      }

      if (currentFlushInterval) clearInterval(currentFlushInterval);
      flushLogs();

      post({
        type: "package_installed",
        packageName,
        installId,
        success: res.success,
        version: res.version,
        error: res.error,
        method: res.method,
        persisted: res.persisted,
        native: res.native,
      });
      return;
    }

    // Otherwise, execute standard user python script
    if (e.data.vfs) {
      scaffoldedFiles = {};
      markRunStart();
      try {
        let pySysCode = `
import sys
import importlib
import builtins
import types

if '__main__' not in sys.modules:
    sys.modules['__main__'] = types.ModuleType('__main__')

if not hasattr(builtins, '_custom_import_installed'):
    builtins._custom_import_installed = True
    _orig_import = builtins.__import__
    def _custom_import(name, globals=None, locals=None, fromlist=(), level=0):
        if level > 0 and globals and '__package__' in globals:
            pkg = globals['__package__']
            if pkg is None: pkg = ''
            parts = pkg.split('.') if pkg else []
            drop = level - 1
            if drop >= len(parts):
                absolute_name = name
                return _orig_import(absolute_name, globals, locals, fromlist, 0)
            else:
                base = ".".join(parts[:len(parts)-drop])
                absolute_name = base + "." + name if name else base
                if absolute_name.startswith('.'): absolute_name = absolute_name[1:]
                return _orig_import(absolute_name, globals, locals, fromlist, 0)
        return _orig_import(name, globals, locals, fromlist, level)
    builtins.__import__ = _custom_import

if '/' not in sys.path:
    sys.path.append('/')
for k, m in list(sys.modules.items()):
    if k == '__main__':
        continue
    f = getattr(m, '__file__', None)
    if f and type(f) is str and f.startswith('/') and not f.startswith('/lib/') and not f.startswith('/opt/py_packages/'):
        del sys.modules[k]
importlib.invalidate_caches()
`;
        if (e.data.entryPath) {
          const scriptDir =
            e.data.entryPath.substring(0, e.data.entryPath.lastIndexOf("/")) ||
            "/";
          pySysCode += `\nimport os\nos.makedirs('${scriptDir}', exist_ok=True)\nif '${scriptDir}' not in sys.path:\n    sys.path.append('${scriptDir}')\nos.chdir('${scriptDir}')`;
        }
        pyodide.runPython(pySysCode);
        for (const [vPath, vCode] of Object.entries(e.data.vfs)) {
          const parts = vPath.split("/").filter(Boolean);
          let dir = "";
          for (let i = 0; i < parts.length - 1; i++) {
            dir += "/" + parts[i];
            try {
              pyodide.FS.mkdir(dir);
            } catch { }
            try {
              if (!e.data.vfs[dir + "/__init__.py"]) {
                pyodide.FS.writeFile(dir + "/__init__.py", "");
                scaffoldedFiles[dir + "/__init__.py"] = "";
              }
            } catch { }
          }
          try {
            pyodide.FS.writeFile("/" + parts.join("/"), vCode);
          } catch (err) {
            console.warn(err);
          }
        }
      } catch (err) {
        console.warn("[Pyodide]: Virtual FS setup failed", err);
      }
    }

    pyodide.globals.set("input_data", input || {});

    if (code.includes("matplotlib") || code.includes("plt")) {
      const matplotlibPatch = `
try:
    import sys
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    if not hasattr(plt, '_original_show'):
        plt._original_show = plt.show
        def _custom_show(*args, **kwargs):
            import io, base64, json
            try:
                fig = plt.gcf()
                if fig and getattr(fig, 'axes', None):
                    buf_png = io.BytesIO()
                    fig.savefig(buf_png, format='png', bbox_inches='tight', dpi=300)
                    buf_png.seek(0)
                    png_b64 = "data:image/png;base64," + base64.b64encode(buf_png.read()).decode('utf-8')

                    buf_svg = io.BytesIO()
                    fig.savefig(buf_svg, format='svg', bbox_inches='tight')
                    buf_svg.seek(0)
                    svg_b64 = "data:image/svg+xml;base64," + base64.b64encode(buf_svg.read()).decode('utf-8')

                    jpeg_b64 = None
                    try:
                        buf_jpeg = io.BytesIO()
                        fig.savefig(buf_jpeg, format='jpeg', bbox_inches='tight', dpi=300, facecolor='white')
                        buf_jpeg.seek(0)
                        jpeg_b64 = "data:image/jpeg;base64," + base64.b64encode(buf_jpeg.read()).decode('utf-8')
                    except Exception:
                        pass

                    pdf_b64 = None
                    try:
                        buf_pdf = io.BytesIO()
                        fig.savefig(buf_pdf, format='pdf', bbox_inches='tight')
                        buf_pdf.seek(0)
                        pdf_b64 = "data:application/pdf;base64," + base64.b64encode(buf_pdf.read()).decode('utf-8')
                    except Exception:
                        pass

                    payload = {
                        "png": png_b64,
                        "svg": svg_b64
                    }
                    if jpeg_b64:
                        payload["jpeg"] = jpeg_b64
                    if pdf_b64:
                        payload["pdf"] = pdf_b64

                    print("__MATPLOTLIB_IMAGE_JSON__:" + json.dumps(payload))
                    plt.close(fig)
            except Exception as ex:
                pass
        plt.show = _custom_show
except Exception:
    pass
`;
      try {
        await pyodide.runPythonAsync(matplotlibPatch);
      } catch (err) { }
    }

    if (e.data.entryPath) {
      let p = e.data.entryPath
        .replace(/^\//, "")
        .replace(/\.py$/, "")
        .split("/");
      let packageName = p.length > 1 ? p.slice(0, p.length - 1).join(".") : "";
      try {
        pyodide.globals.set("__package__", packageName);
        pyodide.globals.set("__file__", e.data.entryPath);
      } catch (err) { }
    }

    const result = await pyodide.runPythonAsync(code);

    reportWorkspaceFileChanges(e.data);

    let finalResult = result;
    if (result && typeof result.toJs === "function") {
      finalResult = result.toJs({ dict_converter: Object.fromEntries });
    }

    if (currentFlushInterval) clearInterval(currentFlushInterval);
    flushLogs();

    post({
      type: "finish",
      id,
      success: true,
      result: finalResult,
    });
  } catch (error: any) {
    if (currentFlushInterval) clearInterval(currentFlushInterval);
    try {
      if (typeof flushLogs === "function") flushLogs();
    } catch (e) { }

    // A script that failed half way may still have written something; that counts.
    reportWorkspaceFileChanges(e.data);

    let eMsg = error ? String(error.message || error) : "Unknown Error";
    post({ type: "finish", id, success: false, error: eMsg });
  }
};
