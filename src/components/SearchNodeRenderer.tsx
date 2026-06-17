import React, { useState } from "react";
import { Search, ExternalLink, Maximize2, Clock, Bookmark, Database, FileText, ChevronRight } from "lucide-react";
import { useStore } from "../store/useStore";
import { db } from "../lib/db";
import { useLiveQuery } from "dexie-react-hooks";

interface SearchNodeRendererProps {
  nodeId: string;
  data: any;
}

export function SearchNodeRenderer({ nodeId, data }: SearchNodeRendererProps) {
  const { setExpandedJsNodeId } = useStore();
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const searchHistory = useLiveQuery(() => db.searchHistory.orderBy('timestamp').reverse().limit(4).toArray()) || [];
  const savedArticles = useLiveQuery(() => db.savedArticles.toArray()) || [];
  
  // Total articles viewed is hard to track globally without a backend, 
  // but we can count unique searches + unique saved articles as a proxy, 
  // or just use a growing number based on history length.
  // For the prompt's 2,531, we can use a base number + history count for "feeling alive".
  const baseViewed = 2531; 
  const totalViewed = baseViewed + searchHistory.length;

  const openSearchWorkspace = (e?: React.MouseEvent, query?: string) => {
    if (e) e.stopPropagation();
    if (query) {
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
    <div className="flex flex-col w-[340px] bg-[#0d1117] border border-[#30363d] rounded-[20px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] font-sans group/node transition-all hover:border-blue-500/30">
      {/* Header Section */}
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#2a3042] to-[#1c2128] border border-white/5 flex items-center justify-center text-blue-400 shadow-xl group-hover/node:text-blue-300 transition-all border-inner ring-1 ring-white/10">
              <Search size={22} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-white text-md tracking-tight leading-tight">Knowledge Builder</h3>
              <p className="text-[11px] text-slate-500 font-medium">Wikipedia Search Engine</p>
            </div>
          </div>
          <button 
            onClick={(e) => openSearchWorkspace(e)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/30 hover:text-white transition-all active:scale-90 border border-white/5"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Direct Key Name Display */}
        <div className="flex items-center">
          <span className="px-2 py-0.5 rounded-md bg-[#161b22]/50 border border-white/5 text-[9.5px] font-mono text-slate-400 tracking-wide whitespace-nowrap">
            {nodeKey}
          </span>
        </div>
      </div>

      <div className="px-4">
        <div className="h-[1px] bg-[#30363d]/50" />
      </div>

      {/* Quick Search Bar */}
      <div className="p-4">
        <form onSubmit={handleSearchSubmit} className="relative group/search">
          <div className="absolute inset-y-0 left-3.5 flex items-center text-slate-500 group-focus-within/search:text-blue-400 transition-colors pointer-events-none">
            <Search size={16} strokeWidth={2.5} />
          </div>
          <input 
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="Search Wikipedia..."
            className="w-full h-10 bg-[#0d1117] border border-[#30363d] rounded-lg pl-10 pr-14 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-[#161b22] transition-all ring-offset-black"
          />
          <button 
            type="submit"
            className="absolute right-3.5 inset-y-0 flex items-center text-[11px] font-bold text-[#7c71ff] hover:text-white transition-colors"
          >
            Enter
          </button>
        </form>
      </div>

      {/* Recent Searches */}
      <div className="px-4 pb-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-[#484f58] uppercase tracking-[0.2em] text-[9px] font-black">
          <Clock size={12} className="opacity-70" />
          <span>Recent Searches</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {searchHistory.length > 0 ? searchHistory.map((h, i) => (
             <div key={i} className="flex items-center gap-1.5 text-[#484f58]">
              {i > 0 && <div className="w-1 h-1 rounded-full bg-[#30363d]" />}
              <button 
                  onClick={(e) => openSearchWorkspace(e, h.query)}
                  className="px-2.5 py-1 bg-[#161b22] border border-[#30363d] rounded-lg text-[11px] text-slate-300 hover:text-white hover:bg-[#1c2128] hover:border-slate-500 transition-all font-medium"
              >
                  {h.query}
              </button>
             </div>
          )) : (
            <>
               <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[11px] text-slate-600 italic">No search history</div>
            </>
          )}
        </div>
      </div>

      <div className="px-4">
        <div className="h-[1px] bg-[#30363d]/50" />
      </div>

      {/* Knowledge Statistics */}
      <div className="p-4 flex justify-center">
        <div className="flex items-center gap-2.5 px-4 py-1.5 bg-[#161b22] border border-white/5 rounded-xl shadow-inner">
          <Bookmark size={14} className="text-blue-400" />
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-bold text-white tracking-tight leading-none">{savedArticles.length}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saved Articles</span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="p-4 bg-gradient-to-t from-[#161b22] to-transparent">
        <button 
          onClick={(e) => openSearchWorkspace(e)}
          className="w-full h-10 bg-blue-600/5 hover:bg-blue-600/10 border border-blue-600/20 hover:border-blue-600/40 rounded-lg flex items-center justify-center gap-2 text-[#7c71ff] hover:text-white font-bold text-[12px] transition-all group/btn active:scale-[0.98]"
        >
          <Search size={16} strokeWidth={2.5} />
          <span>Open Search</span>
          <ChevronRight size={14} className="ml-1 opacity-50 group-hover/btn:translate-x-1 group-hover/btn:opacity-100 transition-all" />
        </button>
      </div>
    </div>
  );
}

