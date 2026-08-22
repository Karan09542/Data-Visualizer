import React, { useState, useEffect } from "react";
import { Search, Maximize2, Clock, Bookmark, ChevronRight } from "lucide-react";
import { useStore } from "../store/useStore";
import { db } from "../lib/db";
import { liveQuery } from "dexie";
import { v4 as uuidv4 } from "uuid";
import { NodeOptionsMenu } from "./NodeOptionsMenu";

interface SearchNodeRendererProps {
  nodeId: string;
  data: any;
}

export function SearchNodeRenderer({ nodeId, data }: SearchNodeRendererProps) {
  const setExpandedJsNodeId = useStore((state) => state.setExpandedJsNodeId);
  const updateNodeValue = useStore((state) => state.updateNodeValue);
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const parsedValue = typeof data.value === 'object' && data.value !== null ? data.value :
    (typeof data.value === 'string' && data.value.startsWith('{')) ? JSON.parse(data.value) : {};

  const storageKey = parsedValue?.storageKey;

  useEffect(() => {
    if (!storageKey) {
      const newKey = `idxdb_${uuidv4().substring(0, 8)}`;
      updateNodeValue(data.path, { ...parsedValue, key: data.name, storageKey: newKey });
    }
  }, [storageKey, data.path, data.name, updateNodeValue]);

  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [savedArticles, setSavedArticles] = useState<any[]>([]);

  useEffect(() => {
    if (!storageKey) return;

    let active = true;
    const historySub = liveQuery(() =>
      db.nodeSearchHistory
        .where('storageKey')
        .equals(storageKey)
        .toArray()
        .then(arr => arr.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4))
    ).subscribe({
      next: (result) => {
        if (!active) return;
        setTimeout(() => { if (active) setSearchHistory(result || []); }, 0);
      }
    });

    const savedSub = liveQuery(() =>
      db.nodeSearchBookmarks
        .where('storageKey')
        .equals(storageKey)
        .toArray()
        .then(arr => arr.sort((a, b) => b.timestamp - a.timestamp))
    ).subscribe({
      next: (result) => {
        if (!active) return;
        setTimeout(() => { if (active) setSavedArticles(result || []); }, 0);
      }
    });

    return () => {
      active = false;
      historySub.unsubscribe();
      savedSub.unsubscribe();
    };
  }, [storageKey]);

  const baseViewed = 2531;
  const totalViewed = baseViewed + searchHistory.length;

  const openSearchWorkspace = (e?: React.MouseEvent, query?: string) => {
    if (e) e.stopPropagation();
    if (query !== undefined) {
      sessionStorage.setItem(`${data.path}_query`, query);
      window.dispatchEvent(new CustomEvent("search_node_query_updated", {
        detail: { path: data.path, query }
      }));
    }
    setExpandedJsNodeId(data.path);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearchQuery.trim()) {
      openSearchWorkspace(undefined, localSearchQuery);
    }
  };

  const nodeKey = data.path.split('.').pop() || "search";

  return (
    <div className="flex flex-col w-[340px] bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-xl border border-slate-200/50 dark:border-[#30363d] rounded-[20px] overflow-hidden shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] font-sans group/node transition-all duration-300 hover:border-blue-500/50 hover:shadow-blue-500/10 dark:hover:shadow-blue-500/10 relative">
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover/node:opacity-100 transition-opacity duration-500" />

      {/* Header Section */}
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-slate-100 to-slate-50 dark:from-[#21262d] dark:to-[#161b22] border border-slate-200/50 dark:border-[#30363d] flex items-center justify-center text-blue-500 dark:text-blue-400 shadow-sm dark:shadow-md group-hover/node:text-blue-600 dark:group-hover/node:text-blue-300 transition-all ring-1 ring-black/5 dark:ring-white/5">
              <Search size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-slate-900 dark:text-white text-[15px] tracking-tight leading-tight">Knowledge Builder</h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Wikipedia Search Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => openSearchWorkspace(e)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100/50 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-all active:scale-95 border border-transparent dark:border-white/5"
            >
              <Maximize2 size={13} strokeWidth={2} />
            </button>
            <NodeOptionsMenu path={data.path} iconSize={13} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100/50 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-all active:scale-95 border border-transparent dark:border-white/5" />
          </div>
        </div>

        {/* Direct Key Name Display */}
        <div className="flex items-center">
          <span className="px-2.5 py-1 rounded-md bg-slate-100/80 dark:bg-[#161b22] border border-slate-200/50 dark:border-[#30363d] text-[10px] font-mono text-slate-600 dark:text-slate-400 tracking-wide whitespace-nowrap">
            {nodeKey}
          </span>
        </div>
      </div>

      <div className="px-4">
        <div className="h-[1px] bg-slate-200/50 dark:bg-[#30363d]/50" />
      </div>

      {/* Quick Search Bar */}
      <div className="p-4">
        <form onSubmit={handleSearchSubmit} className="relative group/search">
          <div className="absolute inset-y-0 left-3.5 flex items-center text-slate-400 dark:text-slate-500 group-focus-within/search:text-blue-500 dark:group-focus-within/search:text-blue-400 transition-colors pointer-events-none">
            <Search size={15} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="Search Wikipedia..."
            className="w-full h-10 bg-slate-100/50 dark:bg-[#161b22] border border-slate-200/50 dark:border-[#30363d] rounded-[12px] pl-10 pr-14 text-[13px] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 focus:bg-white dark:focus:bg-[#0d1117] transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 inset-y-0 flex items-center my-1.5 px-2.5 rounded-[8px] bg-blue-50 dark:bg-blue-500/10 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>

      {/* Recent Searches */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-500 uppercase tracking-[0.15em] text-[10px] font-semibold">
          <Clock size={12} strokeWidth={2.5} />
          <span>Recent Searches</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {searchHistory.length > 0 ? searchHistory.map((h, i) => (
            <button
              key={i}
              onClick={(e) => openSearchWorkspace(e, h.query)}
              className="px-2.5 py-1.5 bg-slate-100/80 dark:bg-[#161b22] border border-slate-200/50 dark:border-[#30363d] rounded-[8px] text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-[#21262d] transition-all font-medium flex items-center gap-1.5 group/tag"
            >
              <Search size={10} strokeWidth={3} className="opacity-40 group-hover/tag:text-blue-500 dark:group-hover/tag:text-blue-400 transition-colors" />
              {h.query}
            </button>
          )) : (
            <div className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161b22]/50 border border-slate-200/50 dark:border-[#30363d] rounded-[8px] flex items-center justify-center gap-2">
              <span className="text-[12px] text-slate-500 dark:text-slate-500">No search history yet</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Action */}
      <div className="mt-1 flex items-center justify-between p-4 bg-slate-50/80 dark:bg-[#161b22]/50 border-t border-slate-200/50 dark:border-[#30363d]/50">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-500 dark:text-blue-400">
            <Bookmark size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 leading-none">{savedArticles.length}</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-500 uppercase tracking-wider font-semibold mt-0.5">Saved</span>
          </div>
        </div>
        <button
          onClick={(e) => openSearchWorkspace(e)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-[10px] flex items-center justify-center gap-2 font-semibold text-[12px] transition-all shadow-sm hover:shadow-blue-500/25 active:scale-95 group/btn"
        >
          <span>Open Search</span>
          <ChevronRight size={14} strokeWidth={2.5} className="group-hover/btn:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

