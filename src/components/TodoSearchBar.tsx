import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, Circle, AlertCircle, Tag, Plus, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { TodoTask } from "./TodoNodeRenderer";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, PREDEFINED_TAGS, getTagColorClass } from "./TodoWorkspace";

export function parseTokensAndInput(searchTerm: string) {
  const filters: { type: string; value: string; raw: string }[] = [];
  const regex = /\b(label|tag|priority|status|has|due):([^\s]*)/ig;
  let match;

  while ((match = regex.exec(searchTerm)) !== null) {
      const isAtEnd = match.index + match[0].length === searchTerm.length;
      if (isAtEnd && !searchTerm.endsWith(" ")) {
          // Actively typing this filter at the very end
          continue;
      }
      if (match[2]) { // only if it has a value
        filters.push({ type: match[1].toLowerCase(), value: match[2].toLowerCase(), raw: match[0] });
      }
  }

  let remainder = searchTerm;
  for (const f of filters) {
      remainder = remainder.replace(f.raw, "");
  }
  
  // Clean up leading spaces from removed tokens but preserve trailing spaces for typing
  remainder = remainder.replace(/^\s+/, "");
  
  // if they typed a space after a token and are about to start a new word
  if (remainder === "" && searchTerm.endsWith(" ")) {
      remainder = " ";
  }

  return { filters, inputValue: remainder };
}

