import React from "react";
import { useAssistantStore, AssistantItem } from "../stores/useAssistantStore";
import { insertSnippet, insertText } from "../services/SnippetService";
import { Star } from "lucide-react";

interface SnippetPanelProps {
  editor: any;
  items: AssistantItem[];
}

export const SnippetPanel: React.FC<SnippetPanelProps> = ({ editor, items }) => {
  const addRecent = useAssistantStore((s) => s.addRecent);
  const favoriteItems = useAssistantStore((s) => s.favoriteItems);
  const addFavorite = useAssistantStore((s) => s.addFavorite);
  const removeFavorite = useAssistantStore((s) => s.removeFavorite);

  const handleInsert = (item: AssistantItem) => {
    if (item.isSnippet) {
      insertSnippet(editor, item.insertText);
    } else {
      insertText(editor, item.insertText);
    }
    addRecent(item);
  };

  const toggleFavorite = (e: React.MouseEvent, item: AssistantItem) => {
    e.stopPropagation();
    const isFav = favoriteItems.some((f) => f.id === item.id);
    if (isFav) {
      removeFavorite(item.id);
    } else {
      addFavorite(item);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
      {items.map((item) => {
        const isFav = favoriteItems.some((f) => f.id === item.id);
        return (
          <button
            key={item.id}
            onClick={() => handleInsert(item)}
            className="relative group h-12 bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm flex items-center justify-center font-mono text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all overflow-hidden"
          >
            <span className="truncate px-2">{item.label}</span>
            <div
              onClick={(e) => toggleFavorite(e, item)}
              className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Star
                size={12}
                className={isFav ? "fill-yellow-400 text-yellow-400" : "text-slate-400"}
              />
            </div>
            {isFav && (
              <div className="absolute top-1 right-1 p-1 md:hidden">
                <Star size={12} className="fill-yellow-400 text-yellow-400" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
