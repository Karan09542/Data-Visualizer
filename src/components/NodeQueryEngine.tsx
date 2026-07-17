import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { Search, Database, Command, Code2, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, X, Info, Settings, RefreshCw, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NodeQueryEngineHelpModal = lazy(() => import('./NodeQueryEngineHelpModal'));

export default function NodeQueryEngine() {
  const { searchQuery, setSearchQuery, searchMatches, activeMatchIndex, treeData, appTheme, setIsAdvancedPanelOpen, searchEngineMode, globalSearchErrors, globalSearchSuggestions } = useStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hasLoadedHelp, setHasLoadedHelp] = useState(false);

  useEffect(() => {
    if (showHelp) setHasLoadedHelp(true);
  }, [showHelp]);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastSubmittedQuery = useRef<string | null>(null);

  // Initial sync and external reset sync
  useEffect(() => {
    if (searchQuery === '' && localSearch !== '') {
        setLocalSearch('');
    }
  }, [searchQuery]);

  // Debounced search logic with basic validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== lastSubmittedQuery.current) {
        lastSubmittedQuery.current = localSearch;
        setSearchQuery(localSearch);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // Keyboard shortcut to focus (Ctrl/Cmd + F or Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'k')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalMatches = searchMatches.size;
  const hasQuery = localSearch.trim().length > 0;

  return (
    <>
      <div 
        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto w-[90%] max-w-xl node-query-engine no-export"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
          <motion.div
              initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`shadow-md rounded-lg overflow-hidden backdrop-blur-md border transition-all duration-300 ${
                isFocused 
                    ? appTheme === 'dark' ? 'bg-[#0d1117] border-blue-500/50 shadow-blue-500/10' : 'bg-white border-blue-400 shadow-blue-500/10'
                    : appTheme === 'dark' ? 'bg-[#0d1117]/90 border-slate-800' : 'bg-white/90 border-slate-300'
            }`}
        >
            <div className="flex items-center px-3 py-2 gap-2.5">
                <Search size={16} className={isFocused ? 'text-blue-500' : 'text-slate-400'} />
                
                <input
                    ref={inputRef}
                    type="text"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            if (e.shiftKey) {
                                useStore.getState().prevMatch();
                            } else {
                                useStore.getState().nextMatch();
                            }
                        }
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder='Query nodes (e.g. type:"array", depth>3, { type: { $eq: "string" } })...'
                    className={`flex-1 bg-transparent border-none outline-none font-mono text-[13px] sm:text-sm placeholder-slate-400 dark:placeholder-slate-500 ${
                        appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                    } ${globalSearchErrors.length > 0 ? 'text-red-500 dark:text-red-400' : ''}`}
                    autoComplete="off"
                    spellCheck="false"
                />

                <AnimatePresence>
                    {hasQuery && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center"
                        >
                            <button
                                onClick={(e) => { e.preventDefault(); useStore.getState().prevMatch(); }}
                                className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); useStore.getState().nextMatch(); }}
                                className="p-1 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors mr-1"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                            <button
                                onClick={() => setLocalSearch('')}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors mx-1"
                            >
                                <X size={14} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
                
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('refetch-all-api-nodes'))}
                        className="p-1.5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400"
                        title="Refetch All APIs"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => setShowHelp(true)}
                        className="p-1.5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                        title="Search Help"
                    >
                        <Info size={16} />
                    </button>
                    <button
                        onClick={() => setIsAdvancedPanelOpen(true)}
                        className="p-1.5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                        title="Open Details & Settings"
                    >
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {/* Results bar overlay - expands when focused or has query */}
            <AnimatePresence>
                {(isFocused || hasQuery) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className={`border-t flex items-center justify-between text-xs px-4 py-2 overflow-hidden ${
                            appTheme === 'dark' ? 'border-slate-800 bg-[#0d1117]' : 'border-slate-200 bg-slate-50'
                        }`}
                    >
                        <div className="flex flex-col gap-1 w-full max-w-[70%]">
                            {globalSearchErrors.length === 0 ? (
                                hasQuery ? (
                                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 size={13} />
                                        <span>
                                            {totalMatches} match{totalMatches !== 1 && 'es'} found
                                            {totalMatches > 0 && activeMatchIndex !== null && (
                                                <span className="ml-1 opacity-75">
                                                    ({activeMatchIndex + 1}/{totalMatches})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <Command size={12} /> 
                                        <span>AST Query Engine</span>
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col gap-1 text-red-500 dark:text-red-400">
                                    <div className="flex items-center gap-1.5">
                                        <AlertCircle size={13} className="shrink-0" />
                                        <span className="truncate">{globalSearchErrors[0]}</span>
                                    </div>
                                </div>
                            )}
                            {globalSearchSuggestions.length > 0 && (
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate ml-5">
                                    {globalSearchSuggestions[0]}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 items-center shrink-0">
                            <button
                                onClick={() => useStore.getState().setSearchEngineMode(searchEngineMode === 'strict' ? 'permissive' : 'strict')}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                    searchEngineMode === 'strict' 
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent'
                                }`}
                                title="Strict mode prevents auto-correcting invalid paths (like array access without [])"
                            >
                                {searchEngineMode === 'strict' ? 'STRICT MODE' : 'PERMISSIVE'}
                            </button>
                            <span className="text-slate-400 flex items-center gap-1">
                                <Code2 size={12} /> AST Engine active
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
        
        {/* Suggestion Dropdown */}
        <AnimatePresence>
            {isFocused && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className={`mt-2 rounded-lg shadow-lg border overflow-hidden absolute w-full ${
                        appTheme === 'dark' ? 'bg-[#0d1117]/95 backdrop-blur-md border-slate-800 text-slate-300' : 'bg-white/95 backdrop-blur-md border-slate-300 text-slate-700'
                    }`}
                >
                    <div className="px-3 py-2 text-[10px] font-bold tracking-wider uppercase opacity-50 border-b border-inherit">
                        {hasQuery ? (globalSearchErrors.length === 0 ? 'Query Suggestions' : 'Query Errors') : 'Query Examples'}
                    </div>
                    {hasQuery && globalSearchErrors.length > 0 ? (
                        <div className="px-4 py-3 text-sm flex gap-2 items-start text-red-500 dark:text-red-400">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium">Syntax Error</p>
                                <p className="text-xs opacity-80 mt-1">{globalSearchErrors[0]}</p>
                            </div>
                        </div>
                    ) : (
                        <ul className="text-sm font-mono max-h-64 overflow-y-auto">
                            {!hasQuery && (
                                <>
                                <li className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-inherit border-opacity-30 flex items-center justify-between group" onMouseDown={() => setLocalSearch('type:"array"')}>
                                    <div><span className="text-indigo-500 dark:text-indigo-400 font-medium">type:</span>"array"</div>
                                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                                </li>
                                <li className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-inherit border-opacity-30 flex items-center justify-between group" onMouseDown={() => setLocalSearch('childrenCount>3')}>
                                    <div><span className="text-emerald-500 dark:text-emerald-400 font-medium">childrenCount</span> &gt; 3</div>
                                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                                </li>
                                <li className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-inherit border-opacity-30 flex items-center justify-between group" onMouseDown={() => setLocalSearch('depth:0')}>
                                    <div><span className="text-amber-500 dark:text-amber-400 font-medium">depth:</span>0</div>
                                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                                </li>
                                <li className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-inherit border-opacity-30 flex items-center justify-between group" onMouseDown={() => setLocalSearch('{ type: { $eq: "string" } }')}>
                                    <div>{`{ type: { $eq: "string" } }`}</div>
                                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                                </li>
                                </>
                            )}
                            {hasQuery && globalSearchErrors.length === 0 && (
                                <>
                                    <li className="px-4 py-2 opacity-50 cursor-default text-xs flex items-center gap-2">
                                        <Command size={12} /> Graph is automatically focusing on matches
                                    </li>
                                </>
                            )}
                        </ul>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Help Modal */}
      {hasLoadedHelp && (
        <Suspense fallback={null}>
            <NodeQueryEngineHelpModal showHelp={showHelp} setShowHelp={setShowHelp} appTheme={appTheme} />
        </Suspense>
      )}
    </>
  );
}
