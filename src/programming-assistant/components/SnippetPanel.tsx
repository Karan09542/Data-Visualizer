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
            className="relative group h-11 bg-[var(--vsc-input,#ffffff)] border border-[var(--vsc-border,#e5e5e5)] rounded-[4px] flex items-center justify-center font-mono text-sm text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] hover:border-[var(--vsc-border-strong,#cecece)] active:scale-95 transition-colors overflow-hidden cursor-pointer"
          >
            <span className="truncate px-2">{item.label}</span>
            <div
              onClick={(e) => toggleFavorite(e, item)}
              className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Star
                size={12}
                className={isFav ? "fill-amber-400 text-amber-400" : "text-[var(--vsc-fg-muted,#616161)]"}
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
