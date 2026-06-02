import { loadPyodide } from 'pyodide';

let pyodide: any = null;
let currentFlushInterval: any = null;
let activeAddLog: ((logType: string, args: any[]) => void) | null = null;
let currentSessionId: string = "";

self.addEventListener('error', (e) => {
    e.preventDefault();
    self.postMessage({ type: 'finish', success: false, error: e.message || 'Worker global error' });
});

self.addEventListener('unhandledrejection', (e) => {
    e.preventDefault();
    let msg = 'Worker unhandled rejection';
    try { msg = e.reason ? String(e.reason.message || e.reason) : msg; } catch(err){}
    self.postMessage({ type: 'finish', success: false, error: msg });
});

self.onmessage = async (e) => {
    const { code, input, id } = e.data;
    currentSessionId = id || "";
    
    // Support clear logs if a command requests it
    if (e.data.type === 'clear') {
        return;
    }
    
    let flushLogs = () => {};
    
    try {
        const getTime = () => {
            const d = new Date();
            return d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0') + ':' + d.getUTCSeconds().toString().padStart(2, '0') + '.' + d.getUTCMilliseconds().toString().padStart(3, '0');
        };
        
        let logBatch: any[] = [];
        flushLogs = () => {
            try {
                if (logBatch.length > 0) {
                    self.postMessage({ type: 'logs', logs: logBatch });
                    logBatch = [];
                }
            } catch (err: any) {
                logBatch = [{ type: 'error', args: ['Log Serialization Error: ' + err.message], time: getTime() }];
                try { self.postMessage({ type: 'logs', logs: logBatch }); } catch(err2) {}
                logBatch = [];
            }
        };
        
        if (currentFlushInterval) clearInterval(currentFlushInterval);
        currentFlushInterval = setInterval(flushLogs, 50);
        
        const addLog = (logType: string, args: any[]) => {
            const safeArgs = args.map(a => {
                if (typeof a === 'function') return '[Function]';
                if (a instanceof Error) return a.toString();
                return a;
            });
            logBatch.push({ type: logType, args: safeArgs, time: getTime() });
            if (logBatch.length >= 5000) flushLogs();
        };

        activeAddLog = addLog;

        if (!pyodide) {
            pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/npm/pyodide@0.29.4/'
            });
            pyodide.setStdout({ batched: (msg: any) => {
                if (activeAddLog) {
                    activeAddLog('log', [msg]);
                }
            }});
            pyodide.setStderr({ batched: (msg: any) => {
                if (activeAddLog) {
                    activeAddLog('error', [msg]);
                }
            }});
            pyodide.setStdin({
                stdin: () => {
                    // Send message to main thread
                    self.postMessage({
                        type: 'need_prompt',
                        sessionId: currentSessionId,
                        promptText: "Python input requested",
                        promptType: "input"
                    });
                    
                    // Do synchronous XHR to block the Web Worker thread until the user enters their info
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', `${self.location.origin}/api/stdin-get?sessionId=${currentSessionId}`, false);
                    xhr.send();
                    
                    if (xhr.status === 200) {
                        try {
                            const res = JSON.parse(xhr.responseText);
                            const val = (res.value !== null && res.value !== undefined) ? String(res.value) : "";
                            // Echo user's typed value to stdout for a realistic terminal feel
                            if (activeAddLog) {
                                activeAddLog('log', [val]);
                            }
                            return val + "\n";
                        } catch (err) {
                            console.error("Error parsing stdin result", err);
                        }
                    }
                    return "\n";
                }
            });
        }
        
        pyodide.globals.set('input_data', input || {});

        const result = await pyodide.runPythonAsync(code);
        
        let finalResult = result;
        if (result && typeof result.toJs === 'function') {
            finalResult = result.toJs({ dict_converter: Object.fromEntries });
        }
        
        if (currentFlushInterval) clearInterval(currentFlushInterval);
        flushLogs();
        
        self.postMessage({ type: 'finish', id, success: true, result: finalResult });
    } catch (error: any) {
        if (currentFlushInterval) clearInterval(currentFlushInterval);
        try { if (typeof flushLogs === "function") flushLogs(); } catch(e) {}
        
        let eMsg = error ? String(error.message || error) : "Unknown Error";
        self.postMessage({ type: 'finish', id, success: false, error: eMsg });
    }
};
