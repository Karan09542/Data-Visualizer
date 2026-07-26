import { useStore } from '../store/useStore';
import { usePyPackageStore } from '../store/usePyPackageStore';
import lodashGet from 'lodash.get';
import { appendLogs, resetNodeSession, abortExecutionQueue } from './executionStore';
import { buildVirtualFS, getVirtualPath } from './vfs';

export function detectImports(pyCode: string): string[] {
  const imports: string[] = [];
  const lines = pyCode.split('\n');
  const importRegex = /^\s*import\s+([a-zA-Z0-9_,\. ]+)/;
  const fromRegex = /^\s*from\s+([a-zA-Z0-9_\.]+)\s+import/;

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;

    const importMatch = line.match(importRegex);
    if (importMatch) {
      const names = importMatch[1].split(',');
      for (let name of names) {
        name = name.trim().split(/\s+as\s+/)[0].trim().split(/\s+/)[0].split('.')[0].trim();
        if (name && !imports.includes(name)) {
          imports.push(name);
        }
      }
    }

    const fromMatch = line.match(fromRegex);
    if (fromMatch) {
      const name = fromMatch[1].trim().split('.')[0];
      if (name && !imports.includes(name)) {
        imports.push(name);
      }
    }
  }

  const builtins = new Set([
    "os", "sys", "math", "json", "re", "time", "datetime", "hashlib", "random", "collections", 
    "urllib", "http", "socket", "threading", "subprocess", "xml", "csv", "ast", "tempfile", 
    "shutil", "glob", "logging", "typing", "warnings", "functools", "itertools", "io", "pickle",
    "traceback", "inspect", "unittest", "platform", "string", "js", "pyodide", "micropip"
  ]);

  return imports.filter(pkg => !builtins.has(pkg));
}

export const activePyWorkers: Record<string, Worker> = {};
export const activePyWorkersBusy: Record<string, boolean> = {};
export const activePyRejectors: Record<string, (reason?: any) => void> = {};
export const activePyResolvers: Record<string, (value?: any) => void> = {};

export const SHARED_KEY = "shared_global_python_worker";

export let currentExecutingPath: string | null = null;

export const abortPyNode = (path: string, forceTerminate: boolean = false) => { 
    abortExecutionQueue(path);
    try {
        useStore.getState().setActivePrompt(path, null);
    } catch {}
    if (activePyWorkers[SHARED_KEY] && (path === currentExecutingPath || forceTerminate)) {
        activePyWorkers[SHARED_KEY].terminate();
        delete activePyWorkers[SHARED_KEY];
        delete activePyWorkersBusy[SHARED_KEY];
        currentExecutingPath = null;
    }
    if (activePyRejectors[path]) {
        activePyRejectors[path](new Error("Execution aborted by user"));
        delete activePyRejectors[path];
        delete activePyResolvers[path];
    }
};

