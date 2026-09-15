import React, { useState, useEffect, useRef, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useStore } from '../store/useStore';
import { Search, AlertCircle, CheckCircle2, ChevronUp, ChevronDown, X, Info, Settings, RefreshCw, CornerDownLeft, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const NodeQueryEngineHelpModal = lazyWithRetry(() => import('./NodeQueryEngineHelpModal'), 'Query Engine Help');

/** Clickable example queries; `key` is highlighted, `rest` follows it */
const QUERY_EXAMPLES = [
    { query: 'type:"array"', key: 'type:', rest: '"array"', keyClass: 'text-indigo-500 dark:text-indigo-400', description: 'All arrays' },
    { query: 'childrenCount>3', key: 'childrenCount', rest: ' > 3', keyClass: 'text-emerald-600 dark:text-emerald-400', description: 'More than 3 children' },
    { query: 'depth:0', key: 'depth:', rest: '0', keyClass: 'text-amber-600 dark:text-amber-400', description: 'Top-level nodes' },
    { query: '{ type: { $eq: "string" } }', key: '{ type: ', rest: '{ $eq: "string" } }', keyClass: 'text-sky-600 dark:text-sky-400', description: 'Object-style filter' },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function NodeQueryEngine() {
    const searchQuery = useStore((state) => state.searchQuery);
    const setSearchQuery = useStore((state) => state.setSearchQuery);
    const searchMatches = useStore((state) => state.searchMatches);
    const activeMatchIndex = useStore((state) => state.activeMatchIndex);
    const appTheme = useStore((state) => state.appTheme);
    const setIsAdvancedPanelOpen = useStore((state) => state.setIsAdvancedPanelOpen);
    const searchEngineMode = useStore((state) => state.searchEngineMode);
    const globalSearchErrors = useStore((state) => state.globalSearchErrors);
    const globalSearchSuggestions = useStore((state) => state.globalSearchSuggestions);
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
        if (searchQuery !== lastSubmittedQuery.current) {
            setLocalSearch(searchQuery);
            lastSubmittedQuery.current = searchQuery;
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
    const hasError = globalSearchErrors.length > 0;

    const iconButtonClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';
    const navButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200';

    return (
        <>
            <div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto w-[calc(100%-2rem)] max-w-xl node-query-engine no-export"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
            >
                <motion.div
                    initial={{ y: -12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className={`overflow-hidden rounded-xl border bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur-md transition-[border-color,box-shadow] duration-200 dark:bg-[#0f172a]/95 dark:shadow-black/30 ${isFocused
                        ? hasError
                            ? 'border-red-500/50 ring-4 ring-red-500/10'
                            : 'border-blue-500/50 ring-4 ring-blue-500/10'
                        : 'border-slate-200 dark:border-slate-800'
                        }`}
                >
                    {/* Input row */}
                    <div className="flex h-11 items-center gap-2 pl-3 pr-1.5">
                        <Search size={16} className={`shrink-0 transition-colors ${isFocused ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />

                        <input
                            ref={inputRef}
                            type="text"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Tab' || e.key === 'Enter') {
                                    if (!hasQuery) return;
                                    e.preventDefault();
                                    if (e.shiftKey) {
                                        useStore.getState().prevMatch();
                                    } else {
                                        useStore.getState().nextMatch();
                                    }
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    if (hasQuery) setLocalSearch('');
                                    else inputRef.current?.blur();
                                }
                            }}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder='Search nodes — type:"array", depth>3 …'
                            aria-label="Query nodes"
                            aria-invalid={hasError}
                            className={`min-w-0 flex-1 border-none bg-transparent font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 ${hasError ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'
                                }`}
                            autoComplete="off"
                            spellCheck="false"
                        />

                        <AnimatePresence initial={false} mode="popLayout">
                            {hasQuery ? (
                                <motion.div
                                    key="nav"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.12 }}
                                    className="flex shrink-0 items-center gap-0.5"
                                >
                                    {!hasError && (
                                        <span className="mr-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                            {totalMatches > 0 && activeMatchIndex !== null ? `${activeMatchIndex + 1} / ${totalMatches}` : `${totalMatches} / ${totalMatches}`}
                                        </span>
                                    )}
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => useStore.getState().prevMatch()}
                                        disabled={totalMatches === 0}
                                        className={navButtonClass}
                                        title="Previous match (Shift+Enter)"
                                        aria-label="Previous match"
                                    >
                                        <ChevronUp size={15} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => useStore.getState().nextMatch()}
                                        disabled={totalMatches === 0}
                                        className={navButtonClass}
                                        title="Next match (Enter)"
                                        aria-label="Next match"
                                    >
                                        <ChevronDown size={15} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setLocalSearch('')}
                                        className={navButtonClass}
                                        title="Clear (Esc)"
                                        aria-label="Clear search"
                                    >
                                        <X size={14} />
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.kbd
                                    key="shortcut"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="hidden shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:inline-block dark:border-slate-700 dark:text-slate-500"
                                >
                                    {isMac ? '⌘' : 'Ctrl'} K
                                </motion.kbd>
                            )}
                        </AnimatePresence>

                        <div className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-800" />

                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('refetch-all-api-nodes'))}
                            className={`${iconButtonClass} hover:!text-blue-500`}
                            title="Refetch all API nodes"
                            aria-label="Refetch all API nodes"
                        >
                            <RefreshCw size={15} />
                        </button>
                        <button
                            onClick={() => setShowHelp(true)}
                            className={iconButtonClass}
                            title="Query syntax help"
                            aria-label="Query syntax help"
                        >
                            <Info size={15} />
                        </button>
                        <button
                            onClick={() => setIsAdvancedPanelOpen(true)}
                            className={iconButtonClass}
                            title="Settings"
                            aria-label="Open settings"
                        >
                            <Settings size={15} />
                        </button>
                    </div>

                    {/* Status strip */}
                    <AnimatePresence initial={false}>
                        {(isFocused || hasQuery) && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-3 py-1.5 text-[11px] dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        {hasError ? (
                                            <>
                                                <AlertCircle size={12} className="shrink-0 text-red-500" />
                                                <span className="truncate text-red-600 dark:text-red-400">{globalSearchErrors[0]}</span>
                                            </>
                                        ) : hasQuery ? (
                                            <>
                                                <CheckCircle2 size={12} className={`shrink-0 ${totalMatches > 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                <span className={totalMatches > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                                                    {totalMatches === 0 ? 'No matches' : `${totalMatches} match${totalMatches !== 1 ? 'es' : ''}`}
                                                </span>
                                                {globalSearchSuggestions.length > 0 && (
                                                    <span className="truncate text-amber-600 dark:text-amber-400">· {globalSearchSuggestions[0]}</span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="truncate text-slate-500 dark:text-slate-400">
                                                <span className="hidden sm:inline">Enter / Tab next match · Shift for previous · Esc clear</span>
                                                <span className="sm:hidden">Enter for next match</span>
                                            </span>
                                        )}
                                    </div>

                                    <div
                                        role="radiogroup"
                                        aria-label="Query mode"
                                        className="flex shrink-0 rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
                                        title="Strict mode doesn't auto-correct invalid paths (like array access without [])"
                                    >
                                        {(['permissive', 'strict'] as const).map((mode) => {
                                            const active = searchEngineMode === mode;
                                            return (
                                                <button
                                                    key={mode}
                                                    role="radio"
                                                    aria-checked={active}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => useStore.getState().setSearchEngineMode(mode)}
                                                    className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${active
                                                        ? mode === 'strict'
                                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                                        : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                                                        }`}
                                                >
                                                    {mode}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Examples / errors dropdown */}
                <AnimatePresence>
                    {isFocused && (!hasQuery || hasError) && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-xl shadow-slate-900/10 backdrop-blur-md dark:border-slate-800 dark:bg-[#0f172a]/95 dark:text-slate-300 dark:shadow-black/40"
                        >
                            {hasError ? (
                                <div className="flex items-start gap-2.5 px-3 py-3">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                                        <AlertCircle size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">Query can't be parsed</p>
                                        <p className="mt-0.5 break-words text-xs text-red-600 dark:text-red-400">{globalSearchErrors[0]}</p>
                                        {globalSearchSuggestions.length > 0 && (
                                            <p className="mt-1.5 flex items-start gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                <Lightbulb size={12} className="mt-0.5 shrink-0 text-amber-500" />
                                                {globalSearchSuggestions[0]}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Try an example</span>
                                        <button
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => setShowHelp(true)}
                                            className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                                        >
                                            Syntax guide
                                        </button>
                                    </div>
                                    <ul className="p-1.5 pt-0">
                                        {QUERY_EXAMPLES.map((example) => (
                                            <li key={example.query}>
                                                <button
                                                    // Keep focus in the input so the result shows right away
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setLocalSearch(example.query);
                                                    }}
                                                    className="group flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70"
                                                >
                                                    <code className="truncate font-mono text-[12.5px] text-slate-700 dark:text-slate-200">
                                                        <span className={example.keyClass}>{example.key}</span>
                                                        {example.rest}
                                                    </code>
                                                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                                                        <span className="hidden sm:inline">{example.description}</span>
                                                        <CornerDownLeft size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
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
