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
    <div className="flex flex-col bg-[var(--vsc-panel,#f8f8f8)] border-t border-[var(--vsc-border,#e5e5e5)] w-full select-none z-50">
      <SmartToolbar editor={editor} />

      {isVisible && (
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-[var(--vsc-border,#e5e5e5)] px-1.5 bg-[var(--vsc-panel,#f8f8f8)] overflow-x-auto no-scrollbar touch-pan-x">
            <button
              onClick={() => setActiveCategory("Recent")}
              className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                activeCategory === "Recent" ? "text-[var(--vsc-fg,#3b3b3b)] border-[var(--vsc-accent,#005fb8)]" : "text-[var(--vsc-fg-muted,#616161)] border-transparent hover:text-[var(--vsc-fg,#3b3b3b)]"
              }`}
            >
              <Clock size={14} /> Recent
            </button>
            <button
              onClick={() => setActiveCategory("Favorites")}
              className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                activeCategory === "Favorites" ? "text-[var(--vsc-fg,#3b3b3b)] border-[var(--vsc-accent,#005fb8)]" : "text-[var(--vsc-fg-muted,#616161)] border-transparent hover:text-[var(--vsc-fg,#3b3b3b)]"
              }`}
            >
              <Star size={14} /> Favorites
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                  activeCategory === cat ? "text-[var(--vsc-fg,#3b3b3b)] border-[var(--vsc-accent,#005fb8)]" : "text-[var(--vsc-fg-muted,#616161)] border-transparent hover:text-[var(--vsc-fg,#3b3b3b)]"
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setIsVisible(false)}
              className="p-1.5 ml-1 rounded-[4px] text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors cursor-pointer shrink-0"
              title="Close Assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div className="h-40 md:h-48 overflow-y-auto no-scrollbar bg-[var(--vsc-panel-body,#ffffff)]">
            {activeCategory === "Recent" ? (
              recentItems.length > 0 ? (
                <SnippetPanel editor={editor} items={recentItems} />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--vsc-fg-muted,#616161)] text-sm">
                  No recent items
                </div>
              )
            ) : activeCategory === "Favorites" ? (
              favoriteItems.length > 0 ? (
                <SnippetPanel editor={editor} items={favoriteItems} />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--vsc-fg-muted,#616161)] text-sm">
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