export const executePyNode = async (path: string, codeToRun: string) => {
    // Safely abort any previous execution first to prevent concurrent overlapping state and solve execution sequence conflicts.
    abortPyNode(path);

    const startTime = performance.now();
    const store = useStore.getState();
    const { parsedData, setJsNodeLoading, setJsNodeError, setJsNodeResponse, setJsNodeLogs } = store;

    // Extract input data (parent object without this node)
    let inputData = null;
    const parts = path.split('.');
    if (parts.length > 1) {
      parts.pop(); // remove last key
      const parentPath = parts.join('.');
      
      let parentObj = null;
      try {
        if (parentPath === 'root' || parentPath === '') {
          parentObj = parsedData;
        } else {
           const lodashPath = parentPath.startsWith('root.') ? parentPath.substring(5) : parentPath.startsWith('root[') ? parentPath.substring(4) : parentPath;
           if (!lodashPath) {
             parentObj = parsedData;
           } else {
             parentObj = lodashGet(parsedData, lodashPath);
           }
        }
      } catch(e) {
         console.warn("Could not extract input data", e);
      }
      
      if (typeof parentObj === 'object' && parentObj !== null) {
          const clonedObj = Array.isArray(parentObj) ? [...parentObj] : { ...parentObj };
          const thisKey = path.split('.').pop()?.replace(/\[[0-9]+\]$/, '');
          if (thisKey && !Array.isArray(clonedObj)) {
            delete clonedObj[thisKey];
          }
          inputData = clonedObj;
      } else {
          inputData = parentObj;
      }
    } else {
      inputData = parsedData;
    }

    setJsNodeLoading(path, true);
    setJsNodeError(path, null);

    // Analyze packages before execution
    const codeImports = detectImports(codeToRun);
    const packageStore = usePyPackageStore.getState();
    const installed = packageStore.installedPackages.map(p => p.name.toLowerCase());
    
    const vfs = buildVirtualFS(parsedData);
    const state = useStore.getState();
    for (const [objPath, codeOverride] of Object.entries(state.jsNodeCodeOverrides)) {
        if (codeOverride !== undefined) {
            const vPath = getVirtualPath(objPath, parsedData);
            if (vPath) vfs[vPath] = codeOverride;
        }
    }
    const entryPath = getVirtualPath(path, parsedData);
    const scriptDir = entryPath.substring(0, entryPath.lastIndexOf('/')) || '/';
    
    const isLocalModule = (pkg: string) => {
        // Also check if pkg exists relative to scriptDir
        if (vfs[`${scriptDir === '/' ? '' : scriptDir}/${pkg}.py`] !== undefined) return true;
        if (vfs[`${scriptDir === '/' ? '' : scriptDir}/${pkg}/__init__.py`] !== undefined) return true;

        if (vfs[`/${pkg}.py`] !== undefined) return true;
        if (vfs[`/${pkg}/__init__.py`] !== undefined) return true;
        
        const prefix1 = `${scriptDir === '/' ? '' : scriptDir}/${pkg}/`;
        const prefix2 = `/${pkg}/`;
        for (const vfsPath in vfs) {
            if (vfsPath.startsWith(prefix1) || vfsPath.startsWith(prefix2)) return true;
        }
        return false;
    };

    const PIP_PACKAGE_MAP: Record<string, string> = {
      'sklearn': 'scikit-learn',
      'cv2': 'opencv-python',
      'pil': 'pillow',
      'bs4': 'beautifulsoup4',
      'yaml': 'pyyaml',
      'crypto': 'pycryptodome',
      'dotenv': 'python-dotenv',
      'jose': 'python-jose',
      'dateutil': 'python-dateutil',
      'fitz': 'pymupdf',
      'docx': 'python-docx',
      'github': 'pygithub',
      'latexify': 'latexify-py'
    };

    const PYTHON_STDLIB = new Set([
      'abc', 'argparse', 'array', 'ast', 'asyncio', 'base64', 'bisect', 'builtins', 'calendar',
      'cmath', 'collections', 'concurrent', 'contextlib', 'copy', 'csv', 'ctypes', 'dataclasses',
      'datetime', 'decimal', 'difflib', 'enum', 'functools', 'glob', 'hashlib', 'heapq', 'hmac',
      'html', 'http', 'importlib', 'inspect', 'io', 'itertools', 'json', 'logging', 'math',
      'multiprocessing', 'os', 'pathlib', 'pickle', 'pprint', 'queue', 'random', 're', 'secrets',
      'shutil', 'socket', 'sqlite3', 'statistics', 'string', 'subprocess', 'sys', 'tempfile',
      'threading', 'time', 'typing', 'unittest', 'urllib', 'uuid', 'warnings', 'xml', 'zipfile',
      'zoneinfo'
    ]);

    // Filter out local modules and map to correct pip package names
    let missing = codeImports
        .filter(pkg => !isLocalModule(pkg) && !PYTHON_STDLIB.has(pkg.toLowerCase()))
        .map(pkg => {
             const lower = pkg.toLowerCase();
             return PIP_PACKAGE_MAP[lower] || lower;
        })
        .filter(pkg => !installed.includes(pkg));

    // Remove duplicates
    missing = Array.from(new Set(missing));

    if (missing.length > 0) {
      if (packageStore.autoInstallMissing) {
        for (const pkg of missing) {
          const cleanPkg = pkg.toLowerCase();
          await appendLogs(path, [{
            type: "log",
            args: [`[Import Detector]: Missing package "${cleanPkg}" detected. Auto-installing...`],
            time: new Date().toISOString()
          }]);
          const success = await packageStore.installPackage(cleanPkg, path);
          if (!success) {
            setJsNodeError(path, `Auto-installation of missing dependency "${cleanPkg}" failed. Execution aborted.`);
            setJsNodeLoading(path, false);
            return;
          }
        }
      } else {
        packageStore.setShowMissingModal({
          isOpen: true,
          path,
          missingPackages: missing.map(m => m.toLowerCase())
        });
        setJsNodeLoading(path, false);
        return;
      }
    }
    
    try {
      const sessionId = Date.now().toString() + Math.random().toString(36).substring(7);
      if (store.autoClearLogs) {
          await resetNodeSession(path, sessionId);
      }

      let worker = activePyWorkers[SHARED_KEY];
      if (!worker) {
          worker = new Worker(new URL('./pyWorker.ts', import.meta.url), { type: 'module' });
          activePyWorkers[SHARED_KEY] = worker;
      }

      const timeoutMs = 60000;
      activePyWorkersBusy[SHARED_KEY] = true;
      currentExecutingPath = path;
      
      const executionPromise = new Promise((resolve, reject) => {
         activePyRejectors[path] = reject;
         activePyResolvers[path] = resolve;
         
         const executionId = Math.random().toString(36).substring(7);
         
         const timeoutId = setTimeout(() => {
            cleanup();
            if (activePyWorkers[SHARED_KEY] === worker) {
               worker.terminate();
               delete activePyWorkers[SHARED_KEY];
               delete activePyWorkersBusy[SHARED_KEY];
               if (currentExecutingPath === path) {
                  currentExecutingPath = null;
               }
               reject(new Error(`Execution Timeout: Script ran longer than ${timeoutMs}ms.`));
               delete activePyResolvers[path];
               delete activePyRejectors[path];
            }
         }, timeoutMs);

         const messageHandler = async (e: MessageEvent) => {
            if (e.data.type === 'trigger_download') {
                 try {
                     const link = document.createElement('a');
                     link.href = e.data.url;
                     link.download = e.data.filename || 'download';
                     document.body.appendChild(link);
                     link.click();
                     document.body.removeChild(link);
                 } catch (err) {
                     console.error("Failed to perform trigger_download in executor host", err);
                 }
                 return;
             }

             if (e.data.type === 'logs') {
                await appendLogs(path, e.data.logs);
                return;
            }

            if (e.data.type === 'need_prompt') {
                 const storeState = useStore.getState();
                 storeState.setActivePrompt(path, {
                     sessionId: e.data.sessionId,
                     promptText: e.data.promptText,
                     defaultValue: e.data.defaultValue,
                     type: e.data.promptType || 'input'
                 });
                 return;
             }

             if (e.data.type === 'finish') {
                cleanup();
                if (e.data.success) {
                   resolve(e.data);
                } else {
                   reject(new Error(e.data.error || "Execution failed"));
                }
                
                activePyWorkersBusy[SHARED_KEY] = false;
                if (currentExecutingPath === path) {
                   currentExecutingPath = null;
                }
                delete activePyResolvers[path];
                delete activePyRejectors[path];
            }
         };

         const errorHandler = (e: ErrorEvent) => {
            e.preventDefault();
            cleanup();
            reject(new Error(e.message));
            if (activePyWorkers[SHARED_KEY] === worker) {
               worker.terminate();
               delete activePyWorkers[SHARED_KEY];
               delete activePyWorkersBusy[SHARED_KEY];
            }
            if (currentExecutingPath === path) {
               currentExecutingPath = null;
            }
            delete activePyResolvers[path];
            delete activePyRejectors[path];
         };

         function cleanup() {
            clearTimeout(timeoutId);
            if (worker) {
               worker.removeEventListener("message", messageHandler);
               worker.removeEventListener("error", errorHandler);
            }
         }

         worker.addEventListener("message", messageHandler);
         worker.addEventListener("error", errorHandler);

         const vfs = buildVirtualFS(parsedData);
         const state = useStore.getState();
         for (const [objPath, codeOverride] of Object.entries(state.jsNodeCodeOverrides)) {
             if (codeOverride !== undefined) {
                 const vPath = getVirtualPath(objPath, parsedData);
                 if (vPath) vfs[vPath] = codeOverride;
             }
         }
         const entryPath = getVirtualPath(path, parsedData);
         const enabledProxies = state.proxyServers.filter(p => p.isEnabled).map(p => p.url);
         if (state.useDefaultProxy) {
            enabledProxies.push("https://go.data-visualizer.workers.dev/?url=");
         }
         worker.postMessage({ 
            code: codeToRun, 
            input: inputData, 
            id: executionId,
            vfs,
            entryPath,
            cacheEnabled: usePyPackageStore.getState().pyPackageCacheEnabled,
            enabledProxies
         });
      });

      const response: any = await executionPromise;
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setJsNodeResponse(path, response.result);
      store.setJsNodeRunMetadata(path, duration, "Just now");
      
    } catch (err: any) {
       let errMsg = err.message || "Unknown error";
       const endTime = performance.now();
       const duration = Math.round(endTime - startTime);
       store.setJsNodeRunMetadata(path, duration, "Just now");
       setJsNodeError(path, errMsg);
    } finally {
       activePyWorkersBusy[SHARED_KEY] = false;
       if (currentExecutingPath === path) {
          currentExecutingPath = null;
       }
       setJsNodeLoading(path, false);
    }
};
