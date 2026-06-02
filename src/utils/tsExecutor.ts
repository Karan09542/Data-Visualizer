import { useStore } from '../store/useStore';
import lodashGet from 'lodash.get';
import { transform } from 'sucrase';
import { appendLogs, resetNodeSession, abortExecutionQueue } from './executionStore';

export const activeWorkers: Record<string, Worker> = {};
export const activeRejectors: Record<string, (reason?: any) => void> = {};

export const abortTsNode = (path: string) => { abortExecutionQueue(path);
    if (activeWorkers[path]) {
        activeWorkers[path].terminate();
        delete activeWorkers[path];
    }
    if (activeRejectors[path]) {
        activeRejectors[path](new Error("Execution aborted by user"));
        delete activeRejectors[path];
    }
};

export const executeTsNode = async (path: string, codeToRun: string, monacoInstance?: any) => {
    const store = useStore.getState();
    const { parsedData, setJsNodeLoading, setJsNodeError, setJsNodeResponse, setJsNodeLogs } = store;

    // Extract input data (parent object without this ts_node)
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

        // Type Check Phase using Monaco Language Service
        const monaco = monacoInstance || (window as any).monaco;
        let typeErrors: string[] = [];

        if (monaco) {
            try {
                const models = monaco.editor.getModels();
                // Find a typescript model corresponding to this code or path
                const tsModel = models.find((m: any) => {
                    if (m.getLanguageId() !== 'typescript') return false;
                    const modelVal = m.getValue().trim();
                    const targetVal = codeToRun.trim();
                    return modelVal === targetVal || modelVal.includes(targetVal) || targetVal.includes(modelVal) || m.uri.toString().includes(path);
                });

                if (tsModel) {
                    try {
                        const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
                        const worker = await getWorker(tsModel.uri);
                        const syntactic = await worker.getSyntacticDiagnostics(tsModel.uri.toString());
                        const semantic = await worker.getSemanticDiagnostics(tsModel.uri.toString());

                        [...syntactic, ...semantic].forEach((diag: any) => {
                            if (diag.code === 2451 || diag.code === 2300) return; // Ignore global scope clashes
                            const start = diag.start || 0;
                            const position = tsModel.getPositionAt(start);
                            const line = position ? position.lineNumber : 1;
                            const col = position ? position.column : 1;
                            let messageText = diag.messageText;
                            if (typeof messageText === 'object' && messageText !== null) {
                                messageText = messageText.messageText || JSON.stringify(messageText);
                            }
                            typeErrors.push(`TS${diag.code || 'Error'}: ${messageText} (Line ${line}, Col ${col})`);
                        });
                    } catch (diagErr) {
                        console.warn("Direct TS Worker diagnostics failed, falling back to editor markers", diagErr);
                        const markers = monaco.editor.getModelMarkers({ resource: tsModel.uri });
                        const errorMarkers = markers.filter((m: any) => m.severity === 8 && m.code !== "2451" && m.code !== "2300" && m.code !== 2451 && m.code !== 2300); // MarkerSeverity.Error is 8
                        if (errorMarkers.length > 0) {
                            typeErrors = errorMarkers.map((m: any) => 
                                `TS${m.code || 'Error'}: ${m.message} (Line ${m.startLineNumber}, Col ${m.startColumn})`
                            );
                        }
                    }
                }
            } catch (monacoErr) {
                console.warn("Monaco diagnostics check failed", monacoErr);
            }
        }

        if (typeErrors.length > 0) {
            const errText = `TypeScript Type Compilation Failed:\n\n${typeErrors.join('\n')}`;
            setJsNodeError(path, errText);
            setJsNodeLoading(path, false);
            return;
        }

        // Transpilation Phase (TypeScript -> JavaScript via Sucrase)
        let compiledJs = '';
        try {
            compiledJs = transform(codeToRun, { transforms: ['typescript'] }).code;
        } catch (compileErr: any) {
            throw new Error(`Compilation Failed: ${compileErr.message}`);
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

           worker.postMessage({ code: compiledJs, input: inputData });
        });

        const response: any = await executionPromise;
        
        setJsNodeResponse(path, response.result);
        
    } catch (err: any) {
        let errMsg = err.message || "Unknown error";
        if (err.isWorkerError && err.stack) {
            const match = err.stack.match(/<anonymous>:(\d+):(\d+)/) || err.stack.match(/eval:(\d+):(\d+)/);
            if (match) {
                const line = Math.max(1, parseInt(match[1]) - 3);
                errMsg = `${errMsg}\n\n    at ts:${line}:${match[2]} [Ln ${line}]`;
            }
        }
        setJsNodeError(path, errMsg);
    } finally {
        setJsNodeLoading(path, false);
    }
};

export function generateTypeScriptSchema(val: any, interfaceName: string = "Input"): { types: string; entry: string } {
  if (val === undefined || val === null) {
    return { types: `interface ${interfaceName} {}`, entry: `declare const input: ${interfaceName};` };
  }
  
  const customTypes: string[] = [];

  function walk(currentVal: any, name: string): string {
    if (currentVal === null) return "any";
    if (Array.isArray(currentVal)) {
      if (currentVal.length === 0) return "any[]";
      const elemType = walk(currentVal[0], name + "Item");
      return `${elemType}[]`;
    }
    if (typeof currentVal === "object") {
      const fields: string[] = [];
      for (const [key, v] of Object.entries(currentVal)) {
        const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        const childTypeName = name + key.charAt(0).toUpperCase() + key.slice(1);
        const t = walk(v, childTypeName);
        fields.push(`  ${propName}: ${t};`);
      }
      const typeStr = `interface ${name} {\n${fields.join("\n")}\n}`;
      customTypes.push(typeStr);
      return name;
    }
    return typeof currentVal;
  }

  const rootType = walk(val, interfaceName);
  
  let finalTypes = customTypes.join("\n\n");
  if (rootType !== interfaceName) {
    finalTypes = `type ${interfaceName} = ${rootType};\n\n` + finalTypes;
  }
  
  return {
    types: finalTypes,
    entry: `declare const input: ${interfaceName};`
  };
}
