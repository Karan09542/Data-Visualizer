import React, { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import type { SearchResult } from "./pdfWorkerClient";
import { ICON_BUTTON } from "./pdfTheme";

interface PdfSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  /** Index into results of the match being shown, or -1 */
  activeIndex: number;
  onPick: (index: number) => void;
  autoFocus: boolean;
}

export const PdfSearch: React.FC<PdfSearchProps> = ({
  query,
  onQueryChange,
  results,
  isSearching,
  activeIndex,
  onPick,
  autoFocus,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Keep the active match in view in the list
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const pageCount = useMemo(() => new Set(results.map((r) => r.pageNumber)).size, [results]);
  const step = (dir: 1 | -1) => {
    if (!results.length) return;
    onPick((activeIndex + dir + results.length) % results.length);
  };

  const status = !query.trim()
    ? "Search the text of this document"
    : isSearching && !results.length
      ? "Searching…"
      : results.length
        ? `${results.length} ${results.length === 1 ? "match" : "matches"} on ${pageCount} ${pageCount === 1 ? "page" : "pages"}${isSearching ? "…" : ""}`
        : "No matches";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 p-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--pv-muted)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                step(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder="Find in document"
            aria-label="Find in document"
            className="h-10 w-full rounded-lg border border-(--pv-line) bg-(--pv-chip) pl-9 pr-9 text-[13px] text-(--pv-text) outline-none transition-colors placeholder:text-(--pv-muted) focus:border-(--pv-accent)"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-(--pv-muted) hover:bg-(--pv-hover) hover:text-(--pv-text)"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pl-1">
          <span className="flex items-center gap-1.5 text-xs text-(--pv-muted)" role="status">
            {isSearching && <Loader2 size={12} className="animate-spin" />}
            {status}
          </span>
          {results.length > 0 && (
            <span className="flex items-center">
              <span className="mr-1 text-xs tabular-nums text-(--pv-muted)">
                {activeIndex + 1}/{results.length}
              </span>
              <button onClick={() => step(-1)} className={`${ICON_BUTTON} h-7 w-7`} aria-label="Previous match" title="Previous (Shift+Enter)">
                <ChevronUp size={15} />
              </button>
              <button onClick={() => step(1)} className={`${ICON_BUTTON} h-7 w-7`} aria-label="Next match" title="Next (Enter)">
                <ChevronDown size={15} />
              </button>
            </span>
          )}
        </div>
      </div>

      <div ref={listRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {results.map((r, i) => (
          <button
            key={`${r.pageNumber}-${r.matchId}`}
            data-index={i}
            onClick={() => onPick(i)}
            className={`mb-1 block w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
              i === activeIndex ? "bg-(--pv-accent-soft)" : "hover:bg-(--pv-hover)"
            }`}
          >
            <span className="mb-0.5 block text-[11px] font-semibold text-(--pv-accent)">Page {r.pageNumber}</span>
            <span className="line-clamp-3 text-xs leading-relaxed text-(--pv-muted)">
              {r.before}
              <mark className="rounded-sm bg-amber-400/35 px-0.5 font-medium text-(--pv-text)">{r.match}</mark>
              {r.after}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
