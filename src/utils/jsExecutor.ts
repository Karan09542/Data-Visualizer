import { useStore } from "../store/useStore";
import lodashGet from "lodash.get";
import { transform } from "sucrase";
import {
  appendLogs,
  resetNodeSession,
  abortExecutionQueue,
} from "./executionStore";
import { buildVirtualFS, getVirtualPath } from "./vfs";

export const activeWorkers: Record<string, Worker> = {};
export const activeRejectors: Record<string, (reason?: any) => void> = {};

export const abortJsNode = (path: string) => {
  abortExecutionQueue(path);
  if (activeWorkers[path]) {
    activeWorkers[path].terminate();
    delete activeWorkers[path];
  }
  if (activeRejectors[path]) {
    activeRejectors[path](new Error("Execution aborted by user"));
    delete activeRejectors[path];
  }
};

export const executeJsNode = async (path: string, codeToRun: string) => {
  // Safely abort any previous execution first to prevent concurrent overlapping state and solve execution sequence conflicts.
  abortJsNode(path);

  const startTime = performance.now();
  const store = useStore.getState();
  const {
    parsedData,
    setJsNodeLoading,
    setJsNodeError,
    setJsNodeResponse,
    setJsNodeLogs,
  } = store;

  // Extract input data (parent object without this js_node)
  let inputData = null;
  const parts = path.split(".");
  if (parts.length > 1) {
    parts.pop(); // remove last key
    const parentPath = parts.join(".");

    let parentObj = null;
    try {
      if (parentPath === "root" || parentPath === "") {
        parentObj = parsedData;
      } else {
        const lodashPath = parentPath.startsWith("root.")
          ? parentPath.substring(5)
          : parentPath.startsWith("root[")
            ? parentPath.substring(4)
            : parentPath;
        if (!lodashPath) {
          parentObj = parsedData;
        } else {
          parentObj = lodashGet(parsedData, lodashPath);
        }
      }
    } catch (e) {
      console.warn("Could not extract input data", e);
    }

    if (typeof parentObj === "object" && parentObj !== null) {
      const clonedObj = Array.isArray(parentObj)
        ? [...parentObj]
        : { ...parentObj };
      const thisKey = path
        .split(".")
        .pop()
        ?.replace(/\[[0-9]+\]$/, "");
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

  try {
    const sessionId =
      Date.now().toString() + Math.random().toString(36).substring(7);
    if (store.autoClearLogs) {
      await resetNodeSession(path, sessionId);
    }

    // Setup Virtual Filesystem
    const vfs = buildVirtualFS(parsedData);
    const state = useStore.getState();
    for (const [objPath, codeOverride] of Object.entries(
      state.jsNodeCodeOverrides,
    )) {
      if (codeOverride !== undefined) {
        const vPath = getVirtualPath(objPath, parsedData);
        if (vPath) vfs[vPath] = codeOverride;
      }
    }
    const entryPath = getVirtualPath(path, parsedData);
    vfs[entryPath] = codeToRun; // Override with the current edited code

    // Transpilation Phase (JS -> JS with CommonJS imports via Sucrase)
    const compiledVfs: Record<string, string> = {};
    for (const [vPath, vCode] of Object.entries(vfs)) {
      if (vPath.endsWith(".ts") || vPath.endsWith(".js")) {
        try {
          // even JS files might use 'import', so we use sucrase to convert to CJS
          compiledVfs[vPath] = transform(vCode, {
            transforms: ["typescript", "imports"],
          }).code;
        } catch (compileErr: any) {
          if (vPath === entryPath) {
            throw new Error(`Compilation Failed: ${compileErr.message}`);
          }
          console.warn(`Failed to compile ${vPath}:`, compileErr);
        }
      } else if (vPath.endsWith(".json")) {
        compiledVfs[vPath] = vCode;
      }
    }

    const enabledProxies = store.proxyServers.filter(p => p.isEnabled).map(p => p.url);
    if (store.useDefaultProxy) {
        enabledProxies.push("https://go.data-visualizer.workers.dev/?url=");
    }
    const workerCode = `
         let __activeTasks = 0;
         let __resolveExecution = null;
         const __checkCompletion = () => {
             if (__activeTasks === 0 && __resolveExecution) {
                 __resolveExecution();
                 __resolveExecution = null;
             }
         };

         const origSetTimeout = self.setTimeout;
         const origClearTimeout = self.clearTimeout;
         const origSetInterval = self.setInterval;
         const origClearInterval = self.clearInterval;
         const __timerMap = new Set();

         self.setTimeout = function(fn, delay, ...args) {
             const id = origSetTimeout(async (...a) => {
                 __timerMap.delete(id);
                 try { 
                    if (typeof fn === 'function') await fn(...a); 
                 } finally {
                     __activeTasks--;
                     __checkCompletion();
                 }
             }, delay, ...args);
             __timerMap.add(id);
             __activeTasks++;
             return id;
         };

         self.clearTimeout = function(id) {
             origClearTimeout(id);
             if (__timerMap.has(id)) {
                 __timerMap.delete(id);
                 __activeTasks--;
                 __checkCompletion();
             }
         };

         self.setInterval = function(fn, delay, ...args) {
             const id = origSetInterval(async (...a) => {
                 if (typeof fn === 'function') await fn(...a);
             }, delay, ...args);
             __timerMap.add(id);
             __activeTasks++;
             return id;
         };

         self.clearInterval = function(id) {
             origClearInterval(id);
             if (__timerMap.has(id)) {
                 __timerMap.delete(id);
                 __activeTasks--;
                 __checkCompletion();
             }
         };

         const originalFetch = self.fetch;
         const enabledProxies = ${JSON.stringify(enabledProxies)};
         self.fetch = async function(input, init) {
             __activeTasks++;
             try {
                 let urlStr = typeof input === "string" ? input : (input instanceof URL ? input.href : input.url);
                 try {
                     return await originalFetch(input, init);
                 } catch (err) {
                     if (err.name === "TypeError" && err.message === "Failed to fetch") {
                         if (typeof urlStr === "string" && (urlStr.startsWith("http://") || urlStr.startsWith("https://"))) {
                             let isCrossOrigin = false;
                             try {
                                 const parsed = new URL(urlStr);
                                 isCrossOrigin = parsed.origin !== self.location.origin;
                             } catch (e) {}
    
                             if (isCrossOrigin) {
                                 for (const proxyBaseUrl of enabledProxies) {
                                     if (urlStr.includes(proxyBaseUrl)) continue; // avoid proxying to itself
                                     try {
                                         console.warn("[JS Fetch]: CORS/network error. Retrying via proxy: " + proxyBaseUrl);
                                         const proxyUrl = proxyBaseUrl + urlStr;
                                         return await originalFetch(proxyUrl, init);
                                     } catch (proxyErr) {
                                         console.warn("[JS Fetch]: Proxy fallback failed for " + proxyBaseUrl, proxyErr);
                                     }
                                 }
                             }
                         }
                     }
                     throw err;
                 }
             } finally {
                 __activeTasks--;
                 __checkCompletion();
             }
         };

         self.addEventListener('error', (e) => {
             e.preventDefault();
             self.postMessage({ success: false, error: e.message || 'Worker global error', stack: e.error ? e.error.stack : undefined });
         });
         self.addEventListener('unhandledrejection', (e) => {
             e.preventDefault();
             let msg = 'Worker unhandled rejection';
             let st = undefined;
             try { msg = e.reason ? String(e.reason.message || e.reason) : msg; } catch(err){}
             try { st = e.reason ? String(e.reason.stack) : undefined; } catch(err){}
             self.postMessage({ success: false, error: msg, stack: st });
         });
         self.onmessage = async function(e) {
            const { code, input } = e.data;
            let flushInterval;
            try {
               const getPos = () => {
                   try { throw new Error(); } catch (err) {
                       const match = err.stack && (err.stack.match(/<anonymous>:(\\d+):(\\d+)/) || err.stack.match(/eval:(\\d+):(\\d+)/));
                       if (match) return { line: Math.max(1, parseInt(match[1]) - 3), col: parseInt(match[2]) };
                   }
                   return undefined;
               };
               const getTime = () => {
                   const d = new Date();
                   return d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0') + ':' + d.getUTCSeconds().toString().padStart(2, '0') + '.' + d.getUTCMilliseconds().toString().padStart(3, '0');
               };
               
               let logBatch = [];
               
               const flushLogs = () => { try { if (logBatch.length > 0) { self.postMessage({ type: 'logs', logs: logBatch }); logBatch = []; } } catch (err) { logBatch = [{ type: 'error', args: ['Log Serialization Error: ' + err.message], time: getTime() }]; try { self.postMessage({ type: 'logs', logs: logBatch }); } catch(err2) {} logBatch = []; } };
               
               flushInterval = origSetInterval(flushLogs, 50);
               
               const addLog = (type, args) => {
                   const safeArgs = args.map(a => {
                       if (typeof a === 'function') return '[Function]';
                       if (a instanceof Promise || (a && typeof a.then === 'function')) return '[Promise]';
                       if (a instanceof Error) return a.toString();
                       return a;
                   });
                   const pos = (type === 'error' || type === 'warn') ? getPos() : undefined;
                   logBatch.push({ type, args: safeArgs, pos, time: getTime() });
                   if (logBatch.length >= 5000) flushLogs();
               };
               
               const __timers = new Map();
               const __counters = new Map();
               
               const customConsole = {
                   log: (...args) => addLog('log', args),
                   warn: (...args) => addLog('warn', args),
                   error: (...args) => addLog('error', args),
                   info: (...args) => addLog('log', args),
                   debug: (...args) => addLog('log', args),
                   clear: () => { addLog('clear', []); flushLogs(); },
                   assert: (condition, ...args) => {
                       if (!condition) addLog('error', ['Assertion failed:', ...args.length ? args : ['console.assert']]);
                   },
                   count: (label = 'default') => {
                       const c = (__counters.get(label) || 0) + 1;
                       __counters.set(label, c);
                       addLog('log', [label + ': ' + c]);
                   },
                   countReset: (label = 'default') => {
                       __counters.set(label, 0);
                       addLog('log', [label + ': 0']);
                   },
                   dir: (...args) => addLog('log', args),
                   dirxml: (...args) => addLog('log', args),
                   group: (...args) => addLog('log', args),
                   groupCollapsed: (...args) => addLog('log', args),
                   groupEnd: () => {},
                   table: (data, columns) => {
                       if (typeof data !== 'object' || data === null) { addLog('log', [data]); return; }
                       const rows = []; const cols = new Set(['(index)']);
                       const isArray = Array.isArray(data);
                       for (const key in data) {
                           if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
                           const rowData = data[key];
                           const row = { '(index)': isArray ? Number(key) : key };
                           if (typeof rowData === 'object' && rowData !== null) {
                               for (const col in rowData) {
                                   if (!columns || columns.includes(col)) { cols.add(col); row[col] = typeof rowData[col] === 'object' && rowData[col] !== null ? JSON.stringify(rowData[col]) : String(rowData[col]); }
                               }
                           } else { cols.add('Value'); row['Value'] = String(rowData); }
                           rows.push(row);
                       }
                       const colArr = Array.from(cols); const widths = {};
                       colArr.forEach(c => widths[c] = String(c).length);
                       rows.forEach(r => { colArr.forEach(c => { const l = r[c] !== undefined ? String(r[c]).length : 0; if (l > widths[c]) widths[c] = l; }); });
                       const l = '+' + colArr.map(c => '-'.repeat(widths[c] + 2)).join('+') + '+';
                       let str = l + '\\n|' + colArr.map(c => ' ' + String(c).padEnd(widths[c], ' ') + ' ').join('|') + '|\\n' + l;
                       rows.forEach(r => { str += '\\n|' + colArr.map(c => ' ' + (r[c] !== undefined ? String(r[c]) : '').padEnd(widths[c], ' ') + ' ').join('|') + '|'; });
                       str += '\\n' + l;
                       addLog('log', [str]);
                   },
                   time: (label = 'default') => {
                       __timers.set(label, performance.now());
                   },
                   timeLog: (label = 'default', ...args) => {
                       if (__timers.has(label)) {
                           const duration = performance.now() - __timers.get(label);
                           addLog('log', [label + ': ' + duration.toFixed(3) + ' ms', ...args]);
                       } else {
                           addLog('warn', ["Timer '" + label + "' does not exist"]);
                       }
                   },
                   timeEnd: (label = 'default') => {
                       if (__timers.has(label)) {
                           const duration = performance.now() - __timers.get(label);
                           addLog('log', [label + ': ' + duration.toFixed(3) + ' ms']);
                           __timers.delete(label);
                       } else {
                           addLog('warn', ["Timer '" + label + "' does not exist"]);
                       }
                   },
                   trace: (...args) => {
                       const err = new Error();
                       err.name = 'Trace';
                       addLog('log', [...args, err.stack]);
                   }
               };

               const currentSessionId = "${sessionId}";
                
                self.alert = (message) => {
                    self.postMessage({
                        type: 'need_prompt',
                        sessionId: currentSessionId,
                        promptText: message || "Alert",
                        defaultValue: "",
                        promptType: "alert"
                    });
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', '${window.location.origin}/api/stdin-get?sessionId=' + currentSessionId, false);
                    xhr.send();
                };
                
                self.confirm = (message) => {
                    self.postMessage({
                        type: 'need_prompt',
                        sessionId: currentSessionId,
                        promptText: message || "Confirm",
                        defaultValue: "",
                        promptType: "confirm"
                    });
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', '${window.location.origin}/api/stdin-get?sessionId=' + currentSessionId, false);
                    xhr.send();
                    if (xhr.status === 200) {
                        try {
                            const res = JSON.parse(xhr.responseText);
                            return res.value === true;
                        } catch(e) {}
                    }
                    return false;
                };
                
                self.prompt = (message, defaultValue) => {
                    self.postMessage({
                        type: 'need_prompt',
                        sessionId: currentSessionId,
                        promptText: message || "Prompt",
                        defaultValue: defaultValue || "",
                        promptType: "prompt"
                    });
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', '${window.location.origin}/api/stdin-get?sessionId=' + currentSessionId, false);
                    xhr.send();
                    if (xhr.status === 200) {
                        try {
                            const res = JSON.parse(xhr.responseText);
                            return res.value !== null ? String(res.value) : null;
                        } catch(e) {}
                    }
                    return null;
                };

                const customRequire = (request, currentPath) => {
                    if (!request.startsWith('.')) {
                        throw new Error(\`Absolute and package imports are not supported yet ('\${request}')\`);
                    }
                    const parts = currentPath.substring(0, currentPath.lastIndexOf('/')).split('/').filter(Boolean);
                    for (const part of request.split('/')) {
                        if (part === '.') continue;
                        if (part === '..') parts.pop();
                        else parts.push(part);
                    }
                    let resolved = '/' + parts.join('/');
                    const vfsData = e.data.vfs;
                    
                    let targetPaths = [];
                    if (resolved.endsWith('.js') || resolved.endsWith('.ts') || resolved.endsWith('.json')) {
                        targetPaths.push(resolved); // Exact match
                        if (resolved.endsWith('.js')) targetPaths.push(resolved.substring(0, resolved.length - 3) + '.ts'); // Fallback to .ts if .js requested
                        if (resolved.endsWith('.ts')) targetPaths.push(resolved.substring(0, resolved.length - 3) + '.js'); // Fallback to .js if .ts requested
                    } else {
                        targetPaths.push(resolved + '.ts');
                        targetPaths.push(resolved + '.js');
                        targetPaths.push(resolved + '.json');
                        targetPaths.push(resolved + '/index.ts');
                        targetPaths.push(resolved + '/index.js');
                    }
                    
                    let finalResolved = null;
                    for (const p of targetPaths) {
                        if (vfsData[p] !== undefined) {
                            finalResolved = p;
                            break;
                        }
                    }
                    if (finalResolved !== null) resolved = finalResolved;
                    
                    if (!vfsData[resolved]) throw new Error(\`Cannot resolve module '\${request}' from '\${currentPath}'\`);
                    
                    if (!self.__import_stack__) self.__import_stack__ = [];

                    if (self.__modules__[resolved]) {
                        if (self.__modules__[resolved].loading) {
                            const cycleStartIndex = self.__import_stack__.indexOf(resolved);
                            let cyclePathStr = "";
                            if (cycleStartIndex !== -1) {
                                const cyclePath = [...self.__import_stack__.slice(cycleStartIndex), resolved].map(p => p.startsWith('/') ? p.substring(1) : p);
                                cyclePathStr = cyclePath.join(" -> ");
                                customConsole.warn("Circular dependency detected:\\n\\n" + cyclePath.join("\\n → ") + "\\n\\nExports may be partially initialized.");
                            }
                            
                            return new Proxy(self.__modules__[resolved].exports, {
                                get(target, prop) {
                                    const actualExports = self.__modules__[resolved].exports;
                                    if (actualExports && typeof actualExports === 'object' && prop in actualExports) return actualExports[prop];
                                    if (actualExports && typeof actualExports === 'function' && prop in actualExports) return actualExports[prop];
                                    if (prop === '__esModule') return actualExports && actualExports.__esModule;
                                    if (typeof prop === 'symbol') return undefined; // Avoid errors on Promise detection etc
                                    if (prop === 'then') return undefined;
                                    
                                    throw new ReferenceError("Cannot access '" + String(prop) + "' before initialization. This export is uninitialized due to a circular dependency:\\n" + cyclePathStr);
                                }
                            });
                        }
                        return self.__modules__[resolved].exports;
                    }

                    if (resolved.endsWith('.json')) {
                        const parsed = JSON.parse(vfsData[resolved]);
                        const module = { exports: parsed, loading: false, loaded: true };
                        Object.defineProperty(parsed, 'default', {
                            value: parsed,
                            enumerable: false,
                            configurable: true
                        });
                        self.__modules__[resolved] = module;
                        return module.exports;
                    }
                    
                    const module = { exports: {}, loading: true, loaded: false };
                    self.__modules__[resolved] = module;
                    
                    self.__import_stack__.push(resolved);

                    try {
                        const localRequire = (req) => customRequire(req, resolved);
                        const wrapper = new Function('require', 'exports', 'module', 'console', 'input', vfsData[resolved]);
                        wrapper(localRequire, module.exports, module, customConsole, input);
                    } finally {
                        module.loading = false;
                        module.loaded = true;
                        self.__import_stack__.pop();
                    }
                    
                    return module.exports;
                };

                self.__modules__ = {};
                self.__import_stack__ = [];
                
                // Polyfill async execution for the entry point
                const entryModule = { exports: {}, loading: true, loaded: false };
                self.__modules__[e.data.entryPath] = entryModule;
                self.__import_stack__.push(e.data.entryPath);
                
                const localRequire = (req) => customRequire(req, e.data.entryPath);
                
                const executionFunc = new Function('require', 'exports', 'module', 'console', 'input', "return (async () => {\\n" + e.data.vfs[e.data.entryPath] + "\\n})();");
                let result;
                try {
                    result = await executionFunc(localRequire, entryModule.exports, entryModule, customConsole, input);
                    if (__activeTasks > 0) {
                        await new Promise(resolve => { __resolveExecution = resolve; });
                    }
                } finally {
                    entryModule.loading = false;
                    entryModule.loaded = true;
                    self.__import_stack__.pop();
                }
               origClearInterval(flushInterval);
               flushLogs();
               self.postMessage({ success: true, result });
            } catch (error) {
               if (flushInterval) origClearInterval(flushInterval);
               try { if (typeof flushLogs === "function") flushLogs(); } catch(e) {}
               let eMsg = "Unknown Error";
               let eStack = undefined;
               try { eMsg = error ? String(error.message || error) : "Unknown Error"; } catch(e) {}
               try { eStack = error ? String(error.stack) : undefined; } catch(e) {}
               self.postMessage({ success: false, error: eMsg, stack: eStack });
            }
         }
       `
      .replace(/\\`/g, "`")
      .replace(/\\\$/g, "$");

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    activeWorkers[path] = worker;

    const timeoutMs = 60000;

    const executionPromise = new Promise((resolve, reject) => {
      activeRejectors[path] = reject;

      let hasFinished = false;

      const cleanup = () => {
        if (activeWorkers[path] === worker) delete activeWorkers[path];
        if (activeRejectors[path] === reject) delete activeRejectors[path];
      };

      worker.onmessage = async (e) => {
        if (e.data.type === "logs") {
          await appendLogs(path, e.data.logs);
          return;
        }

        hasFinished = true;
        if (e.data.type === "need_prompt") {
          hasFinished = false; // reset finished state for timeout
          const s = useStore.getState();
          s.setActivePrompt(path, {
            sessionId: e.data.sessionId,
            promptText: e.data.promptText,
            defaultValue: e.data.defaultValue,
            type: e.data.promptType || "prompt",
          });
          return;
        }

        if (e.data.success) {
          resolve(e.data);
        } else {
          reject({
            message: e.data.error || "Execution failed",
            stack: e.data.stack,
            isWorkerError: true,
          });
        }
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        cleanup();
      };

      worker.onerror = (e) => {
        e.preventDefault();
        hasFinished = true;
        reject(new Error(e.message));
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        cleanup();
      };

      setTimeout(() => {
        if (!hasFinished) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          cleanup();
          reject(
            new Error(
              `Execution Timeout: Script ran longer than ${timeoutMs}ms.`,
            ),
          );
        }
      }, timeoutMs);

      worker.postMessage({ vfs: compiledVfs, entryPath, input: inputData });
    });

    const response: any = await executionPromise;

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    setJsNodeResponse(path, response.result);
    store.setJsNodeRunMetadata(path, duration, "Just now");
  } catch (err: any) {
    let errMsg = err.message || "Unknown error";
    if (err.isWorkerError && err.stack) {
      const match =
        err.stack.match(/<anonymous>:(\d+):(\d+)/) ||
        err.stack.match(/eval:(\d+):(\d+)/);
      if (match) {
        const line = Math.max(1, parseInt(match[1]) - 3);
        errMsg = `${errMsg}\n\n    at js:${line}:${match[2]} [Ln ${line}]`;
      }
    }
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    store.setJsNodeRunMetadata(path, duration, "Just now");
    setJsNodeError(path, errMsg);
  } finally {
    setJsNodeLoading(path, false);
  }
};
