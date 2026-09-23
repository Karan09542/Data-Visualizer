import React from 'react';
import { LexicalEditor, LexicalNode, $getSelection, $isRangeSelection, $createParagraphNode, $isRootNode, $getRoot } from 'lexical';
import { MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { Type, List, ListOrdered, CheckSquare, Quote, Code, Heading1, Heading2, Heading3, Minus, ImageIcon, Camera, Mic, Table, ListTodo, ArrowUpToLine, ArrowDownToLine, SlidersHorizontal, Trash2 } from 'lucide-react';
import { INSERT_TABLE_COMMAND, $createTableNodeWithDimensions, TableRowNode, TableCellNode } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { $createTextNode } from 'lexical';
import { INSERT_IMAGE_COMMAND } from './ImagePlugin';
import { INSERT_AUDIO_COMMAND } from './AudioPlugin';
import { OPEN_CAMERA_MODAL_COMMAND, OPEN_AUDIO_MODAL_COMMAND } from './MediaModalsPlugin';
import { OPEN_CURSOR_TOOLBAR_COMMAND } from './CursorToolbarPlugin';

export class CommandOption extends MenuOption {
  title: string;
  menuIcon: React.ReactNode;
  onSelect: (editor: LexicalEditor) => void;
  isMedia?: boolean;
  type?: 'image' | 'camera' | 'audio';

  constructor(title: string, menuIcon: React.ReactNode, options: { onSelect: (editor: LexicalEditor) => void, isMedia?: boolean, type?: 'image' | 'camera' | 'audio' }) {
    super(title);
    this.title = title;
    this.menuIcon = menuIcon;
    this.onSelect = options.onSelect;
    this.isMedia = options.isMedia;
    this.type = options.type;
  }
}

/**
 * Climbs to the block that sits directly in the document.
 *
 * getTopLevelElement() stops at the nearest shadow root, and a table cell is one, so from inside
 * a table it hands back the paragraph in that cell. Walking up to the real root instead means a
 * new line lands outside the table rather than inside a cell.
 */
const rootLevelBlock = (node: LexicalNode): LexicalNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (parent === null) return null;
    if ($isRootNode(parent)) return current;
    current = parent;
  }
  return null;
};

/** Puts an empty paragraph either side of the block the cursor is in, and moves there */
const addBlock = (editor: LexicalEditor, where: 'before' | 'after') => {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const block = rootLevelBlock(selection.anchor.getNode());
    if (!block) return;

    const paragraph = $createParagraphNode();
    if (where === 'before') block.insertBefore(paragraph);
    else block.insertAfter(paragraph);
    paragraph.select();
  });
};

/** Finds the line-level or root-level block to delete (handles list items and top blocks) */
const targetLineBlock = (node: LexicalNode): LexicalNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (parent === null) return null;
    if (current.getType() === 'listitem') return current;
    if ($isRootNode(parent)) return current;
    current = parent;
  }
  return null;
};

/** Deletes the block/line the cursor is in, and moves selection to neighbor */
export const deleteBlock = (editor: LexicalEditor) => {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const block = targetLineBlock(selection.anchor.getNode());
    if (!block) return;

    const parent = block.getParent();
    const prevSibling = block.getPreviousSibling();
    const nextSibling = block.getNextSibling();
    block.remove();

    if (parent && parent.getType() === 'list' && parent.getChildrenSize() === 0) {
      const listPrev = parent.getPreviousSibling();
      const listNext = parent.getNextSibling();
      parent.remove();
      if (listPrev && typeof (listPrev as any).select === 'function') {
        (listPrev as any).select();
        return;
      } else if (listNext && typeof (listNext as any).select === 'function') {
        (listNext as any).select();
        return;
      }
    }

    if (prevSibling && typeof (prevSibling as any).select === 'function') {
      (prevSibling as any).select();
    } else if (nextSibling && typeof (nextSibling as any).select === 'function') {
      (nextSibling as any).select();
    } else {
      const root = $getRoot();
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      paragraph.select();
    }
  });
};

export const getBaseOptions = () => [
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
  new CommandOption('Open Overlay', <SlidersHorizontal size={16} />, {
    onSelect: (editor) => {
      setTimeout(() => {
        editor.dispatchCommand(OPEN_CURSOR_TOOLBAR_COMMAND, undefined);
      }, 30);
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
  new CommandOption('Divider', <Minus size={16} />, {
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
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
  new CommandOption('Table', <Table size={16} />, {
    onSelect: (editor) => {
      // Defer the command to the next tick so the Slash Menu removal update finishes
      // and the selection settles properly into a RangeSelection.
      setTimeout(() => {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, {
          columns: '3',
          rows: '3',
          includeHeaders: true,
        });
      }, 0);
    },
  }),
  new CommandOption('Todo Table', <ListTodo size={16} />, {
    onSelect: (editor) => {
      setTimeout(() => {
        editor.update(() => {
          const tableNode = $createTableNodeWithDimensions(2, 2, true);
          const rows = tableNode.getChildren();

          if (rows.length >= 2) {
            const headerRow = rows[0] as TableRowNode;
            const headerCells = headerRow.getChildren() as TableCellNode[];
            if (headerCells[0]) {
              headerCells[0].clear();
              headerCells[0].append($createParagraphNode().append($createTextNode('To Do')));
            }
            if (headerCells[1]) {
              headerCells[1].clear();
              headerCells[1].append($createParagraphNode().append($createTextNode('Done')));
            }

            const bodyRow = rows[1] as TableRowNode;
            const bodyCells = bodyRow.getChildren() as TableCellNode[];
            if (bodyCells[0]) {
              bodyCells[0].clear();
              const listNode = $createListNode('check');
              const listItemNode = $createListItemNode();
              listNode.append(listItemNode);
              bodyCells[0].append(listNode);
            }
          }

          $insertNodeToNearestRoot(tableNode);
        });
      }, 0);
    },
  }),
  new CommandOption('Add line above', <ArrowUpToLine size={16} />, {
    onSelect: (editor) => addBlock(editor, 'before'),
  }),
  new CommandOption('Add line below', <ArrowDownToLine size={16} />, {
    onSelect: (editor) => addBlock(editor, 'after'),
  }),
];
