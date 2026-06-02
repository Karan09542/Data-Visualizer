import { useStore } from '../store/useStore';
import lodashGet from 'lodash.get';
import { appendLogs, resetNodeSession, abortExecutionQueue } from './executionStore';

export const activePyWorkers: Record<string, Worker> = {};
export const activePyRejectors: Record<string, (reason?: any) => void> = {};
export const activePyResolvers: Record<string, (value?: any) => void> = {};

export const abortPyNode = (path: string) => { 
    abortExecutionQueue(path);
    if (activePyWorkers[path]) {
        activePyWorkers[path].terminate();
        delete activePyWorkers[path];
    }
    if (activePyRejectors[path]) {
        activePyRejectors[path](new Error("Execution aborted by user"));
        delete activePyRejectors[path];
        delete activePyResolvers[path];
    }
};

export const executePyNode = async (path: string, codeToRun: string) => {
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
    
    try {
      const sessionId = Date.now().toString() + Math.random().toString(36).substring(7);
      if (store.autoClearLogs) {
          await resetNodeSession(path, sessionId);
      }

      let worker = activePyWorkers[path];
      if (!worker) {
          worker = new Worker(new URL('./pyWorker.ts', import.meta.url), { type: 'module' });
          activePyWorkers[path] = worker;
      }

      const timeoutMs = 60000;
      
      const executionPromise = new Promise((resolve, reject) => {
         activePyRejectors[path] = reject;
         activePyResolvers[path] = resolve;
         
         const executionId = Math.random().toString(36).substring(7);
         
         const timeoutId = setTimeout(() => {
            if (activePyWorkers[path] === worker) {
               worker.terminate();
               delete activePyWorkers[path];
               reject(new Error(`Execution Timeout: Script ran longer than ${timeoutMs}ms.`));
               delete activePyResolvers[path];
               delete activePyRejectors[path];
            }
         }, timeoutMs);

         worker.onmessage = async (e) => {
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
                clearTimeout(timeoutId);
                if (e.data.success) {
                   resolve(e.data);
                } else {
                   reject(new Error(e.data.error || "Execution failed"));
                }
                
                delete activePyResolvers[path];
                delete activePyRejectors[path];
            }
         };

         worker.onerror = (e) => {
            e.preventDefault();
            clearTimeout(timeoutId);
            reject(new Error(e.message));
            worker.terminate();
            delete activePyWorkers[path];
            delete activePyResolvers[path];
            delete activePyRejectors[path];
         };

         worker.postMessage({ code: codeToRun, input: inputData, id: executionId });
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
       setJsNodeLoading(path, false);
    }
};
