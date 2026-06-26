import React, { useMemo } from "react";
import { SmartToolbar } from "./SmartToolbar";
import { SnippetPanel } from "./SnippetPanel";
import { useAssistantStore } from "../stores/useAssistantStore";
import { getLanguageSnippets } from "../language";
import { X, Clock, Star } from "lucide-react";

interface ProgrammingKeyboardProps {
  editor: any;
  language: string;
}

export const ProgrammingKeyboard: React.FC<ProgrammingKeyboardProps> = ({
  editor,
  language,
}) => {
  const isVisible = useAssistantStore((s) => s.isVisible);
  const setIsVisible = useAssistantStore((s) => s.setIsVisible);
  const activeCategory = useAssistantStore((s) => s.activeCategory);
  const setActiveCategory = useAssistantStore((s) => s.setActiveCategory);
  const recentItems = useAssistantStore((s) => s.recentItems);
  const favoriteItems = useAssistantStore((s) => s.favoriteItems);

  const languagePacks = useMemo(
    () => getLanguageSnippets(language),
    [language],
  );
  const categories = useMemo(() => Object.keys(languagePacks), [languagePacks]);

  // Sync category if language changes and category doesn't exist
  React.useEffect(() => {
    if (!categories.includes(activeCategory) && categories.length > 0) {
      if (activeCategory !== "Recent" && activeCategory !== "Favorites") {
        setActiveCategory(categories[0]);
      }
    }
  }, [categories, activeCategory, setActiveCategory]);

  const isEnabled = useAssistantStore((s) => s.isEnabled);

  if (!isEnabled) return null;

  return (
    <div className="flex flex-col bg-slate-100 dark:bg-[#0d1117] border-t border-slate-200 dark:border-slate-800 shadow-xl w-full select-none z-50">
      <SmartToolbar editor={editor} />

      {isVisible && (
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-1 bg-white dark:bg-[#161b22] overflow-x-auto no-scrollbar touch-pan-x">
            <button
              onClick={() => setActiveCategory("Recent")}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === "Recent"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <Clock size={14} /> Recent
            </button>
            <button
              onClick={() => setActiveCategory("Favorites")}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeCategory === "Favorites"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              <Star size={14} /> Favorites
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              title="Close Assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div className="h-40 md:h-48 overflow-y-auto no-scrollbar bg-slate-50 dark:bg-[#0d1117]">
            {activeCategory === "Recent" ? (
              recentItems.length > 0 ? (
                <SnippetPanel editor={editor} items={recentItems} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  No recent items
                </div>
              )
            ) : activeCategory === "Favorites" ? (
              favoriteItems.length > 0 ? (
                <SnippetPanel editor={editor} items={favoriteItems} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  No favorite items
                </div>
              )
            ) : (
              <SnippetPanel
                editor={editor}
                items={languagePacks[activeCategory] || []}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
