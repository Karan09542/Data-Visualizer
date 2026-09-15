import { useState, useRef, useLayoutEffect, useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check, Search } from "lucide-react";
import { usePreviewHold } from "./image-workspace/hooks/usePreviewHold";

interface Option {
  label: string;
  value: string;
  icon?: React.ReactNode;
  /** Optional one-line hint shown under the label in the menu */
  description?: string;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  options: Option[] | string[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  variant?: "default" | "toolbar";
  /**
   * Called with an option while it is hovered or held, and with null on release. Wire it up to
   * show the choice on the canvas before committing to it; omit it for a plain select.
   */
  onPreview?: (value: string | null) => void;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;
const MAX_LIST_HEIGHT = 320;

export default function CustomSelect({
  label,
  value,
  options: rawOptions,
  onChange,
  icon,
  className = "",
  disabled = false,
  placeholder = "Select...",
  searchable = false,
  variant = "default",
  onPreview,
}: CustomSelectProps) {
  const { bind, stop, consumeHoldClick } = usePreviewHold<string>({
    preview: (option) => onPreview?.(option),
    revert: () => onPreview?.(null)
  });
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "bottom" | "top";
  } | null>(null);
  const listId = useId();

  const options: Option[] = rawOptions.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );
  const hasDescriptions = options.some((opt) => opt.description);

  const filteredOptions = options.filter(opt =>
    !searchable || opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);
  // Rich menus (options with descriptions) also show the chosen option's icon on the trigger
  const triggerIcon = icon ?? (hasDescriptions ? selectedOption?.icon : undefined);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setPosition(null);
  }, []);

  const choose = (optionValue: string) => {
    stop();
    onChange(optionValue);
    close();
    triggerRef.current?.focus();
  };

  // Place the menu under the trigger (or above it when there's more room there), keep it inside
  // the viewport, and follow the trigger when the page or a scrolling toolbar moves.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const dropdown = dropdownRef.current;
    if (!trigger || !dropdown) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const listHeight = listRef.current?.scrollHeight ?? 0;
    const chromeHeight = dropdown.offsetHeight - (listRef.current?.clientHeight ?? 0);
    const naturalHeight = chromeHeight + Math.min(listHeight, MAX_LIST_HEIGHT);

    const spaceBelow = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
    const placement = naturalHeight > spaceBelow && spaceAbove > spaceBelow ? "top" : "bottom";
    const available = placement === "bottom" ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(120, Math.min(MAX_LIST_HEIGHT, available - chromeHeight));
    const height = chromeHeight + Math.min(listHeight, maxHeight);

    const width = Math.max(rect.width, hasDescriptions ? 248 : 168);
    let left = rect.left;
    if (left + width > viewportWidth - VIEWPORT_MARGIN) left = viewportWidth - width - VIEWPORT_MARGIN;
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    const top = placement === "bottom" ? rect.bottom + GAP : rect.top - GAP - height;

    setPosition({ top: Math.max(VIEWPORT_MARGIN, top), left, width, maxHeight, placement });
  }, [hasDescriptions]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScroll = (event: Event) => {
      // Scrolling inside the menu itself shouldn't move it
      if (dropdownRef.current?.contains(event.target as Node)) return;
      updatePosition();
    };
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, updatePosition, filteredOptions.length]);

  // Start keyboard navigation on the selected option
  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(Math.max(0, filteredOptions.findIndex((opt) => opt.value === value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchQuery]);

  // Keep the active option visible while navigating with the keyboard
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen, position]);

  // Closing the menu - by choosing, clicking away or scrolling off - ends any live preview.
  useEffect(() => { if (!isOpen) stop(); }, [isOpen, stop]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target as Node))
      ) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, close]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const count = filteredOptions.length;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (count) setActiveIndex((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (count) setActiveIndex((i) => (i - 1 + count) % count);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(count - 1);
        break;
      case "Enter":
        event.preventDefault();
        if (filteredOptions[activeIndex]) choose(filteredOptions[activeIndex].value);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        triggerRef.current?.focus();
        break;
      case "Tab":
        close();
        break;
    }
  };

  const fromY = position?.placement === "top" ? 6 : -6;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-2 ${className}`}
    >
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 transition-colors">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-label={label ? `${label}: ${selectedOption?.label ?? placeholder}` : undefined}
        className={`flex items-center justify-between gap-2 text-xs font-semibold transition-all outline-none w-full focus-visible:ring-2 focus-visible:ring-blue-500/40
          ${variant === "toolbar"
            ? `px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/[0.08] bg-slate-100/60 dark:bg-transparent hover:bg-slate-200/80 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.12] text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white ${isOpen ? "bg-slate-200/90 dark:bg-white/[0.12] border-slate-300 dark:border-white/[0.15] text-slate-900 dark:text-white" : ""
            }`
            : `px-3 py-2 rounded-xl border ${isOpen
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80"
            }`
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {triggerIcon && (
            <span className="flex flex-shrink-0 items-center text-slate-400 dark:text-slate-500">{triggerIcon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={12}
          className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: fromY, scale: 0.98 }}
                  animate={{ opacity: position ? 1 : 0, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: fromY, scale: 0.98 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  onKeyDown={handleKeyDown}
                  style={{
                    position: "fixed",
                    top: position?.top ?? -9999,
                    left: position?.left ?? -9999,
                    width: position?.width,
                    zIndex: 999999,
                    transformOrigin: position?.placement === "top" ? "bottom" : "top",
                  }}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-black/40"
                >
                  {searchable && (
                    <div className="p-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          aria-controls={listId}
                          className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-md pl-7 pr-2 py-1.5 outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}
                  <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={label}
                    className="overflow-y-auto overscroll-contain custom-scrollbar p-1"
                    style={{ maxHeight: position?.maxHeight ?? MAX_LIST_HEIGHT }}
                  >
                    {filteredOptions.length > 0 ? (
                      filteredOptions.map((option, index) => {
                        const selected = value === option.value;
                        const active = index === activeIndex;
                        const bound = (onPreview ? bind(option.value) : {}) as React.ButtonHTMLAttributes<HTMLButtonElement>;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            data-index={index}
                            tabIndex={-1}
                            {...bound}
                            onMouseEnter={(e) => {
                              bound.onMouseEnter?.(e);
                              setActiveIndex(index);
                            }}
                            onClick={() => {
                              // A hold was a request to look, not to choose.
                              if (consumeHoldClick()) return;
                              choose(option.value);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors
                              ${selected
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                                : active
                                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                                  : "text-slate-700 dark:text-slate-300"
                              }
                            `}
                          >
                            {option.icon && (
                              <span
                                className={`flex flex-shrink-0 items-center justify-center ${hasDescriptions
                                  ? `h-7 w-7 rounded-md ${selected ? "bg-blue-500/15" : "bg-slate-100 dark:bg-slate-800"}`
                                  : "opacity-80"
                                  }`}
                              >
                                {option.icon}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{option.label}</span>
                              {option.description && (
                                <span className={`mt-0.5 block truncate text-[11px] font-normal ${selected ? "text-blue-500/80 dark:text-blue-300/70" : "text-slate-500 dark:text-slate-400"}`}>
                                  {option.description}
                                </span>
                              )}
                            </span>
                            {selected && <Check size={14} className="flex-shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-xs text-center text-slate-500">No results found</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
