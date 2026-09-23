import React, { useCallback, useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalTypeaheadMenuPlugin, MenuOption, useBasicTypeaheadTriggerMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $getSelection, $isRangeSelection, LexicalEditor, TextNode } from 'lexical';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { Type, List, ListOrdered, CheckSquare, Quote, Code, Heading1, Heading2, Heading3, ImageIcon, Camera, Mic, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { $createParagraphNode } from 'lexical';

import { CommandOption, getBaseOptions, deleteBlock } from './BlockMenuOptions';

export default function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  const baseOptions = useMemo(() => getBaseOptions(), []);

  const options = useMemo(() => {
    if (!queryString) return baseOptions;
    
    return baseOptions.filter((option) => {
      return new RegExp(queryString, 'gi').exec(option.title);
    });
  }, [baseOptions, queryString]);

  const deleteLineOption = useMemo(
    () =>
      new CommandOption('Delete line', <Trash2 size={15} />, {
        onSelect: (editor) => deleteBlock(editor),
      }),
    []
  );

  const quickActions = useMemo(() => {
    return [
      {
        title: 'Image Upload',
        shortLabel: 'Image',
        icon: <ImageIcon size={15} />,
        colorClass: 'text-blue-500 bg-blue-500/10 group-hover:bg-blue-500/20',
        option: baseOptions.find((o) => o.title === 'Image Upload'),
      },
      {
        title: 'Camera Capture',
        shortLabel: 'Camera',
        icon: <Camera size={15} />,
        colorClass: 'text-emerald-500 bg-emerald-500/10 group-hover:bg-emerald-500/20',
        option: baseOptions.find((o) => o.title === 'Camera Capture'),
      },
      {
        title: 'Audio Recording',
        shortLabel: 'Audio',
        icon: <Mic size={15} />,
        colorClass: 'text-amber-500 bg-amber-500/10 group-hover:bg-amber-500/20',
        option: baseOptions.find((o) => o.title === 'Audio Recording'),
      },
      {
        title: 'Delete line',
        shortLabel: 'Delete line',
        icon: <Trash2 size={15} />,
        colorClass: 'text-red-500 bg-red-500/10 group-hover:bg-red-500/20',
        option: deleteLineOption,
      },
    ];
  }, [baseOptions, deleteLineOption]);

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
        if (anchorElementRef.current == null || (options.length === 0 && !queryString)) {
          return null;
        }

        const rect = anchorElementRef.current.getBoundingClientRect();
        const estimatedMenuHeight = Math.min(options.length * 40 + 90, 360);
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        const flip = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

        return createPortal(
          <div
            className="fixed z-[100000] w-72 max-h-84 overflow-y-auto bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-2xl p-1.5"
            style={{
              top: flip ? undefined : rect.bottom + 8,
              bottom: flip ? window.innerHeight - rect.top + 8 : undefined,
              left: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
            }}
          >
            {/* Quick Actions Header Row */}
            <div className="mb-1.5 p-1 bg-black/[0.03] dark:bg-white/[0.04] rounded-lg border border-black/5 dark:border-white/5">
              <div className="grid grid-cols-4 gap-1">
                {quickActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    title={action.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (action.option) {
                        selectOptionAndCleanUp(action.option);
                      }
                    }}
                    className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-black/75 dark:text-white/75 hover:bg-black/5 dark:hover:bg-white/10 transition-all group select-none active:scale-95"
                  >
                    <div className={`p-1.5 rounded-md ${action.colorClass} transition-transform group-hover:scale-110`}>
                      {action.icon}
                    </div>
                    <span className="text-[9.5px] font-medium mt-1 truncate max-w-full text-black/65 dark:text-white/65 group-hover:text-black dark:group-hover:text-white">
                      {action.shortLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
              Basic Blocks
            </div>
            {options.map((option, i) => (
              <button
                key={option.key}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                  selectedIndex === i
                    ? 'bg-black/5 dark:bg-white/10 text-black dark:text-white'
                    : 'text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                onClick={() => {
                  setHighlightedIndex(i);
                  selectOptionAndCleanUp(option);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(i);
                }}
              >
                <div className={`p-1.5 rounded-md ${selectedIndex === i ? 'bg-white shadow-sm dark:bg-black' : 'bg-black/5 dark:bg-white/5'}`}>
                  {option.menuIcon}
                </div>
                {option.title}
              </button>
            ))}
          </div>,
          document.body
        );
      }}
    />
  );
}