export function TodoSearchBar({
  searchTerm,
  setSearchTerm,
  allTasks,
  onClear,
}: {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  allTasks: TodoTask[];
  onClear?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { filters, inputValue } = useMemo(() => parseTokensAndInput(searchTerm), [searchTerm]);
  
  const allLabels = useMemo(() => {
    const list: TodoTask[] = [];
    const walk = (tList: TodoTask[]) => {
      for (const t of tList) {
        list.push(t);
        if (t.tasks) walk(t.tasks);
      }
    };
    walk(allTasks);

    const labels = new Map<string, number>();
    PREDEFINED_TAGS.forEach(tag => labels.set(tag, 0));
    for (const t of list) {
      if (t.tags) {
        for (const tag of t.tags) {
          labels.set(tag, (labels.get(tag) || 0) + 1);
        }
      }
    }
    return Array.from(labels.entries()).sort((a, b) => b[1] - a[1]);
  }, [allTasks]);

  const currentWordMatches = inputValue.match(/\b(\w+):(\w*)$/i);
  const isTypingFilter = !!currentWordMatches;
  const filterType = isTypingFilter ? currentWordMatches[1].toLowerCase() : null;
  const filterVal = isTypingFilter ? currentWordMatches[2].toLowerCase() : null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = (e: React.FocusEvent) => {
    // Make sure we aren't clicking inside the dropdown
    if (
      dropdownRef.current &&
      dropdownRef.current.contains(e.relatedTarget as Node)
    ) {
      return;
    }
    // Also ignore if clicking inside container
    if (
      containerRef.current &&
      containerRef.current.contains(e.relatedTarget as Node)
    ) {
      return;
    }
    
    // Give a tiny delay to allow click events to fire
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setIsFocused(false);
      }
    }, 150);
  };

  const addFilter = (type: string, value: string) => {
    let newTerm = searchTerm;
    
    const typingMatch = inputValue.match(/(\b\w+)(?:\s*:[\w\s]*)?$/);
    if (typingMatch) {
       const word = typingMatch[1].toLowerCase();
       const isKeywordMatch = ["status", "priority", "label", "tag", "due", "has"].some(k => k.startsWith(word));
       const isValueMatch = value.toLowerCase().startsWith(word);
       const isExactTypeMatch = type.toLowerCase().startsWith(word);
       
       if (isKeywordMatch || isValueMatch || isExactTypeMatch) {
           newTerm = searchTerm.substring(0, searchTerm.lastIndexOf(typingMatch[0]));
       }
    }
    
    if (newTerm && !newTerm.endsWith(" ")) {
        newTerm += " ";
    }
    newTerm += `${type}:${value} `;
    setSearchTerm(newTerm);
    inputRef.current?.focus();
  };

  const removeFilter = (filterRaw: string) => {
    const newTerm = searchTerm.replace(filterRaw, "").replace(/\s+/g, " ").trim();
    setSearchTerm(newTerm + " ");
    inputRef.current?.focus();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && inputValue.trim() === "" && filters.length > 0) {
      e.preventDefault();
      const last = filters[filters.length - 1];
      const newTerm = searchTerm.substring(0, searchTerm.lastIndexOf(last.raw)).trim();
      setSearchTerm(newTerm + (newTerm ? " " : ""));
      return;
    }
    
    if (e.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const focusable = dropdownRef.current?.querySelectorAll('button');
      if (focusable && focusable.length > 0) {
        if (e.key === "ArrowDown") {
          (focusable[0] as HTMLButtonElement).focus();
        } else {
          (focusable[focusable.length - 1] as HTMLButtonElement).focus();
        }
      }
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const focusable = Array.from(dropdownRef.current?.querySelectorAll('button') || []);
        const index = focusable.indexOf(document.activeElement as HTMLButtonElement);
        if (index > -1) {
            let nextIndex = e.key === "ArrowDown" ? index + 1 : index - 1;
            if (nextIndex >= focusable.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = focusable.length - 1;
            (focusable[nextIndex] as HTMLButtonElement).focus();
        }
    } else if (e.key === "Tab" || e.key === "Enter") {
        if (e.key === "Tab") e.preventDefault();
        const activeItem = document.activeElement as HTMLButtonElement;
        if (activeItem && dropdownRef.current?.contains(activeItem)) {
            activeItem.click();
        }
    } else if (e.key === "Escape") {
        e.preventDefault();
        setIsFocused(false);
        inputRef.current?.focus();
    } else if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") {
        // If a normal key was typed, move focus back to input
        inputRef.current?.focus();
    }
  };

  const getRecentOrPopularFilters = () => {
    const suggestions = [];
    if (!filters.some(f => f.type === "status" && f.value === "todo")) {
      suggestions.push({ type: "status", value: "todo", label: "Status: Todo" });
    }
    if (!filters.some(f => f.type === "priority" && f.value === "high")) {
      suggestions.push({ type: "priority", value: "high", label: "Priority: High" });
    }
    const topLabels = allLabels.slice(0, 3);
    for (const [tag] of topLabels) {
      if (!filters.some(f => (f.type === "label" || f.type === "tag") && f.value === tag)) {
         suggestions.push({ type: "label", value: tag, label: `Label: ${tag}` });
      }
    }
    return suggestions;
  };

  return (
    <div className="relative w-full flex-1" ref={containerRef}>
      <div 
        className={cn(
          "relative w-full flex items-center h-7 bg-[var(--vsc-input)] border rounded-[4px] px-1.5 gap-1.5 transition-colors",
          isFocused
            ? "border-[var(--vsc-accent)] ring-1 ring-[var(--vsc-accent)]"
            : "border-[var(--vsc-border-strong)] hover:border-[var(--vsc-fg-muted)]"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Search size={14} className="text-[var(--vsc-fg-muted)] shrink-0 ml-1" />
        
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar h-full scroll-smooth">
          {filters.map((f, i) => {
             let colorClass = "bg-[var(--vsc-hover)] text-[var(--vsc-fg)] border-[var(--vsc-border)]";
             
             if (f.type === "status") {
                 if (f.value.includes("todo")) colorClass = "bg-[var(--vsc-hover)] text-[var(--vsc-fg)] border-[var(--vsc-border)]";
                 else if (f.value.includes("progress")) colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/30";
                 else if (f.value.includes("done")) colorClass = "bg-green-500/10 text-green-500 border-green-500/30";
                 else if (f.value.includes("blocked")) colorClass = "bg-red-500/10 text-red-500 border-red-500/30";
                 else colorClass = "bg-[var(--vsc-hover)] text-[var(--vsc-fg)] border-[var(--vsc-border)]";
             } else if (f.type === "priority") {
                 if (f.value.includes("high")) colorClass = "bg-rose-500/10 text-rose-500 border-rose-500/30";
                 else if (f.value.includes("medium")) colorClass = "bg-amber-500/10 text-amber-500 border-amber-500/30";
                 else if (f.value.includes("low")) colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
                 else colorClass = "bg-[var(--vsc-hover)] text-[var(--vsc-fg)] border-[var(--vsc-border)]";
             } else if (f.type === "tag" || f.type === "label") {
                 colorClass = getTagColorClass(f.value);
             } else if (f.type === "due") {
                 colorClass = "bg-orange-500/10 text-orange-500 border-orange-500/30";
             }

             return (
              <div 
                key={i} 
                className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0", colorClass)}
              >
                <span>{f.type}:</span>
                <span className="font-bold">{f.value}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFilter(f.raw); }}
                  className="hover:text-red-500 focus:outline-none ml-0.5 hover:bg-[var(--vsc-active)] rounded flex items-center justify-center p-0.5 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}

          <input
            ref={inputRef}
            id="search-tasks-input"
            value={inputValue}
            onChange={(e) => {
              const val = e.target.value;
              const filterStrings = filters.map(f => f.raw).join(" ");
              setSearchTerm((filterStrings ? filterStrings + " " : "") + val);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z" || e.key === "y" || e.key === "Y")) {
                e.stopPropagation();
              }
              handleKeyDown(e);
            }}
            placeholder={filters.length === 0 && !inputValue ? "Search tasks... (Ctrl+K)" : ""}
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs font-medium text-[var(--vsc-fg)] placeholder:text-[var(--vsc-fg-muted)] p-0 h-full"
            spellCheck={false}
          />
        </div>

        {searchTerm && (
          <button 
            onClick={(e) => {
               e.stopPropagation();
               setSearchTerm("");
               if (onClear) onClear(); 
            }} 
            className="text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] p-0.5 rounded-[3px] focus:outline-none shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isFocused && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-1 w-[calc(100vw-1.5rem)] sm:w-[480px] md:w-[500px] border border-[var(--vsc-border-strong)] bg-[var(--vsc-widget)] text-[var(--vsc-fg)] shadow-[0_8px_24px_var(--vsc-widget-shadow)] rounded-md z-50 overflow-hidden flex flex-col"
          tabIndex={-1}
          onKeyDown={handleDropdownKeyDown}
        >
          {isTypingFilter && filterType === "label" && (
             <div className="flex flex-col max-h-[300px] overflow-y-auto w-full">
               <div className="px-3 py-2 text-[10px] font-bold text-[var(--vsc-fg-muted)] uppercase tracking-wider border-b border-[var(--vsc-border)] flex items-center gap-1.5">
                  <Tag size={12} /> Select Label
               </div>
               {allLabels
                 .filter(([tag]) => !filterVal || tag.includes(filterVal))
                 .map(([tag, count]) => (
                 <button
                   key={tag}
                   onClick={() => addFilter("label", tag)}
                   className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none transition-colors"
                 >
                    <div className="flex items-center gap-2">
                       <span className={cn("inline-flex items-center h-5 px-1.5 rounded-[4px] text-[11px] font-medium border", getTagColorClass(tag))}>{tag}</span>
                    </div>
                    {count > 0 && <span className="text-[10px] text-[var(--vsc-fg-muted)] font-mono">{count}</span>}
                 </button>
               ))}
               {filterVal && !allLabels.find(([t]) => t === filterVal) && (
                 <button
                   onClick={() => addFilter("label", filterVal)}
                   className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none transition-colors border-t border-[var(--vsc-border)]"
                 >
                    <Plus size={12} className="text-[var(--vsc-accent)]" />
                    <span className="text-xs font-medium text-[var(--vsc-fg)]">
                      Use label "<span className="font-bold">{filterVal}</span>"
                    </span>
                 </button>
               )}
             </div>
          )}

          {isTypingFilter && filterType === "priority" && (
             <div className="flex flex-col max-h-[300px] overflow-y-auto">
                <div className="px-3 py-2 text-[10px] font-bold text-[var(--vsc-fg-muted)] uppercase tracking-wider border-b border-[var(--vsc-border)] flex items-center gap-1.5">
                  <AlertCircle size={12} /> Select Priority
               </div>
               {PRIORITY_OPTIONS
                 .filter(p => !filterVal || p.value.toLowerCase().includes(filterVal))
                 .map(p => (
                 <button
                   key={p.value}
                   onClick={() => addFilter("priority", p.value.toLowerCase())}
                   className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none transition-colors"
                 >
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", p.color)}>
                      {p.label}
                    </span>
                 </button>
               ))}
             </div>
          )}

          {isTypingFilter && filterType === "status" && (
             <div className="flex flex-col max-h-[300px] overflow-y-auto">
                <div className="px-3 py-2 text-[10px] font-bold text-[var(--vsc-fg-muted)] uppercase tracking-wider border-b border-[var(--vsc-border)] flex items-center gap-1.5">
                  <Circle size={12} /> Select Status
               </div>
               {STATUS_OPTIONS
                 .filter(s => !filterVal || s.value.toLowerCase().includes(filterVal))
                 .map(s => {
                   const Icon = s.icon;
                   return (
                     <button
                       key={s.value}
                       onClick={() => addFilter("status", s.value.toLowerCase())}
                       className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none transition-colors"
                     >
                        <Icon size={12} className={s.color} />
                        <span className="text-xs font-medium text-[var(--vsc-fg)]">{s.label}</span>
                     </button>
                   );
                 })}
             </div>
          )}

          {!isTypingFilter && (
             <div className="flex flex-col sm:flex-row w-full divide-y sm:divide-y-0 sm:divide-x divide-[var(--vsc-border)]">
               <div className="flex-1 flex flex-col p-2 gap-2 sm:gap-3 pb-2 sm:pb-3">
                  <div className="px-2 pt-1 text-[10px] font-bold text-[var(--vsc-fg-muted)] uppercase tracking-wider flex justify-between items-center">
                    Suggested Filters
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {getRecentOrPopularFilters().map((sg, i) => (
                      <button 
                        key={i}
                        onClick={() => addFilter(sg.type, sg.value)}
                        className="px-2 py-1 rounded border border-[var(--vsc-border)] bg-[var(--vsc-hover)] hover:bg-[var(--vsc-active)] focus:bg-[var(--vsc-active)] focus:outline-none text-[11px] font-medium text-[var(--vsc-fg)] transition-colors flex items-center gap-1"
                      >
                         <span className="text-[var(--vsc-fg-muted)]">{sg.type}:</span>
                         <span className="font-bold">{sg.value}</span>
                      </button>
                    ))}
                  </div>

                  <div className="px-2 pt-1 sm:pt-2 text-[10px] font-bold text-[var(--vsc-fg-muted)] uppercase tracking-wider">
                    Add Filter Type
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {["status:", "priority:", "label:", "due:"].map((kw) => (
                      <button
                        key={kw}
                        onClick={() => {
                          let newTerm = searchTerm;
                          const trailingWordMatch = inputValue.match(/(\w+)$/);
                          if (trailingWordMatch) {
                               const word = trailingWordMatch[1].toLowerCase();
                               if (kw.startsWith(word) || word.startsWith(kw.replace(":", ""))) {
                                   newTerm = searchTerm.substring(0, searchTerm.lastIndexOf(trailingWordMatch[0]));
                               }
                          }
                          const val = newTerm + (newTerm && !newTerm.endsWith(" ") ? " " : "") + kw;
                          setSearchTerm(val);
                          inputRef.current?.focus();
                        }}
                        className="px-2 py-1 select-none sm:py-1.5 rounded-md border border-transparent hover:border-[var(--vsc-border)] focus:border-[var(--vsc-border)] hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none text-xs font-mono text-blue-500 transition-colors"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
               </div>
               
               <div className="w-full sm:w-[42%] flex flex-col p-2 gap-1 bg-[var(--vsc-hover)] pb-3 sm:pb-2">
                  <div className="px-2 pt-2 sm:pt-1 pb-1 text-[10px] font-bold text-[var(--vsc-fg-muted)] uppercase tracking-wider flex justify-between items-center">
                    Recent Searches
                  </div>
                  <button onClick={() => setSearchTerm('status:progress priority:high ')} className="px-2 py-1.5 text-left text-xs text-[var(--vsc-fg-muted)] hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none hover:text-[var(--vsc-accent)] focus:text-[var(--vsc-accent)] rounded transition-colors truncate">
                    status:progress priority:high
                  </button>
                  <button onClick={() => setSearchTerm('label:backend ')} className="px-2 py-1.5 text-left text-xs text-[var(--vsc-fg-muted)] hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none hover:text-[var(--vsc-accent)] focus:text-[var(--vsc-accent)] rounded transition-colors truncate">
                    label:backend
                  </button>
                   <button onClick={() => setSearchTerm('status:blocked ')} className="px-2 py-1.5 text-left text-xs text-[var(--vsc-fg-muted)] hover:bg-[var(--vsc-hover)] focus:bg-[var(--vsc-hover)] focus:outline-none hover:text-[var(--vsc-accent)] focus:text-[var(--vsc-accent)] rounded transition-colors truncate">
                    status:blocked
                  </button>
               </div>
             </div>
          )}
          
          <div className="px-3 py-2 bg-[var(--vsc-hover)] border-t border-[var(--vsc-border)] text-[10px] text-[var(--vsc-fg-muted)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Command size={10} /> + K to focus search
            </span>
            <span className="flex items-center gap-1">
              Use arrow keys to navigate suggestions
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
