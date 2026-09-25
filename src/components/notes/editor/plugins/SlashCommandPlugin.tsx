import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalTypeaheadMenuPlugin, useBasicTypeaheadTriggerMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { TextNode } from 'lexical';
import { createPortal } from 'react-dom';

import { CommandOption, getBaseOptions, getMediaOptions, getDeleteOption } from './BlockMenuOptions';

interface SlashCommandMenuProps {
  options: CommandOption[];
  selectedIndex: number | null;
  selectOptionAndCleanUp: (option: CommandOption) => void;
  setHighlightedIndex: (index: number) => void;
  rect: DOMRect;
}

function SlashCommandMenu({
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  rect,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedIndex !== null && menuRef.current) {
      const selectedItem = menuRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const estimatedMenuHeight = Math.min(options.length * 38 + 60, 320);
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const flip = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

  // Partition options while preserving their flat index in `options` for keyboard navigation
  const insertItems: { option: CommandOption; index: number }[] = [];
  const turnIntoItems: { option: CommandOption; index: number }[] = [];
  const dangerItems: { option: CommandOption; index: number }[] = [];

  options.forEach((option, index) => {
    if (option.category === 'insert' || option.isMedia || option.title === 'Paste from clipboard') {
      insertItems.push({ option, index });
    } else if (option.category === 'danger' || option.title === 'Delete Block' || option.title === 'Delete line') {
      dangerItems.push({ option, index });
    } else {
      turnIntoItems.push({ option, index });
    }
  });

  return (
    <div
      ref={menuRef}
      className={`fixed z-[100000] w-64 max-h-80 overflow-y-auto bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-2xl p-1 animate-in fade-in custom-scrollbar sticky-note-scrollbar ${
        flip ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
      }`}
      style={{
        top: flip ? undefined : rect.bottom + 6,
        bottom: flip ? window.innerHeight - rect.top + 6 : undefined,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 272)),
      }}
    >
      {/* Insert Section */}
      {insertItems.length > 0 && (
        <>
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
            Insert
          </div>
          {insertItems.map(({ option, index }) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={option.key}
                type="button"
                data-selected={isSelected}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isSelected
                    ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white'
                    : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                onClick={() => {
                  setHighlightedIndex(index);
                  selectOptionAndCleanUp(option);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                }}
              >
                <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white shadow-sm dark:bg-black' : 'bg-black/5 dark:bg-white/5'}`}>
                  {option.menuIcon}
                </div>
                {option.title}
              </button>
            );
          })}
        </>
      )}

      {/* Turn into Section */}
      {turnIntoItems.length > 0 && (
        <>
          {insertItems.length > 0 && (
            <div className="my-1 mx-2 h-px bg-black/5 dark:bg-white/10" />
          )}
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
            Turn into
          </div>
          {turnIntoItems.map(({ option, index }) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={option.key}
                type="button"
                data-selected={isSelected}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isSelected
                    ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white'
                    : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                onClick={() => {
                  setHighlightedIndex(index);
                  selectOptionAndCleanUp(option);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                }}
              >
                <div className={`p-1.5 rounded-md ${isSelected ? 'bg-white shadow-sm dark:bg-black' : 'bg-black/5 dark:bg-white/5'}`}>
                  {option.menuIcon}
                </div>
                {option.title}
              </button>
            );
          })}
        </>
      )}

      {/* Danger / Delete Section */}
      {dangerItems.length > 0 && (
        <>
          {(insertItems.length > 0 || turnIntoItems.length > 0) && (
            <div className="my-1 mx-2 h-px bg-black/5 dark:bg-white/10" />
          )}
          {dangerItems.map(({ option, index }) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={option.key}
                type="button"
                data-selected={isSelected}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  isSelected
                    ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                }`}
                onClick={() => {
                  setHighlightedIndex(index);
                  selectOptionAndCleanUp(option);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(index);
                }}
              >
                <div className={`p-1.5 rounded-md ${
                  isSelected 
                    ? 'bg-red-500/20 dark:bg-red-500/30 text-red-600 dark:text-red-400' 
                    : 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {option.menuIcon}
                </div>
                {option.title}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  // Media options ('Insert') first, then base options ('Turn into'), then delete block ('Danger')
  // This matches the exact structure of the first image option menu
  const allOptions = useMemo(() => [
    ...getMediaOptions(),
    ...getBaseOptions(),
    getDeleteOption(),
  ], []);

  const options = useMemo(() => {
    if (!queryString) return allOptions;
    
    return allOptions.filter((option) => {
      return new RegExp(queryString, 'gi').exec(option.title);
    });
  }, [allOptions, queryString]);

  const onSelectOption = useCallback(
    (selectedOption: CommandOption, nodeToRemove: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        if (nodeToRemove) {
          nodeToRemove.remove();
        }
      });
      selectedOption.onSelect(editor);
      closeMenu();
    },
    [editor]
  );

  return (
    <LexicalTypeaheadMenuPlugin<CommandOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (anchorElementRef.current == null || options.length === 0) {
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
          />,
          document.body
        );
      }}
    />
  );
}
