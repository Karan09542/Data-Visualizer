import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalTypeaheadMenuPlugin, useBasicTypeaheadTriggerMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import {
  TextNode,
  createCommand,
  LexicalCommand,
  COMMAND_PRIORITY_LOW,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $getNearestNodeFromDOMNode,
  $isElementNode,
  $getRoot,
  $createParagraphNode,
} from 'lexical';
import { createPortal } from 'react-dom';
import { Search, X, Grid } from 'lucide-react';

import { CommandOption, getAllCommandOptions } from './BlockMenuOptions';
import { TableGridPicker } from './TableGridPicker';

export const TOGGLE_SLASH_MENU_COMMAND: LexicalCommand<{
  rect: DOMRect;
  targetElement: HTMLElement;
}> = createCommand('TOGGLE_SLASH_MENU_COMMAND');

export const SLASH_MENU_STATE_CHANGED_COMMAND: LexicalCommand<{
  isOpen: boolean;
}> = createCommand('SLASH_MENU_STATE_CHANGED_COMMAND');

interface SlashCommandMenuProps {
  options: CommandOption[];
  selectedIndex: number | null;
  selectOptionAndCleanUp: (option: CommandOption) => void;
  setHighlightedIndex: (index: number) => void;
  rect: DOMRect;
  menuRef?: React.RefObject<HTMLDivElement>;
  isManual?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onClose?: () => void;
}

function getCategoryBadge(cat?: string): string {
  switch (cat) {
    case 'frequent':
      return 'Format';
    case 'media':
      return 'Media';
    case 'blocks':
      return 'Block';
    case 'advanced':
      return 'Tool';
    case 'danger':
      return 'Action';
    default:
      return '';
  }
}

