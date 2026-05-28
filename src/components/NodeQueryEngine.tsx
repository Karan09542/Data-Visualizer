import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { Search, Database, Command, Code2, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, X, Info, Settings, RefreshCw, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parseSearchQuery } from '../utils/searchEngine';

export default function NodeQueryEngine() {
  const { searchQuery, setSearchQuery, searchMatches, activeMatchIndex, treeData, appTheme, setIsAdvancedPanelOpen, searchEngineMode, globalSearchErrors, globalSearchSuggestions } = useStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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
                            className={`relative w-full max-w-xl md:max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
                                appTheme === 'dark' ? 'bg-[#0d1117] border border-slate-800' : 'bg-white border border-slate-200'
                            }`}
                        >
                            <div className={`px-6 py-4 border-b flex justify-between items-center ${appTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                                <h2 className={`font-semibold text-base flex items-center gap-2 ${appTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                                    <Command size={18} className="text-indigo-500" />
                                    Search & Query Guide
                                </h2>
                                <button
                                    onClick={() => setShowHelp(false)}
                                    className={`p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors ${appTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className={`p-6 overflow-y-auto custom-scrollbar font-sans text-sm leading-relaxed ${appTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                                
                                <div className="space-y-6">
                                    <div>
                                        <h3 className={`font-semibold mb-2 text-sm ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Basic Search</h3>
                                        <p className="mb-2">Type any word to perform a semantic fuzzy search across node names, values, paths, and types.</p>
                                        <code className={`px-2 py-1.5 rounded text-xs break-words ${appTheme === 'dark' ? 'bg-slate-800/80 text-indigo-300' : 'bg-slate-100 text-indigo-600'}`}>auth</code>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-2 text-sm ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Field Queries & Comparisons</h3>
                                        <p className="mb-2">Use <code className={`px-1.5 py-0.5 rounded text-xs ${appTheme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>field:value</code> syntax to query specific properties. You can also use comparison operators (<code className="font-bold tracking-widest">&gt;, &lt;, &gt;=, &lt;=, !=, ==</code>) on deeply nested fields.</p>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-amber-600'}`}>type:"array"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Exact type match</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-emerald-300' : 'bg-slate-100 text-emerald-600'}`}>depth&gt;=3</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Depth is greater than or equal to 3</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-pink-300' : 'bg-slate-100 text-pink-600'}`}>childrenCount &gt; 5</code> <span className="ml-2 text-slate-500 dark:text-slate-400">More than 5 children</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-purple-300' : 'bg-slate-100 text-purple-600'}`}>id!="root"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">ID is not "root"</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-fuchsia-300' : 'bg-slate-100 text-fuchsia-600'}`}>name/="^auth"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Regex match (starts with "auth")</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>dimension.width &lt; 10 AND price &gt; 10</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Nested deep queries</span></li>
                                        </ul>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-2 text-sm flex items-center gap-2 ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                            Strict Semantic Operators
                                        </h3>
                                        <p className="mb-2">We support deterministic structural search semantics:</p>
                                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 rounded-lg ${appTheme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-3"><code className="font-bold w-6 text-center text-indigo-500">:</code><span className="text-xs">Strict semantic equality</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-6 text-center text-indigo-500">~=</code><span className="text-xs">Fuzzy semantic match</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-6 text-center text-indigo-500">*=</code><span className="text-xs">Substring contains</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-6 text-center text-indigo-500">/=</code><span className="text-xs">Regex Match</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-6 text-center text-indigo-500">&gt;, &lt;</code><span className="text-xs">Numeric comparison</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-6 text-center text-indigo-500">IN</code><span className="text-xs">Array items overlap</span></div>
                                        </div>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-2 text-sm flex items-center gap-2 ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                                            Logical Operators
                                        </h3>
                                        <p className="mb-2">Combine multiple queries using logical grouping:</p>
                                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 rounded-lg ${appTheme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                                            <div className="flex items-center gap-3"><code className="font-bold w-12 text-center text-indigo-500">AND</code><span className="text-xs">Match all conditions</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-12 text-center text-indigo-500">OR</code><span className="text-xs">Match any condition</span></div>
                                            <div className="flex items-center gap-3"><code className="font-bold w-12 text-center text-indigo-500">( )</code><span className="text-xs">Group expressions</span></div>
                                            <div className="flex items-center gap-3"><span className="text-xs italic text-slate-500">Space implies AND</span></div>
                                        </div>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-2 text-sm ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>Deep Path Queries</h3>
                                        <p className="mb-2">Search specific nested properties mapping dot notation and wildcards for arrays. <br/><span className="italic text-xs mt-1 inline-block opacity-80">(Note: Strict mode requires exact paths)</span></p>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>settings.theme:"dark"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Check deeply nested data value</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>features[].name:"Theme"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Find inside array items</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>features[-1]:"Media"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Match the last item in array</span></li>
                                            <li><code className={`px-2 py-1 inline-block rounded text-[11px] break-words ${appTheme === 'dark' ? 'bg-slate-800 text-blue-300' : 'bg-slate-100 text-blue-600'}`}>(depth &gt; 2) AND type:"string"</code> <span className="ml-2 text-slate-500 dark:text-slate-400">Logical grouping</span></li>
                                        </ul>
                                    </div>
     
                                    <div>
                                        <h3 className={`font-semibold mb-2 flex items-center gap-2 text-sm ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}><Database size={14} className="text-emerald-500"/> MongoDB JSON Syntax</h3>
                                        <p className="mb-2">For power users, strict JSON queries are supported with MongoDB operators such as <code className="font-mono text-[10px]">$eq, $gt, $lt, $regex, $text, $or, $and</code>.</p>
                                        <pre className={`p-4 rounded-xl text-xs font-mono overflow-x-auto border shadow-inner ${appTheme === 'dark' ? 'bg-[#161b22] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
{`{
  "$or": [
    { "type": { "$eq": "object" } },
    { "settings.version": { "$gt": 2 } }
  ],
  "name": { "$regex": "^user.*", "$ne": "user_archived" },
  "childrenCount": { "$gt": 0, "$lt": 10 }
}`}
                                        </pre>
                                    </div>
                                    
                                    <div>
                                        <h3 className={`font-semibold mb-2 flex items-center gap-2 text-sm ${appTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}><Globe size={14} className="text-indigo-500 animate-pulse"/> Interactive API Nodes</h3>
                                        <p className="mb-2">If any JSON/YAML key ends in <code className="font-mono text-xs font-bold text-indigo-500">_api_node</code> and has a String URL value, it transforms into an interactive remote endpoint trigger.</p>
                                        <ul className="list-disc pl-5 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                                            <li>Double-click/Edit to customize HTTP Action (<code className="font-mono">GET, POST, etc</code>), timeout, and formats</li>
                                            <li>Execute directly from Node UI to mount remote responses into the graph tree under a <code className="font-mono text-emerald-500">__fetched</code> subtree directory</li>
                                        </ul>
                                    </div>

                                    <div className={`mt-6 pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${appTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <div className="flex flex-col gap-1.5">
                                            <h3 className={`font-semibold text-xs uppercase tracking-wider ${appTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Shortcuts</h3>
                                            <p className="text-xs">Press <kbd className={`px-1.5 py-0.5 rounded text-[10px] border font-mono mx-1 shadow-sm ${appTheme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>Ctrl+F</kbd> or <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono border mx-1 shadow-sm ${appTheme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>Cmd+F</kbd> to focus the search bar.</p>
                                        </div>
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
