import React, { useCallback, useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalTypeaheadMenuPlugin, MenuOption, useBasicTypeaheadTriggerMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode, HeadingTagType } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $getSelection, $isRangeSelection, LexicalEditor, TextNode } from 'lexical';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { Type, List, ListOrdered, CheckSquare, Quote, Code, Heading1, Heading2, Heading3 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { $createParagraphNode } from 'lexical';

class CommandOption extends MenuOption {
  title: string;
  menuIcon: React.ReactNode;
  onSelect: (editor: LexicalEditor) => void;

  constructor(title: string, menuIcon: React.ReactNode, options: { onSelect: (editor: LexicalEditor) => void }) {
    super(title);
    this.title = title;
    this.menuIcon = menuIcon;
    this.onSelect = options.onSelect;
  }
}

export default function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
    minLength: 0,
  });

  const options = useMemo(() => {
    const baseOptions = [
      new CommandOption('Text', <Type size={16} />, {
        onSelect: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createParagraphNode());
            }
          });
        },
      }),
      new CommandOption('Heading 1', <Heading1 size={16} />, {
        onSelect: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode('h1'));
            }
          });
        },
      }),
      new CommandOption('Heading 2', <Heading2 size={16} />, {
        onSelect: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode('h2'));
            }
          });
        },
      }),
      new CommandOption('Heading 3', <Heading3 size={16} />, {
        onSelect: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode('h3'));
            }
          });
        },
      }),
      new CommandOption('Bulleted List', <List size={16} />, {
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined as any);
        },
      }),
      new CommandOption('Numbered List', <ListOrdered size={16} />, {
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined as any);
        },
      }),
      new CommandOption('Checklist', <CheckSquare size={16} />, {
        onSelect: (editor) => {
          editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined as any);
        },
      }),
      new CommandOption('Quote', <Quote size={16} />, {
        onSelect: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createQuoteNode());
            }
          });
        },
      }),
      new CommandOption('Code Block', <Code size={16} />, {
        onSelect: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createCodeNode('typescript'));
            }
          });
        },
      }),
    ];

    if (!queryString) return baseOptions;
    
    return baseOptions.filter((option) => {
      return new RegExp(queryString, 'gi').exec(option.title);
    });
  }, [queryString]);

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
        const estimatedMenuHeight = Math.min(options.length * 40 + 30, 330);
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        const flip = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

        return createPortal(
          <div
            className="fixed z-[10000] w-64 max-h-80 overflow-y-auto bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-2xl p-1"
            style={{
              top: flip ? undefined : rect.bottom + 8,
              bottom: flip ? window.innerHeight - rect.top + 8 : undefined,
              left: Math.min(rect.left, window.innerWidth - 260),
            }}
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
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