function SlashCommandMenu({
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  rect,
  menuRef: externalMenuRef,
  isManual,
  searchQuery,
  onSearchChange,
  onClose,
}: SlashCommandMenuProps) {
  const internalMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = externalMenuRef || internalMenuRef;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Table grid picker state
  const [tablePickerAnchor, setTablePickerAnchor] = useState<DOMRect | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldTriggeredRef = useRef(false);
  const holdTouchStartPos = useRef<{ x: number; y: number } | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedIndex !== null && menuRef.current) {
      const selectedItem = menuRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, menuRef]);

  // Focus search input on open in manual mode
  useEffect(() => {
    if (isManual && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isManual]);

  const estimatedMenuHeight = Math.min(options.length * 44 + 60, 380);
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const flip = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

  // Comprehensive keyboard navigation handler for full accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (tablePickerAnchor) return; // Allow table picker to handle keys when open

    if (options.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = selectedIndex === null ? 0 : (selectedIndex + 1) % options.length;
      setHighlightedIndex(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = selectedIndex === null ? options.length - 1 : (selectedIndex - 1 + options.length) % options.length;
      setHighlightedIndex(prev);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      const next = selectedIndex === null ? 0 : Math.min(options.length - 1, (selectedIndex ?? 0) + 5);
      setHighlightedIndex(next);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      const prev = selectedIndex === null ? 0 : Math.max(0, (selectedIndex ?? 0) - 5);
      setHighlightedIndex(prev);
    } else if (e.key === 'Home') {
      if (e.target !== searchInputRef.current) {
        e.preventDefault();
        setHighlightedIndex(0);
      }
    } else if (e.key === 'End') {
      if (e.target !== searchInputRef.current) {
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const prev = selectedIndex === null ? options.length - 1 : (selectedIndex - 1 + options.length) % options.length;
        setHighlightedIndex(prev);
      } else {
        const next = selectedIndex === null ? 0 : (selectedIndex + 1) % options.length;
        setHighlightedIndex(next);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex !== null && options[selectedIndex]) {
        selectOptionAndCleanUp(options[selectedIndex]);
      } else if (options.length > 0) {
        selectOptionAndCleanUp(options[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
    }
  };

  const isSearching = Boolean(searchQuery && searchQuery.trim().length > 0);

  // Group items by category while strictly preserving their flat index for keyboard navigation
  const frequentItems: { option: CommandOption; index: number }[] = [];
  const mediaItems: { option: CommandOption; index: number }[] = [];
  const blockItems: { option: CommandOption; index: number }[] = [];
  const advancedItems: { option: CommandOption; index: number }[] = [];
  const dangerItems: { option: CommandOption; index: number }[] = [];

  options.forEach((option, index) => {
    if (option.category === 'frequent' || option.category === 'turnInto') {
      frequentItems.push({ option, index });
    } else if (option.category === 'media' || option.category === 'insert' || option.isMedia) {
      mediaItems.push({ option, index });
    } else if (option.category === 'blocks') {
      blockItems.push({ option, index });
    } else if (option.category === 'danger' || option.title === 'Delete Block') {
      dangerItems.push({ option, index });
    } else {
      advancedItems.push({ option, index });
    }
  });

  const renderOptionItem = ({ option, index }: { option: CommandOption; index: number }) => {
    const isSelected = selectedIndex === index;
    const isDanger = option.category === 'danger' || option.title === 'Delete Block';
    const isTable = option.title === 'Table';
    const categoryBadge = getCategoryBadge(option.category);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isTable) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isHoldTriggeredRef.current = false;
      holdTouchStartPos.current = { x: e.clientX, y: e.clientY };
      const btnRect = e.currentTarget.getBoundingClientRect();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        isHoldTriggeredRef.current = true;
        if (navigator.vibrate) {
          try {
            navigator.vibrate(40);
          } catch {}
        }
        setTablePickerAnchor(btnRect);
      }, 400); // 400ms hold/long-press
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!isTable || !holdTouchStartPos.current) return;
      const dist = Math.hypot(
        e.clientX - holdTouchStartPos.current.x,
        e.clientY - holdTouchStartPos.current.y
      );
      if (dist > 10) {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
      }
    };

    const handlePointerUp = () => {
      if (!isTable) return;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isTable) {
        e.preventDefault();
        e.stopPropagation();
        const btnRect = e.currentTarget.getBoundingClientRect();
        setTablePickerAnchor(btnRect);
      }
    };

    return (
      <button
        key={option.key || `${option.title}-${index}`}
        id={`slash-opt-${index}`}
        type="button"
        role="menuitem"
        data-selected={isSelected}
        aria-selected={isSelected}
        aria-label={`${option.title}${option.description ? `: ${option.description}` : ''}${option.shortcut ? ` (Shortcut: ${option.shortcut})` : ''}`}
        tabIndex={-1}
        className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all cursor-pointer select-none outline-none ${
          isSelected
            ? isDanger
              ? 'bg-red-500/15 text-red-600 dark:text-red-400 font-medium'
              : 'bg-black/8 dark:bg-white/14 text-black dark:text-white font-medium shadow-xs'
            : isDanger
            ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
            : 'text-black/75 dark:text-white/75 hover:bg-black/5 dark:hover:bg-white/8 hover:text-black dark:hover:text-white'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        onClick={() => {
          if (isTable && isHoldTriggeredRef.current) {
            isHoldTriggeredRef.current = false;
            return;
          }
          setHighlightedIndex(index);
          selectOptionAndCleanUp(option);
        }}
        onMouseEnter={() => {
          setHighlightedIndex(index);
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-7 w-7 flex items-center justify-center shrink-0 rounded-lg border transition-colors ${
              isSelected
                ? isDanger
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
                  : 'bg-white dark:bg-[#252528] text-black dark:text-white border-black/10 dark:border-white/15 shadow-xs'
                : isDanger
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                : 'bg-black/4 dark:bg-white/6 text-black/60 dark:text-white/60 border-black/6 dark:border-white/8'
            }`}
          >
            {option.menuIcon}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-medium leading-none truncate">
              {option.title}
            </span>
            {option.description && (
              <span className="text-[11px] text-black/45 dark:text-white/45 truncate leading-tight mt-1">
                {option.description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick custom grid picker button for Table option */}
          {isTable && (
            <span
              role="button"
              tabIndex={0}
              title="Custom grid (right-click or hold)"
              aria-label="Custom table grid"
              onClick={(e) => {
                e.stopPropagation();
                const btnRect =
                  e.currentTarget.closest('button')?.getBoundingClientRect() ||
                  e.currentTarget.getBoundingClientRect();
                setTablePickerAnchor(btnRect);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  const btnRect =
                    e.currentTarget.closest('button')?.getBoundingClientRect() ||
                    e.currentTarget.getBoundingClientRect();
                  setTablePickerAnchor(btnRect);
                }
              }}
              className="p-1 hover:bg-black/8 dark:hover:bg-white/12 text-black/40 hover:text-red-600 dark:text-white/40 dark:hover:text-red-400 rounded-lg transition-colors cursor-pointer"
            >
              <Grid size={13} />
            </span>
          )}

          {/* In search mode, show subtle category indicator */}
          {isSearching && categoryBadge && (
            <span className="text-[9px] font-medium border border-black/8 dark:border-white/12 text-black/50 dark:text-white/50 px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-black/3 dark:bg-white/5">
              {categoryBadge}
            </span>
          )}
          {option.shortcut && (
            <span className="text-[10px] font-mono font-medium border border-black/8 dark:border-white/12 bg-black/4 dark:bg-white/8 text-black/65 dark:text-white/70 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              {option.shortcut}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <div
        ref={menuRef}
        id="slash-command-options-menu"
        role="menu"
        aria-label="Slash commands"
        aria-activedescendant={selectedIndex !== null ? `slash-opt-${selectedIndex}` : undefined}
        data-slash-menu="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`fixed z-[100000] w-76 sm:w-84 max-h-[380px] overflow-y-auto bg-white/95 dark:bg-[#1c1c1f]/95 backdrop-blur-xl border border-black/8 dark:border-white/12 rounded-2xl shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] p-1.5 animate-in fade-in custom-scrollbar sticky-note-scrollbar outline-none ${
          flip ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
        } ${tablePickerAnchor ? 'hidden pointer-events-none' : ''}`}
        style={{
          top: flip ? undefined : rect.bottom + 6,
          bottom: flip ? window.innerHeight - rect.top + 6 : undefined,
          left: Math.max(12, Math.min(rect.left, window.innerWidth - 345)),
        }}
      >
        {/* Search Input when opened manually via 6-dot handler */}
        {isManual && (
          <div className="p-1 pb-1.5 border-b border-black/6 dark:border-white/8 mb-1">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/4 dark:bg-white/6 border border-black/7 dark:border-white/10 text-black/80 dark:text-white/80 focus-within:border-black/20 dark:focus-within:border-white/25 focus-within:bg-black/6 dark:focus-within:bg-white/10 transition-colors">
              <Search size={14} className="opacity-45 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                role="searchbox"
                aria-label="Filter commands"
                aria-controls="slash-command-options-menu"
                aria-autocomplete="list"
                value={searchQuery || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Filter commands (e.g. h1, todo, yt, table)..."
                className="w-full bg-transparent text-xs text-black dark:text-white placeholder-black/35 dark:placeholder-white/35 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  className="flex h-5 w-5 items-center justify-center text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {options.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-black/40 dark:text-white/40">
            No matching commands found
          </div>
        )}

        {/* 1. SEARCH RESULTS (Displayed directly in scored priority order) */}
        {isSearching && options.length > 0 && (
          <div role="group" aria-label="Search results">
            <div
              className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40"
              role="presentation"
            >
              Matching Commands
            </div>
            {options.map((option, index) => renderOptionItem({ option, index }))}
          </div>
        )}

        {/* 2. BROWSING MODE (Grouped into clean categories with MOST FREQUENT first) */}
        {!isSearching && options.length > 0 && (
          <>
            {/* Section 1: FREQUENT FORMATS (Headings, Checklist, Lists) */}
            {frequentItems.length > 0 && (
              <div role="group" aria-label="Frequent formats">
                <div
                  className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40"
                  role="presentation"
                >
                  Frequent Formats
                </div>
                {frequentItems.map(renderOptionItem)}
              </div>
            )}

            {/* Section 2: MEDIA & EMBEDS (YouTube, Images, Audio, Webcam, Paste) */}
            {mediaItems.length > 0 && (
              <div role="group" aria-label="Media and embeds">
                <div className="my-1 mx-2 h-px bg-black/6 dark:bg-white/8" />
                <div
                  className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40"
                  role="presentation"
                >
                  Media & Embeds
                </div>
                {mediaItems.map(renderOptionItem)}
              </div>
            )}

            {/* Section 3: CONTENT & STRUCTURE (Tables, Code Blocks, Quotes, Dividers, Text) */}
            {blockItems.length > 0 && (
              <div role="group" aria-label="Content and structure">
                <div className="my-1 mx-2 h-px bg-black/6 dark:bg-white/8" />
                <div
                  className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40"
                  role="presentation"
                >
                  Content & Structure
                </div>
                {blockItems.map(renderOptionItem)}
              </div>
            )}

            {/* Section 4: TOOLS & ACTIONS */}
            {advancedItems.length > 0 && (
              <div role="group" aria-label="Tools and actions">
                <div className="my-1 mx-2 h-px bg-black/6 dark:bg-white/8" />
                <div
                  className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40"
                  role="presentation"
                >
                  Tools & Actions
                </div>
                {advancedItems.map(renderOptionItem)}
              </div>
            )}

            {/* Section 5: DANGER (Delete Block) */}
            {dangerItems.length > 0 && (
              <div role="group" aria-label="Danger actions">
                <div className="my-1 mx-2 h-px bg-black/6 dark:bg-white/8" />
                {dangerItems.map(renderOptionItem)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Interactive Table Grid Picker (Displayed while slash command options are hidden) */}
      {tablePickerAnchor && (
        <TableGridPicker
          anchorRect={tablePickerAnchor}
          onClose={() => {
            setTablePickerAnchor(null);
            onClose?.();
          }}
          onSelect={(rows, cols, includeHeaders) => {
            setTablePickerAnchor(null);
            const tableOption = options.find((opt) => opt.title === 'Table') || options[0];
            if (tableOption) {
              (tableOption as any)._customTableDimensions = { rows, cols, includeHeaders };
              selectOptionAndCleanUp(tableOption);
            }
          }}
        />
      )}
    </>
  );
}

/**
 * Scores an option based on query match relevance
 */
export function scoreCommandOption(option: CommandOption, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = option.title.toLowerCase();

  // 1. Exact matches (highest priority)
  if (title === q) return 100;
  if (option.keywords?.some((k) => k.toLowerCase() === q)) return 95;
  if (option.shortcut?.toLowerCase() === q) return 90;

  // 2. Starts-with matches
  if (title.startsWith(q)) return 85;
  if (option.keywords?.some((k) => k.toLowerCase().startsWith(q))) return 75;

  // 3. Word starts-with (e.g., "video" matches "YouTube Video")
  const titleWords = title.split(/\s+/);
  if (titleWords.some((w) => w.startsWith(q))) return 65;

  // 4. Substring matches
  if (title.includes(q)) return 50;
  if (option.keywords?.some((k) => k.toLowerCase().includes(q))) return 40;
  if (option.description?.toLowerCase().includes(q)) return 20;

  return 0;
}

export function filterAndSortCommandOptions(
  allOptions: CommandOption[],
  query: string | null
): CommandOption[] {
  if (!query || query.trim() === '') {
    return allOptions;
  }
  const q = query.trim().toLowerCase();

  const scored: { option: CommandOption; score: number; originalIndex: number }[] = [];
  allOptions.forEach((option, index) => {
    const score = scoreCommandOption(option, q);
    if (score > 0) {
      scored.push({ option, score, originalIndex: index });
    }
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.originalIndex - b.originalIndex;
  });

  return scored.map((item) => item.option);
}

export default function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  // Manual menu state (triggered by 6-dot handler)
  const [manualMenuState, setManualMenuState] = useState<{
    rect: DOMRect;
    targetElement: HTMLElement;
  } | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSelectedIndex, setManualSelectedIndex] = useState(0);
  const manualMenuRef = useRef<HTMLDivElement>(null);
  const isTypeaheadActiveRef = useRef(false);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  // Most frequent options come first
  const allOptions = useMemo(() => getAllCommandOptions(), []);

  // Filtered and scored options for typeahead (typing '/')
  const options = useMemo(() => {
    return filterAndSortCommandOptions(allOptions, queryString);
  }, [allOptions, queryString]);

  // Filtered and scored options for manual menu (opened from 6-dot handler)
  const manualFilteredOptions = useMemo(() => {
    return filterAndSortCommandOptions(allOptions, manualSearchQuery);
  }, [allOptions, manualSearchQuery]);

  useEffect(() => {
    setManualSelectedIndex(0);
  }, [manualSearchQuery]);

  // Sync typeahead active state and broadcast state change
  const handleQueryChange = useCallback((query: string | null) => {
    setQueryString(query);
    const isOpen = query !== null;
    isTypeaheadActiveRef.current = isOpen;
    editor.dispatchCommand(SLASH_MENU_STATE_CHANGED_COMMAND, {
      isOpen: isOpen || manualMenuState !== null,
    });
  }, [editor, manualMenuState]);

  // Command listener for TOGGLE_SLASH_MENU_COMMAND from BlockHandlePlugin
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_SLASH_MENU_COMMAND,
      (payload) => {
        // If typeahead is active (e.g. user typed '/'), close typeahead by removing '/'
        if (isTypeaheadActiveRef.current) {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const anchorNode = selection.anchor.getNode();
              if ($isTextNode(anchorNode)) {
                const text = anchorNode.getTextContent();
                if (text === '/') {
                  anchorNode.remove();
                } else if (text.endsWith('/')) {
                  anchorNode.setTextContent(text.slice(0, -1));
                }
              }
            }
          });
          isTypeaheadActiveRef.current = false;
        }

        // If manual menu is open for the same element, toggle it closed
        if (manualMenuState && manualMenuState.targetElement === payload.targetElement) {
          setManualMenuState(null);
          editor.dispatchCommand(SLASH_MENU_STATE_CHANGED_COMMAND, { isOpen: false });
          return true;
        }

        // Open manual menu anchored to payload.rect
        setManualMenuState(payload);
        setManualSearchQuery('');
        setManualSelectedIndex(0);
        editor.dispatchCommand(SLASH_MENU_STATE_CHANGED_COMMAND, { isOpen: true });
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, manualMenuState]);

  // Selection callback for typeahead
  const onSelectOption = useCallback(
    (selectedOption: CommandOption, nodeToRemove: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        if (nodeToRemove) {
          nodeToRemove.remove();
        }
      });
      const extra = (selectedOption as any)._customTableDimensions;
      delete (selectedOption as any)._customTableDimensions;
      selectedOption.onSelect(editor, extra);
      closeMenu();
      isTypeaheadActiveRef.current = false;
      editor.dispatchCommand(SLASH_MENU_STATE_CHANGED_COMMAND, { isOpen: false });
    },
    [editor]
  );

  // Selection callback for manual menu (from 6-dot handler)
  const onManualSelectOption = useCallback(
    (option: CommandOption) => {
      const extra = (option as any)._customTableDimensions;
      delete (option as any)._customTableDimensions;
      const el = manualMenuState?.targetElement;
      if (el && el.isConnected) {
        if (option.title === 'Delete Block' || option.category === 'danger') {
          editor.update(() => {
            const node = $getNearestNodeFromDOMNode(el);
            if (node) {
              const parent = node.getParent();
              node.remove();
              if (parent && parent.getType() === 'list' && parent.getChildrenSize() === 0) {
                parent.remove();
              }
              const root = $getRoot();
              if (root.getChildrenSize() === 0) {
                root.append($createParagraphNode());
              }
            }
          });
        } else {
          editor.update(() => {
            const node = $getNearestNodeFromDOMNode(el);
            if (node) {
              if ($isElementNode(node)) {
                // If block has a lone '/', clean it up
                const firstChild = node.getFirstChild();
                if ($isTextNode(firstChild) && firstChild.getTextContent().trim() === '/') {
                  firstChild.remove();
                }
                node.select();
              } else if (node.getParent()) {
                node.getParent()?.select();
              }
            }
          });
          setTimeout(() => {
            editor.focus();
            option.onSelect(editor, extra);
          }, 0);
        }
      } else {
        editor.focus();
        option.onSelect(editor, extra);
      }
      setManualMenuState(null);
      editor.dispatchCommand(SLASH_MENU_STATE_CHANGED_COMMAND, { isOpen: false });
    },
    [editor, manualMenuState]
  );

  const closeManualMenu = useCallback(() => {
    setManualMenuState(null);
    editor.dispatchCommand(SLASH_MENU_STATE_CHANGED_COMMAND, { isOpen: false });
    editor.focus();
  }, [editor]);

  // Handle click-outside for manual menu
  useEffect(() => {
    if (!manualMenuState) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (manualMenuRef.current?.contains(target)) {
        return;
      }
      if (target.closest('[data-block-handle="true"]')) {
        return;
      }

      closeManualMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [manualMenuState, closeManualMenu]);

  // Handle scroll: ignore scrolls inside the slash menu itself; re-anchor or close only when scrolled out of view
  useEffect(() => {
    if (!manualMenuState) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      // 1. If scrolling inside the slash command menu, do not close or reposition
      if (target && (manualMenuRef.current?.contains(target) || target.closest?.('[data-slash-menu="true"]'))) {
        return;
      }

      // 2. If scrolling outer note container, update menu position so it stays attached
      if (manualMenuState.targetElement && manualMenuState.targetElement.isConnected) {
        const root = editor.getRootElement();
        const container = root?.closest('.sticky-note-scrollbar') || root?.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const targetRect = manualMenuState.targetElement.getBoundingClientRect();
          // If the block is scrolled completely out of container viewport, close menu
          if (targetRect.bottom < containerRect.top || targetRect.top > containerRect.bottom) {
            closeManualMenu();
            return;
          }
          // Re-anchor to handle button if present, or to targetRect
          const handleEl = document.querySelector<HTMLElement>('[data-block-handle="true"]');
          const newRect = handleEl ? handleEl.getBoundingClientRect() : targetRect;
          setManualMenuState((prev) => (prev ? { ...prev, rect: newRect } : null));
        }
      } else {
        closeManualMenu();
      }
    };

    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [manualMenuState, closeManualMenu, editor]);

  return (
    <>
      <LexicalTypeaheadMenuPlugin<CommandOption>
        onQueryChange={handleQueryChange}
        onSelectOption={onSelectOption}
        triggerFn={checkForTriggerMatch}
        options={options}
        menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
          if (anchorElementRef.current == null || options.length === 0 || manualMenuState !== null) {
            return null;
          }

          const rect = anchorElementRef.current.getBoundingClientRect();

          return createPortal(
            <SlashCommandMenu
              options={options}
              selectedIndex={selectedIndex}
              selectOptionAndCleanUp={selectOptionAndCleanUp}
              setHighlightedIndex={setHighlightedIndex}
              rect={rect}
              searchQuery={queryString || ''}
            />,
            document.body
          );
        }}
      />

      {manualMenuState && createPortal(
        <SlashCommandMenu
          options={manualFilteredOptions}
          selectedIndex={manualSelectedIndex}
          selectOptionAndCleanUp={onManualSelectOption}
          setHighlightedIndex={setManualSelectedIndex}
          rect={manualMenuState.rect}
          menuRef={manualMenuRef}
          isManual={true}
          searchQuery={manualSearchQuery}
          onSearchChange={setManualSearchQuery}
          onClose={closeManualMenu}
        />,
        document.body
      )}
    </>
  );
}
