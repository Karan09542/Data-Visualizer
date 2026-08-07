import React from 'react';
import { LexicalEditor, $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical';
import { MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { Type, List, ListOrdered, CheckSquare, Quote, Code, Heading1, Heading2, Heading3, Minus, ImageIcon, Camera, Mic, Table, ListTodo } from 'lucide-react';
import { INSERT_TABLE_COMMAND, $createTableNodeWithDimensions, TableRowNode, TableCellNode } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { $createTextNode } from 'lexical';
import { INSERT_IMAGE_COMMAND } from './ImagePlugin';
import { INSERT_AUDIO_COMMAND } from './AudioPlugin';
import { OPEN_CAMERA_MODAL_COMMAND, OPEN_AUDIO_MODAL_COMMAND } from './MediaModalsPlugin';

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
  new CommandOption('Image Upload', <ImageIcon size={16} />, {
    isMedia: true,
    type: 'image',
    onSelect: (editor) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const noteId = editor._config.namespace.replace('StickyNoteEditor-', '');
          editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file });
        }
      };
      input.click();
    },
  }),
  new CommandOption('Camera Capture', <Camera size={16} />, {
    isMedia: true,
    type: 'camera',
    onSelect: (editor) => {
      editor.dispatchCommand(OPEN_CAMERA_MODAL_COMMAND, undefined);
    },
  }),
  new CommandOption('Audio Recording', <Mic size={16} />, {
    isMedia: true,
    type: 'audio',
    onSelect: (editor) => {
      editor.dispatchCommand(OPEN_AUDIO_MODAL_COMMAND, undefined);
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
];
