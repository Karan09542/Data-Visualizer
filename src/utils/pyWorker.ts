import { loadPyodide } from "pyodide";
import { getInstalledPackages, pyDb } from "./pyDb";

// Set up shims for window and document so python scripts can import them and perform actions like downloads
(self as any).window = self;

const mockDocument = {
  body: {
    appendChild: (element: any) => {
      return element;
    },
    removeChild: (element: any) => {
      return element;
    }
  },
  createElement: (tagName: string) => {
    if (typeof tagName === "string" && tagName.toLowerCase() === "a") {
      return {
        tagName: "A",
        href: "",
        download: "",
        click: function(this: any) {
          self.postMessage({
            type: "trigger_download",
            url: this.href,
            filename: this.download
          });
        }
      };
    }
    return {};
  }
};

(self as any).document = mockDocument;

let cacheEnabled = true;

const originalFetch = self.fetch;

self.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = typeof input === "string" ? input : (input instanceof URL ? input.href : input.url);
  
  if (cacheEnabled && urlStr.endsWith(".whl")) {
    try {
      const cached = await pyDb.wheels.get(urlStr);
      if (cached && cached.data) {
        return new Response(cached.data, {
          status: 200,
          headers: { 
            "Content-Type": "application/x-pip-egg-info",
            "Content-Length": String(cached.data.byteLength),
            "X-Cache": "Dexie-Hit",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*"
          }
        });
      }
    } catch (err) {
      console.warn("[Pyodide Cache]: Dexie wheel read failed:", err);
    }

    try {
      const response = await originalFetch(input, init);
      if (response.ok) {
        const clonedRes = response.clone();
        clonedRes.arrayBuffer().then((buffer) => {
          pyDb.wheels.put({
            url: urlStr,
            data: buffer,
            cachedAt: Date.now()
          }).catch((err) => {
            console.warn("[Pyodide Cache]: Failed to cache wheel:", err);
          });
        }).catch((err) => {
          console.warn("[Pyodide Cache]: Failed to extract array buffer:", err);
        });
        
        return response;
      }
      return response;
    } catch (err) {
      return originalFetch(input, init);
    }
  }

  return originalFetch(input, init);
};

let pyodide: any = null;
let currentFlushInterval: any = null;
let activeAddLog: ((logType: string, args: any[]) => void) | null = null;
let currentSessionId: string = "";

self.addEventListener("error", (e) => {
    e.preventDefault();
    self.postMessage({ type: "finish", success: false, error: e.message || "Worker global error" });
});

self.addEventListener("unhandledrejection", (e) => {
    e.preventDefault();
    let msg = "Worker unhandled rejection";
    try { msg = e.reason ? String(e.reason.message || e.reason) : msg; } catch (err) {}
    self.postMessage({ type: "finish", success: false, error: msg });
});

async function installPackageInWorker(name: string, addLog: (type: string, args: any[]) => void) {
  addLog("log", [`[Pyodide Pip]: Checking prebuilt bundle or PyPI for "${name}"...`]);
  try {
    await pyodide.loadPackage(name);
    let version = "latest";
    try {
      if (name === "matplotlib") {
        try { pyodide.runPython("import matplotlib; matplotlib.use('Agg')"); } catch {}
      }
      version = pyodide.runPython(`import ${name}; import importlib.metadata as meta; meta.version('${name}')`) || "latest";
    } catch {
      try {
        if (name === "matplotlib") {
          try { pyodide.runPython("import matplotlib; matplotlib.use('Agg')"); } catch {}
        }
        version = pyodide.runPython(`import ${name}; ${name}.__version__`) || "latest";
      } catch {}
    }
    addLog("log", [`[Pyodide Pip]: Successfully loaded prebuilt library "${name}" (v${version})`]);
    return { success: true, version };
  } catch (err: any) {
    addLog("log", [`[Pyodide Pip]: "${name}" is not prebuilt or failed to load directly. Installing from PyPI via micropip...`]);
    try {
      await pyodide.loadPackage("micropip");
      await pyodide.runPythonAsync(`
import micropip
await micropip.install('${name}')
      `);
      let version = "latest";
      try {
        if (name === "matplotlib") {
          try { pyodide.runPython("import matplotlib; matplotlib.use('Agg')"); } catch {}
        }
        version = pyodide.runPython(`import ${name}; import importlib.metadata as meta; meta.version('${name}')`) || "latest";
      } catch {
        try {
          if (name === "matplotlib") {
            try { pyodide.runPython("import matplotlib; matplotlib.use('Agg')"); } catch {}
          }
          version = pyodide.runPython(`import ${name}; ${name}.__version__`) || "latest";
        } catch {}
      }
      addLog("log", [`[Pyodide Pip]: Successfully installed "${name}" (v${version}) from PyPI!`]);
      return { success: true, version };
    } catch (micropipErr: any) {
      const msg = micropipErr.message || String(micropipErr);
      addLog("error", [`[Pyodide Pip]: Installation error for "${name}": ${msg}`]);
      return { success: false, error: msg };
    }
  }
}

