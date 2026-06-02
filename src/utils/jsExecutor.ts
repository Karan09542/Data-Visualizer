import { useStore } from '../store/useStore';
import lodashGet from 'lodash.get';
import { appendLogs, resetNodeSession, abortExecutionQueue } from './executionStore';

export const activeWorkers: Record<string, Worker> = {};
export const activeRejectors: Record<string, (reason?: any) => void> = {};

export const abortJsNode = (path: string) => { abortExecutionQueue(path);
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
    const startTime = performance.now();
    const store = useStore.getState();
    const { parsedData, setJsNodeLoading, setJsNodeError, setJsNodeResponse, setJsNodeLogs } = store;

    // Extract input data (parent object without this js_node)
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
    
    try {
      const sessionId = Date.now().toString() + Math.random().toString(36).substring(7);
      if (store.autoClearLogs) {
          await resetNodeSession(path, sessionId);
      }

       const workerCode = `
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
               
               flushInterval = setInterval(flushLogs, 50);
               
               const addLog = (type, args) => {
                   const safeArgs = args.map(a => {
                       if (typeof a === 'function') return '[Function]';
                       if (a instanceof Error) return a.toString();
                       return a;
                   });
                   const pos = (type === 'error' || type === 'warn') ? getPos() : undefined;
                   logBatch.push({ type, args: safeArgs, pos, time: getTime() });
                   if (logBatch.length >= 5000) flushLogs();
               };
               
               const customConsole = {
                   log: (...args) => addLog('log', args),
                   warn: (...args) => addLog('warn', args),
                   error: (...args) => addLog('error', args),
                   clear: () => { addLog('clear', []); flushLogs(); },
                   info: (...args) => addLog('log', args)
               };

               const executionFunc = new Function('input', 'console', "return (async () => {\\n" + code + "\\n})();");
               
               const result = await executionFunc(input, customConsole);
               clearInterval(flushInterval);
               flushLogs();
               self.postMessage({ success: true, result });
            } catch (error) {
               if (flushInterval) clearInterval(flushInterval);
               try { if (typeof flushLogs === "function") flushLogs(); } catch(e) {}
               let eMsg = "Unknown Error";
               let eStack = undefined;
               try { eMsg = error ? String(error.message || error) : "Unknown Error"; } catch(e) {}
               try { eStack = error ? String(error.stack) : undefined; } catch(e) {}
               self.postMessage({ success: false, error: eMsg, stack: eStack });
            }
         }
       `.replace(/\\`/g, '`').replace(/\\\$/g, '$');

       const blob = new Blob([workerCode], { type: 'application/javascript' });
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
             if (e.data.type === 'logs') {
                 await appendLogs(path, e.data.logs);
                 return;
             }

             hasFinished = true;
             if (e.data.success) {
                resolve(e.data);
             } else {
                reject({ message: e.data.error || "Execution failed", stack: e.data.stack, isWorkerError: true });
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
               reject(new Error(`Execution Timeout: Script ran longer than ${timeoutMs}ms.`));
             }
          }, timeoutMs);

          worker.postMessage({ code: codeToRun, input: inputData });
       });

       const response: any = await executionPromise;
       
       const endTime = performance.now();
       const duration = Math.round(endTime - startTime);
       setJsNodeResponse(path, response.result);
       store.setJsNodeRunMetadata(path, duration, "Just now");
       
    } catch (err: any) {
       let errMsg = err.message || "Unknown error";
       if (err.isWorkerError && err.stack) {
           const match = err.stack.match(/<anonymous>:(\d+):(\d+)/) || err.stack.match(/eval:(\d+):(\d+)/);
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
