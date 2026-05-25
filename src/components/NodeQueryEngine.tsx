import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { Search, Database, Command, Code2, AlertCircle, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseSearchQuery } from '../utils/searchEngine';

export default function NodeQueryEngine() {
  const { searchQuery, setSearchQuery, searchMatches, treeData, appTheme, setIsAdvancedPanelOpen, searchEngineMode, globalSearchErrors, globalSearchSuggestions } = useStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external search query
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounced search logic with basic validation
  useEffect(() => {
    const timer = setTimeout(() => {
        setSearchQuery(localSearch);
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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto w-[90%] max-w-xl">
          <motion.div
              layout
              initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`shadow-2xl rounded-2xl overflow-hidden backdrop-blur-xl border transition-all duration-300 ${
                isFocused 
                    ? appTheme === 'dark' ? 'bg-[#0d1117]/95 border-indigo-500/50 shadow-indigo-500/20' : 'bg-white/95 border-indigo-400 shadow-indigo-500/20'
                    : appTheme === 'dark' ? 'bg-[#161b22]/80 border-slate-700' : 'bg-white/80 border-slate-300'
            }`}
        >
            <div className="flex items-center px-4 py-3 gap-3">
                <Search size={18} className={isFocused ? 'text-indigo-500' : 'text-slate-400'} />
                
                <input
                    ref={inputRef}
                    type="text"
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
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
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={() => setLocalSearch('')}
                            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors mr-1"
                        >
                            <X size={14} />
                        </motion.button>
                    )}
                </AnimatePresence>

                <div className="h-5 w-[1px] bg-slate-300 dark:bg-slate-700"></div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowHelp(true)}
                        className="p-1 px-2 flex items-center gap-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs text-slate-600 dark:text-slate-300 font-medium"
                        title="Search Help"
                    >
                        <Info size={12} />
                        <span className="hidden sm:inline">Help</span>
                    </button>
                    <button
                        onClick={() => setIsAdvancedPanelOpen(true)}
                        className="p-1 px-2 flex items-center gap-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs text-slate-600 dark:text-slate-300 font-medium"
                        title="Open Details & Settings"
                    >
                        <Database size={12} />
                        <span className="hidden sm:inline">Settings</span>
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
                                        <span>{totalMatches} match{totalMatches !== 1 && 'es'} found</span>
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
                    className={`mt-2 rounded-xl shadow-2xl border overflow-hidden absolute w-full ${
                        appTheme === 'dark' ? 'bg-[#161b22]/95 backdrop-blur-xl border-slate-700 text-slate-300' : 'bg-white/95 backdrop-blur-xl border-slate-200 text-slate-700'
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
      {createPortal(
          <AnimatePresence>
              {showHelp && (
                  <div 
                      className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto p-4"
                      onWheel={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                  >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
                            onClick={() => setShowHelp(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className={`relative w-full max-w-md md:max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
                                appTheme === 'dark' ? 'bg-[#0d1117] border border-slate-800' : 'bg-white border border-slate-200'
                            }`}
                        >
                            <div className={`px-4 py-3 border-b flex justify-between items-center ${appTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                                <h2 className={`font-semibold text-sm flex items-center gap-2 ${appTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                    <Command size={16} className="text-indigo-500" />
                                    Search & Query Guide
                                </h2>
                                <button
                                    onClick={() => setShowHelp(false)}
                                    className={`p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className={`p-5 overflow-y-auto custom-scrollbar font-sans text-xs ${appTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                
                                <div className="space-y-4">
                                    <div>
                                        <h3 className={`font-semibold mb-1 text-xs ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Basic Search</h3>
                                        <p className="mb-1">Type any word to perform a semantic fuzzy search across node names, values, paths, and types.</p>
                                        <code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-indigo-300' : 'bg-slate-100 text-indigo-600'}`}>auth</code>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-1 text-xs ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Field Queries</h3>
                                        <p className="mb-1">Use <code className={`px-1 rounded text-[10px] ${appTheme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>field:value</code> syntax to query specific properties, like depth, type, or childrenCount.</p>
                                        <ul className="list-disc pl-5 space-y-1 mt-1">
                                            <li><code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-amber-600'}`}>type:"array"</code></li>
                                            <li><code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-emerald-300' : 'bg-slate-100 text-emerald-600'}`}>depth=3</code></li>
                                            <li><code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-pink-300' : 'bg-slate-100 text-pink-600'}`}>childrenCount &gt; 5</code></li>
                                        </ul>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-1 text-xs ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Strict Semantic Operators</h3>
                                        <p className="mb-1">We support deterministic structural search semantics:</p>
                                        <ul className="list-disc pl-5 space-y-0.5 mt-1 mb-2">
                                            <li><code className="font-bold">:</code> &nbsp; Strict semantic equality (<code className="text-[10px]">type:"array"</code>)</li>
                                            <li><code className="font-bold">~=</code> &nbsp; Fuzzy semantic match (<code className="text-[10px]">name~="auth"</code>)</li>
                                            <li><code className="font-bold">*=</code> &nbsp; Substring contains (<code className="text-[10px]">path*="settings"</code>)</li>
                                            <li><code className="font-bold">/=</code> &nbsp; Regex Match (<code className="text-[10px]">name/="^auth.*"</code>)</li>
                                            <li><code className="font-bold">&gt;, &lt;, =</code> &nbsp; Numeric/value comparison (<code className="text-[10px]">depth&gt;=3</code>)</li>
                                        </ul>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-1 text-xs ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Deep Path Queries</h3>
                                        <p className="mb-1">Search specific nested properties mapping dot notation and wildcards for arrays. Note: Strict mode requires exact paths.</p>
                                        <ul className="list-disc pl-5 space-y-1 mt-1">
                                            <li><code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>settings.theme:"dark"</code> (Check deeply nested data value)</li>
                                            <li><code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>features[].name:"Theme"</code> (Find an object in \`features\` array with name "Theme")</li>
                                            <li><code className={`px-2 py-0.5 rounded text-[10px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>(depth &gt; 2) AND type:"string"</code> (Logical grouping)</li>
                                        </ul>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-1 flex items-center gap-2 text-xs ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}><Database size={12}/> MongoDB JSON Syntax</h3>
                                        <p className="mb-1">For power users, strict JSON queries are supported with MongoDB operators.</p>
                                        <pre className={`p-2 rounded-lg text-[10px] font-mono overflow-x-auto ${appTheme === 'dark' ? 'bg-[#161b22] text-slate-300' : 'bg-slate-50 text-slate-700 border'}`}>
{`{
  "type": { "$eq": "object" },
  "childrenCount": { "$gt": 0, "$lt": 10 }
}`}
                                        </pre>
                                    </div>
                                    
                                    <div>
                                        <h3 className={`font-semibold mb-1 text-xs ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Shortcuts</h3>
                                        <p className="mb-1">Press <kbd className={`px-1 py-0.5 rounded text-[10px] border bg-opacity-50 ${appTheme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>Ctrl+F</kbd> or <kbd className={`px-1 py-0.5 rounded text-[10px] border bg-opacity-50 ${appTheme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>Cmd+F</kbd> to focus the search bar.</p>
                                    </div>
                                </div>
     
                            </div>
                        </motion.div>
                  </div>
              )}
          </AnimatePresence>,
          document.body
      )}
    </>
  );
}
