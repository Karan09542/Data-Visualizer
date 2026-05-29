import { useState, useEffect, useRef } from 'react';
import { FileText, Database, ArrowRight, X, AlertCircle, FileJson, Table2, Layers, AlertTriangle, Key, Sparkles, Hash } from 'lucide-react';
import { useStore } from '../store/useStore';
import { parseCsv } from '../utils/dataFormats';

export function ImportModal() {
  const { pendingImport, setPendingImport, parsedData } = useStore();
  
  const [importMode, setImportMode] = useState<'raw' | 'array' | 'object' | 'replace'>('raw');
  const [keyStrategy, setKeyStrategy] = useState<'filename' | 'intelligent' | 'custom'>('filename');
  const [customKey, setCustomKey] = useState('');
  const [collisionAction, setCollisionAction] = useState<'rename' | 'merge' | 'replace_key'>('rename');
  
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  
  const customKeyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingImport) return;
    
    // Auto-detect mode and gather metadata
    if (pendingImport.filename.endsWith('.csv')) {
       try {
           const parsed = parseCsv(pendingImport.text);
           if (parsed && parsed.length > 0) {
               setRowCount(parsed.length);
               setDetectedHeaders(Object.keys(parsed[0] || {}));
               if (typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) {
                   setImportMode('object');
               } else {
                   setImportMode('array');
               }
           }
       } catch(e) {
           setImportMode('raw');
       }
    } else {
        setImportMode('raw');
    }
  }, [pendingImport]);

  useEffect(() => {
    if (keyStrategy === 'custom' && customKeyInputRef.current) {
      customKeyInputRef.current.focus();
    }
  }, [keyStrategy]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingImport(null);
      if (e.key === 'Enter' && e.ctrlKey) applyImport(); // Ctrl+Enter to apply
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingImport, importMode, keyStrategy, customKey, collisionAction]);

  if (!pendingImport) return null;

  const baseKeyName = pendingImport.filename.replace(/\.[^/.]+$/, "").replace(/\W+/g, '_');
  const intelligentKeyName = baseKeyName + '_data';
  
  const targetKey = keyStrategy === 'filename' ? baseKeyName 
                  : keyStrategy === 'intelligent' ? intelligentKeyName
                  : customKey || 'imported_data';

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const applyImport = () => {
    if (!pendingImport) return;
    
    let resultData: any = pendingImport.text;
    if (importMode === 'replace') {
       if (pendingImport.filename.endsWith('.csv')) {
          resultData = parseCsv(pendingImport.text);
       } else if (pendingImport.dataExcel) {
          resultData = pendingImport.dataExcel;
       } else {
          try {
              resultData = JSON.parse(pendingImport.text);
          } catch(e) {
              resultData = pendingImport.text;
          }
       }
       useStore.getState().setCode(typeof resultData === 'string' ? resultData : JSON.stringify(resultData, null, 2));
       if (typeof resultData === 'object') {
          useStore.getState().setCodeFormat('json');
       }
       setPendingImport(null);
       return;
    }
    
    // Process content for other modes
    if (importMode === 'raw') {
        resultData = pendingImport.text;
    } else if (importMode === 'array') {
        if (pendingImport.filename.endsWith('.csv')) {
            const lines = pendingImport.text.trim().split('\n').map(l => l.split(','));
            resultData = lines;
        } else {
            resultData = pendingImport.text;
        }
    } else if (importMode === 'object') {
        if (pendingImport.filename.endsWith('.csv')) {
            resultData = parseCsv(pendingImport.text);
        } else if (pendingImport.dataExcel) {
            resultData = pendingImport.dataExcel;
        } else {
            try {
                resultData = JSON.parse(pendingImport.text);
            } catch(e) {
                resultData = pendingImport.text;
            }
        }
    }
    
    const currentData = parsedData || {};
    let actualKey = targetKey;
    let finalData = currentData;
    
    if (typeof currentData === 'object' && !Array.isArray(currentData) && currentData !== null) {
        if (actualKey in currentData) {
            if (collisionAction === 'rename') {
                let counter = 2;
                while (`${targetKey}_${counter}` in currentData) {
                    counter++;
                }
                actualKey = `${targetKey}_${counter}`;
                finalData = { ...currentData, [actualKey]: resultData };
            } else if (collisionAction === 'replace_key') {
                finalData = { ...currentData, [actualKey]: resultData };
            } else if (collisionAction === 'merge') {
                const existingVal = currentData[actualKey];
                if (Array.isArray(existingVal) && Array.isArray(resultData)) {
                    finalData = { ...currentData, [actualKey]: [...existingVal, ...resultData] };
                } else if (typeof existingVal === 'object' && existingVal !== null && typeof resultData === 'object' && !Array.isArray(resultData)) {
                    finalData = { ...currentData, [actualKey]: { ...existingVal, ...resultData } };
                } else {
                    finalData = { ...currentData, [actualKey]: resultData };
                }
            }
        } else {
             finalData = { ...currentData, [actualKey]: resultData };
        }
    } else {
       finalData = { [actualKey]: resultData };
    }
    
    useStore.getState().setCode(JSON.stringify(finalData, null, 2));
    useStore.getState().setCodeFormat('json');
    setPendingImport(null);
  };
  
  const currentDataCheck = parsedData || {};
  const isCollision = importMode !== 'replace' && 
                      typeof currentDataCheck === 'object' && 
                      !Array.isArray(currentDataCheck) && 
                      currentDataCheck !== null && 
                      targetKey in currentDataCheck;

  const fileSize = formatBytes(pendingImport.text.length || 0);

  return (
    <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-[#0d1117] rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1117]">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
               <Database className="text-indigo-500" size={24} />
               Import Data
            </h2>
            <button 
                onClick={() => setPendingImport(null)}
                className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors p-2 rounded-lg"
            >
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-slate-50/50 dark:bg-[#0d1117]/50">
            {/* File Context Card */}
            <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{pendingImport.filename}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                        <span>{fileSize}</span>
                        {rowCount > 0 && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <span>{rowCount} rows</span>
                            </>
                        )}
                        {detectedHeaders.length > 0 && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <span>{detectedHeaders.length} columns</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 1: Mode Selection */}
            <div className="flex flex-col gap-4">
               <div>
                 <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">1. Interpretation Mode</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose how to interpret the contents of this file.</p>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div 
                   onClick={() => setImportMode('raw')}
                   className={`relative p-4 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                     importMode === 'raw' 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,1)]' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm hover:shadow'
                   }`}
                 >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-medium">
                            <FileJson size={18} />
                            Raw Text
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${importMode === 'raw' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 dark:border-slate-700'}`}>
                            {importMode === 'raw' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Preserve original text content exactly as is</div>
                 </div>

                 {pendingImport.filename.endsWith('.csv') && (
                   <>
                     <div 
                       onClick={() => setImportMode('array')}
                       className={`relative p-4 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                         importMode === 'array' 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,1)]' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm hover:shadow'
                       }`}
                     >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                                <Table2 size={18} />
                                Table Rows
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${importMode === 'array' ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-700'}`}>
                                {importMode === 'array' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Convert into a 2D array of raw cell values</div>
                     </div>
                     
                     <div 
                       onClick={() => setImportMode('object')}
                       className={`relative p-4 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                         importMode === 'object' 
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,1)]' 
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-sm hover:shadow'
                       }`}
                     >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                                <Layers size={18} />
                                Structured Objects
                                {detectedHeaders.length > 0 && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 tracking-wide uppercase">
                                        Recommended
                                    </span>
                                )}
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${importMode === 'object' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-700'}`}>
                                {importMode === 'object' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Use detected headers to build objects</div>
                     </div>
                   </>
                 )}

                 <div 
                   onClick={() => setImportMode('replace')}
                   className={`relative p-4 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                     importMode === 'replace' 
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,1)]' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-700 shadow-sm hover:shadow'
                   }`}
                 >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                            <AlertTriangle size={18} />
                            Replace All
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${importMode === 'replace' ? 'border-amber-500 bg-amber-500' : 'border-slate-300 dark:border-slate-700'}`}>
                            {importMode === 'replace' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                    </div>
                    <div className="text-sm text-amber-600/80 dark:text-amber-500/80 mt-1">Completely overwrite current editor data</div>
                 </div>
               </div>
            </div>

            {/* Step 2: Destination Selection */}
            {importMode !== 'replace' && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                   <div>
                     <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">2. Destination</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose where this data should be mounted.</p>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                       <div 
                           onClick={() => setKeyStrategy('filename')}
                           className={`p-3 rounded-xl border cursor-pointer flex flex-col transition-all ${
                               keyStrategy === 'filename'
                                   ? 'border-slate-800 dark:border-slate-200 bg-slate-50 dark:bg-slate-800/50 shadow'
                                   : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 shadow-sm'
                           }`}
                       >
                           <div className="flex items-center gap-2 font-medium text-sm text-slate-800 dark:text-slate-200 mb-1">
                               <FileText size={16} className="text-slate-400" />
                               File Name
                           </div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 p-1.5 rounded px-2 truncate">
                               "{baseKeyName}"
                           </div>
                       </div>

                       <div 
                           onClick={() => setKeyStrategy('intelligent')}
                           className={`p-3 rounded-xl border cursor-pointer flex flex-col transition-all ${
                               keyStrategy === 'intelligent'
                                   ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,1)]'
                                   : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-sm'
                           }`}
                       >
                           <div className="flex items-center gap-2 font-medium text-sm text-slate-800 dark:text-slate-200 mb-1">
                               <Sparkles size={16} className="text-indigo-500" />
                               Smart Name
                           </div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-indigo-100 dark:bg-indigo-500/20 p-1.5 rounded px-2 truncate">
                               "{intelligentKeyName}"
                           </div>
                       </div>

                       <div 
                           onClick={() => setKeyStrategy('custom')}
                           className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-2 transition-all ${
                               keyStrategy === 'custom'
                                   ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,1)]'
                                   : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm'
                           }`}
                       >
                           <div className="flex items-center gap-2 font-medium text-sm text-slate-800 dark:text-slate-200">
                               <Key size={16} className={keyStrategy === 'custom' ? 'text-blue-500' : 'text-slate-400'} />
                               Custom Key
                           </div>
                           {keyStrategy !== 'custom' && (
                               <div className="text-xs text-slate-500 dark:text-slate-400 mt-auto">
                                   Choose your own
                               </div>
                           )}
                           {keyStrategy === 'custom' && (
                               <input 
                                 ref={customKeyInputRef}
                                 type="text" 
                                 value={customKey}
                                 onChange={e => setCustomKey(e.target.value)}
                                 onClick={e => e.stopPropagation()}
                                 placeholder="Enter key name..."
                                 className="w-full text-sm font-mono border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                               />
                           )}
                       </div>
                   </div>

                   {/* Collision Handling Sub-Section */}
                   {isCollision && (
                       <div className="mt-2 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 animate-in fade-in slide-in-from-top-2 duration-300">
                           <div className="flex items-start gap-3">
                               <div className="p-1.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 mt-0.5">
                                   <AlertCircle size={16} />
                               </div>
                               <div className="flex-1">
                                   <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Key collision detected</h4>
                                   <p className="text-sm text-red-600 dark:text-red-400/80 mt-1 mb-3">
                                       The key <span className="font-mono bg-red-100/50 dark:bg-red-900/40 px-1 rounded">"{targetKey}"</span> already exists in your data.
                                   </p>
                                   <div className="flex flex-wrap gap-2">
                                       <button 
                                           onClick={() => setCollisionAction('rename')}
                                           className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border ${collisionAction === 'rename' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                                       >
                                           Auto-Rename
                                       </button>
                                       <button 
                                           onClick={() => setCollisionAction('merge')}
                                           className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border ${collisionAction === 'merge' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                                       >
                                           Merge Data
                                       </button>
                                       <button 
                                           onClick={() => setCollisionAction('replace_key')}
                                           className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border ${collisionAction === 'replace_key' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30'}`}
                                       >
                                           Replace existing key
                                       </button>
                                   </div>
                               </div>
                           </div>
                       </div>
                   )}
                </div>
            )}
        </div>

        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1117] flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <button 
             onClick={() => setPendingImport(null)}
             className="px-4 py-2 rounded-lg font-medium text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
             Cancel
          </button>
          <button 
             onClick={applyImport}
             className="px-5 py-2 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98] flex items-center gap-2"
          >
             Import Data <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