self.onmessage = async (e) => {
    const { code, input, id, type, cacheEnabled: msgCacheEnabled } = e.data;
    if (msgCacheEnabled !== undefined) {
        cacheEnabled = msgCacheEnabled;
    }
    currentSessionId = id || "";

    // Support clear logs if a command requests it
    if (type === "clear") {
        return;
    }

    let flushLogs = () => {};

    try {
        const getTime = () => {
            const d = new Date();
            return d.getUTCHours().toString().padStart(2, "0") + ":" + d.getUTCMinutes().toString().padStart(2, "0") + ":" + d.getUTCSeconds().toString().padStart(2, "0") + "." + d.getUTCMilliseconds().toString().padStart(3, "0");
        };

        let logBatch: any[] = [];
        flushLogs = () => {
            try {
                if (logBatch.length > 0) {
                    self.postMessage({ type: "logs", logs: logBatch });
                    logBatch = [];
                }
            } catch (err: any) {
                logBatch = [{ type: "error", args: ["Log Serialization Error: " + err.message], time: getTime() }];
                try { self.postMessage({ type: "logs", logs: logBatch }); } catch (err2) {}
                logBatch = [];
            }
        };

        if (currentFlushInterval) clearInterval(currentFlushInterval);
        currentFlushInterval = setInterval(flushLogs, 50);

        const addLog = (logType: string, args: any[]) => {
            const safeArgs = args.map(a => {
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
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/"
            });
            pyodide.setStdout({ batched: (msg: any) => {
                if (activeAddLog) {
                    activeAddLog("log", [msg]);
                }
            }});
            pyodide.setStderr({ batched: (msg: any) => {
                if (activeAddLog) {
                    activeAddLog("error", [msg]);
                }
            }});
            pyodide.setStdin({
                stdin: () => {
                    self.postMessage({
                        type: "need_prompt",
                        sessionId: currentSessionId,
                        promptText: "Python input requested",
                        promptType: "input"
                    });

                    const xhr = new XMLHttpRequest();
                    xhr.open("GET", `${self.location.origin}/api/stdin-get?sessionId=${currentSessionId}`, false);
                    xhr.send();

                    if (xhr.status === 200) {
                        try {
                            const res = JSON.parse(xhr.responseText);
                            const val = (res.value !== null && res.value !== undefined) ? String(res.value) : "";
                            if (activeAddLog) {
                                activeAddLog("log", [val]);
                            }
                            return val + "\n";
                        } catch (err) {
                            console.error("Error parsing stdin result", err);
                        }
                    }
                    return "\n";
                }
            });
            addLog("log", ["[Pyodide]: Runtime initialized successfully!"]);

            // Automatically restore previously installed packages on cold-boot
            try {
                addLog("log", ["[Pyodide Backend]: Scanning workspace registry for installed packages..."]);
                const installedPkgs = await getInstalledPackages();
                const readyPkgs = installedPkgs.filter(p => p.status === "installed");
                
                if (readyPkgs.length > 0) {
                    addLog("log", [`[Pyodide Backend]: Restoring ${readyPkgs.length} installed package environments...`]);
                    for (const pkg of readyPkgs) {
                        try {
                            addLog("log", [`[Pyodide Backend]: Restoring package "${pkg.name}"...`]);
                            await pyodide.loadPackage(pkg.name);
                            if (pkg.name === "matplotlib") {
                                try { pyodide.runPython("import matplotlib; matplotlib.use('Agg')"); } catch {}
                            }
                        } catch (loadErr: any) {
                            // If load failed, attempt micropip
                            try {
                                await pyodide.loadPackage("micropip");
                                await pyodide.runPythonAsync(`import micropip; await micropip.install('${pkg.name}')`);
                                if (pkg.name === "matplotlib") {
                                    try { pyodide.runPython("import matplotlib; matplotlib.use('Agg')"); } catch {}
                                }
                            } catch (e: any) {
                                addLog("error", [`[Pyodide Backend]: Failed to load and restore "${pkg.name}": ${loadErr.message || loadErr}`]);
                            }
                        }
                    }
                    addLog("log", [`[Pyodide Backend]: Environment restored. Ready packages: ${readyPkgs.map(p => p.name).join(", ")}`]);
                } else {
                    addLog("log", ["[Pyodide Backend]: No previously installed packages found. Clean environment."]);
                }
            } catch (dbErr: any) {
                console.warn("Could not scan IndexedDB in worker coldboot", dbErr);
            }
        }

        // Check if the current message is a dedicated installation request
        if (type === "install_package") {
            const { packageName, installId, cacheEnabled: msgCacheEnabled } = e.data;
            if (msgCacheEnabled !== undefined) {
                cacheEnabled = msgCacheEnabled;
            }
            const res = await installPackageInWorker(packageName, addLog);
            
            if (currentFlushInterval) clearInterval(currentFlushInterval);
            flushLogs();
            
            self.postMessage({
                type: "package_installed",
                packageName,
                installId,
                success: res.success,
                version: res.version,
                error: res.error
            });
            return;
        }

        // Otherwise, execute standard user python script
        if (e.data.vfs) {
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
    if f and type(f) is str and f.startswith('/') and not f.startswith('/lib/'):
        del sys.modules[k]
importlib.invalidate_caches()
`;
                if (e.data.entryPath) {
                    const scriptDir = e.data.entryPath.substring(0, e.data.entryPath.lastIndexOf('/')) || '/';
                    pySysCode += `\nif '${scriptDir}' not in sys.path:\n    sys.path.append('${scriptDir}')`;
                }
                pyodide.runPython(pySysCode);
                for (const [vPath, vCode] of Object.entries(e.data.vfs)) {
                    if (vPath.endsWith('.py') || vPath.endsWith('.json')) {
                        const parts = vPath.split('/').filter(Boolean);
                        let dir = '';
                        for (let i = 0; i < parts.length - 1; i++) {
                            dir += '/' + parts[i];
                            try { pyodide.FS.mkdir(dir); } catch {}
                            try {
                                if (!e.data.vfs[dir + '/__init__.py']) {
                                    pyodide.FS.writeFile(dir + '/__init__.py', '');
                                }
                            } catch {}
                        }
                        try { pyodide.FS.writeFile('/' + parts.join('/'), vCode); } catch(err) { console.warn(err) }
                    }
                }
            } catch (err) {
                console.warn("[Pyodide]: Virtual FS setup failed", err);
            }
        }

        pyodide.globals.set("input_data", input || {});

        let codeWithPatch = code;
        if (code.includes("matplotlib") || code.includes("plt")) {
            codeWithPatch = `
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
                    # PNG Custom (High-res 300 DPI for premium quality)
                    buf_png = io.BytesIO()
                    fig.savefig(buf_png, format='png', bbox_inches='tight', dpi=300)
                    buf_png.seek(0)
                    png_b64 = "data:image/png;base64," + base64.b64encode(buf_png.read()).decode('utf-8')

                    # SVG Vector (Clean vector rendering, supports infinite zoom)
                    buf_svg = io.BytesIO()
                    fig.savefig(buf_svg, format='svg', bbox_inches='tight')
                    buf_svg.seek(0)
                    svg_b64 = "data:image/svg+xml;base64," + base64.b64encode(buf_svg.read()).decode('utf-8')

                    # JPEG Custom
                    jpeg_b64 = None
                    try:
                        buf_jpeg = io.BytesIO()
                        fig.savefig(buf_jpeg, format='jpeg', bbox_inches='tight', dpi=300, facecolor='white')
                        buf_jpeg.seek(0)
                        jpeg_b64 = "data:image/jpeg;base64," + base64.b64encode(buf_jpeg.read()).decode('utf-8')
                    except Exception:
                        pass

                    # PDF Custom
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

` + code;
        }

        if (e.data.entryPath) {
            let p = e.data.entryPath.replace(/^\//, '').replace(/\.py$/, '').split('/');
            let packageName = p.length > 1 ? p.slice(0, p.length - 1).join('.') : '';
            codeWithPatch = `__package__ = "${packageName}"\n__file__ = "${e.data.entryPath}"\n` + codeWithPatch;
        }

        const result = await pyodide.runPythonAsync(codeWithPatch);

        let finalResult = result;
        if (result && typeof result.toJs === "function") {
            finalResult = result.toJs({ dict_converter: Object.fromEntries });
        }

        if (currentFlushInterval) clearInterval(currentFlushInterval);
        flushLogs();

        try {
            self.postMessage({ type: "finish", id, success: true, result: finalResult });
        } catch (postErr) {
            // Safe fallback if the result object is not cloneable (e.g. contains functions or DOM mocks)
            try {
                let safeResult = null;
                if (typeof finalResult === "object" && finalResult !== null) {
                    safeResult = JSON.parse(JSON.stringify(finalResult, (key, value) => {
                        if (typeof value === "function") return undefined;
                        return value;
                    }));
                } else {
                    safeResult = String(finalResult);
                }
                self.postMessage({ type: "finish", id, success: true, result: safeResult });
            } catch (err2) {
                self.postMessage({ type: "finish", id, success: true, result: null });
            }
        }
    } catch (error: any) {
        if (currentFlushInterval) clearInterval(currentFlushInterval);
        try { if (typeof flushLogs === "function") flushLogs(); } catch (e) {}

        let eMsg = error ? String(error.message || error) : "Unknown Error";
        self.postMessage({ type: "finish", id, success: false, error: eMsg });
    }
};
