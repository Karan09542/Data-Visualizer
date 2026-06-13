import React from "react";
import { Search, ExternalLink, Maximize2 } from "lucide-react";
import { useStore } from "../store/useStore";

interface SearchNodeRendererProps {
  nodeId: string;
  data: any;
}

export function SearchNodeRenderer({ nodeId, data }: SearchNodeRendererProps) {
  const { setExpandedJsNodeId } = useStore();

  const openSearchWorkspace = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedJsNodeId(data.path);
  };

  const hasData = data.value && data.value.query;
  const totalResults = hasData && data.value.totalHits ? data.value.totalHits : (data.value?.results?.length || data.value?.images?.length || 0);
  const title = hasData ? data.value.query : "Knowledge Builder";

  return (
    <div className="flex flex-col w-full h-full relative group">
      {/* Search Header */}
      <div 
        className="flex items-center gap-2 p-3 bg-white/5 dark:bg-black/20 border-b border-white/10"
        onClick={openSearchWorkspace}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
          <Search size={16} />
        </div>
        <div className="flex-1 overflow-hidden" title={title}>
          <div className="font-bold text-sm truncate">{title}</div>
          <div className="text-[10px] opacity-70 flex items-center gap-1">
             {hasData ? `${totalResults} results` : "Wikipedia Search Engine"}
          </div>
        </div>
        <button 
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
          onClick={openSearchWorkspace}
          title="Open Fullscreen Search"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Content Summary */}
      <div 
         className="flex-1 p-3 overflow-hidden cursor-pointer hover:bg-white/5 transition-colors relative"
         onClick={openSearchWorkspace}
      >
         {hasData ? (
           <div className="space-y-2">
             {data.value.type === "searchResults" && data.value.results?.slice(0, 3).map((r: any, i: number) => (
                <div key={i} className="flex gap-2 items-start text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                   {r.thumbnail && (
                     <img src={r.thumbnail} className="w-8 h-8 object-cover rounded opacity-80 shrink-0" />
                   )}
                   <div className="flex-1 truncate">
                      <div className="font-semibold truncate">{r.title}</div>
                      <div className="opacity-70 truncate text-[10px]" dangerouslySetInnerHTML={{ __html: r.snippet }} />
                   </div>
                </div>
             ))}
             {data.value.type === "article" && data.value.article?.lead && (
                <div className="flex flex-col gap-2">
                   {data.value.article.lead.image?.urls?.['320'] && (
                     <img src={data.value.article.lead.image.urls['320']} className="w-full h-24 object-cover rounded-lg" />
                   )}
                   <div className="font-bold text-sm">{data.value.article.lead.displaytitle}</div>
                   <div className="text-xs opacity-70 line-clamp-3">{data.value.article.lead.description}</div>
                </div>
             )}
             {data.value.type === "imageResults" && data.value.images && (
                <div className="grid grid-cols-3 gap-1">
                   {data.value.images.slice(0, 6).map((img: any, i: number) => {
                      const url = img.imageinfo?.[0]?.url;
                      return url ? <img key={i} src={url} className="w-full aspect-square object-cover rounded opacity-80" /> : null;
                   })}
                </div>
             )}
           </div>
         ) : (
           <div className="w-full h-full flex flex-col items-center justify-center opacity-50 gap-2">
              <Search size={24} />
              <div className="text-xs font-medium uppercase tracking-widest text-center px-4">Click to open Search</div>
           </div>
         )}
      </div>
    </div>
  );
}
