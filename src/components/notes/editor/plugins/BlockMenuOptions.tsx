import React from 'react';
import { LexicalEditor, LexicalNode, $getSelection, $isRangeSelection, $createParagraphNode, $isRootNode, $getRoot } from 'lexical';
import { MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND } from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { Type, List, ListOrdered, CheckSquare, Quote, Code, Heading1, Heading2, Heading3, Minus, ImageIcon, Camera, Mic, Table, ListTodo, ArrowUpToLine, ArrowDownToLine, SlidersHorizontal, Trash2, ClipboardPaste, Youtube } from 'lucide-react';
import { INSERT_TABLE_COMMAND, $createTableNodeWithDimensions, TableRowNode, TableCellNode } from '@lexical/table';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { $createTextNode } from 'lexical';
import { INSERT_IMAGE_COMMAND } from './ImagePlugin';
import { INSERT_AUDIO_COMMAND } from './AudioPlugin';
import { INSERT_YOUTUBE_COMMAND } from './YouTubePlugin';
import { extractYouTubeId } from '../nodes/YouTubeNode';
import { OPEN_CAMERA_MODAL_COMMAND, OPEN_AUDIO_MODAL_COMMAND } from './MediaModalsPlugin';
import { OPEN_CURSOR_TOOLBAR_COMMAND } from './CursorToolbarPlugin';

export class CommandOption extends MenuOption {
  title: string;
  menuIcon: React.ReactNode;
  onSelect: (editor: LexicalEditor, extra?: any) => void;
  isMedia?: boolean;
  type?: 'image' | 'camera' | 'audio' | 'video';
  category?: 'frequent' | 'media' | 'blocks' | 'advanced' | 'danger' | 'insert' | 'turnInto';
  description?: string;
  keywords?: string[];
  shortcut?: string;

  constructor(
    title: string,
    menuIcon: React.ReactNode,
    options: {
      onSelect: (editor: LexicalEditor, extra?: any) => void;
      isMedia?: boolean;
      type?: 'image' | 'camera' | 'audio' | 'video';
      category?: 'frequent' | 'media' | 'blocks' | 'advanced' | 'danger' | 'insert' | 'turnInto';
      description?: string;
      keywords?: string[];
      shortcut?: string;
    }
  ) {
    super(title);
    this.title = title;
    this.menuIcon = menuIcon;
    this.onSelect = options.onSelect;
    this.isMedia = options.isMedia;
    this.type = options.type;
    this.category = options.category;
    this.description = options.description;
    this.keywords = options.keywords;
    this.shortcut = options.shortcut;
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

/** The note this editor belongs to; media is stored against it. */
const noteIdOf = (editor: LexicalEditor) => editor._config.namespace.replace('StickyNoteEditor-', '');

/**
 * Opens the file picker and puts whatever comes back into the note.
 */
const pickImages = (editor: LexicalEditor) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);

  const done = () => input.remove();
  input.addEventListener('change', () => {
    const noteId = noteIdOf(editor);
    Array.from(input.files || []).forEach((file) => {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId, file });
    });
    done();
  });
  input.addEventListener('cancel', done);
  input.click();
};

/**
 * Puts whatever is on the clipboard into the note at the cursor.
 */
export const pasteFromClipboard = async (editor: LexicalEditor) => {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const file = new File([blob], `pasted.${imageType.split('/')[1] || 'png'}`, { type: imageType });
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, { noteId: noteIdOf(editor), file });
        return true;
      }
    }
  } catch {
    // No permission, or the clipboard holds something unreadable: text is still worth a try.
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text) return false;
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
        return;
      }
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      $getRoot().append(paragraph);
      paragraph.selectEnd();
    });
    return true;
  } catch (err) {
    console.warn('The clipboard could not be read', err);
    return false;
  }
};

/**
 * 1. MOST FREQUENT FORMATS (Shown first for immediate accessibility)
 * These represent the top formatting actions used in notes.
 */
export const getFrequentOptions = () => [
  new CommandOption('Heading 1', <Heading1 size={16} />, {
    category: 'frequent',
    description: 'Large section heading',
    shortcut: '#',
    keywords: ['heading 1', 'h1', 'header 1', 'title', 'large'],
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
    category: 'frequent',
    description: 'Medium section heading',
    shortcut: '##',
    keywords: ['heading 2', 'h2', 'header 2', 'subtitle', 'medium'],
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
    category: 'frequent',
    description: 'Small subsection heading',
    shortcut: '###',
    keywords: ['heading 3', 'h3', 'header 3', 'subheading', 'small'],
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode('h3'));
        }
      });
    },
  }),
  new CommandOption('Checklist', <CheckSquare size={16} />, {
    category: 'frequent',
    description: 'Track tasks with interactive to-dos',
    shortcut: '[]',
    keywords: ['checklist', 'todo', 'task', 'check', 'done', 'to-do'],
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined as any);
    },
  }),
  new CommandOption('Bulleted List', <List size={16} />, {
    category: 'frequent',
    description: 'Create a simple bulleted list',
    shortcut: '•',
    keywords: ['bullet', 'bulleted list', 'ul', 'list', 'points', 'unordered'],
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined as any);
    },
  }),
  new CommandOption('Numbered List', <ListOrdered size={16} />, {
    category: 'frequent',
    description: 'Create an ordered numbered list',
    shortcut: '1.',
    keywords: ['number', 'numbered list', 'ol', 'ordered', '1.'],
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined as any);
    },
  }),
];

/**
 * 2. MEDIA & EMBEDS
 */
export const getMediaOptions = () => [
  new CommandOption('YouTube Video', <Youtube size={16} className="text-red-600" />, {
    isMedia: true,
    type: 'video',
    category: 'media',
    description: 'Embed a playable YouTube video',
    shortcut: 'YT',
    keywords: ['youtube', 'video', 'embed', 'player', 'yt'],
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_YOUTUBE_COMMAND, {
        videoId: '',
        url: '',
      });
    },
  }),
  new CommandOption('Image Upload', <ImageIcon size={16} />, {
    isMedia: true,
    type: 'image',
    category: 'media',
    description: 'Upload and embed an image file',
    shortcut: 'IMG',
    keywords: ['image', 'img', 'photo', 'picture', 'upload'],
    onSelect: (editor) => setTimeout(() => pickImages(editor), 0),
  }),
  new CommandOption('Paste from clipboard', <ClipboardPaste size={16} />, {
    category: 'media',
    description: 'Paste text or image from clipboard',
    shortcut: 'Clip',
    keywords: ['paste', 'clipboard', 'clip'],
    onSelect: (editor) => setTimeout(() => { void pasteFromClipboard(editor); }, 0),
  }),
  new CommandOption('Camera Capture', <Camera size={16} />, {
    isMedia: true,
    type: 'camera',
    category: 'media',
    description: 'Capture a photo using your camera',
    shortcut: 'Cam',
    keywords: ['camera', 'photo', 'snapshot', 'webcam'],
    onSelect: (editor) => setTimeout(() => editor.dispatchCommand(OPEN_CAMERA_MODAL_COMMAND, undefined), 0),
  }),
  new CommandOption('Audio Recording', <Mic size={16} />, {
    isMedia: true,
    type: 'audio',
    category: 'media',
    description: 'Record a voice or audio clip',
    shortcut: 'Mic',
    keywords: ['audio', 'mic', 'voice', 'record', 'sound'],
    onSelect: (editor) => setTimeout(() => editor.dispatchCommand(OPEN_AUDIO_MODAL_COMMAND, undefined), 0),
  }),
];

/**
 * 3. CONTENT BLOCKS & STRUCTURE
 */
export const getBlocksOptions = () => [
  new CommandOption('Table', <Table size={16} />, {
    category: 'blocks',
    description: 'Insert table (3x3 or hold / right-click for custom grid)',
    shortcut: 'Table',
    keywords: ['table', 'grid', 'rows', 'columns', 'sheet'],
    onSelect: (editor, extra?: { rows?: number; cols?: number; includeHeaders?: boolean }) => {
      const rows = extra?.rows ?? 3;
      const cols = extra?.cols ?? 3;
      const includeHeaders = extra?.includeHeaders ?? true;
      setTimeout(() => {
        editor.dispatchCommand(INSERT_TABLE_COMMAND, {
          columns: String(cols),
          rows: String(rows),
          includeHeaders: includeHeaders,
        });
      }, 0);
    },
  }),
  new CommandOption('Code Block', <Code size={16} />, {
    category: 'blocks',
    description: 'Capture code with syntax highlighting',
    shortcut: '```',
    keywords: ['code', 'code block', 'snippet', 'pre', 'script', 'ts', 'js'],
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode('typescript'));
        }
      });
    },
  }),
  new CommandOption('Quote', <Quote size={16} />, {
    category: 'blocks',
    description: 'Capture a quotation or callout',
    shortcut: '>',
    keywords: ['quote', 'blockquote', 'callout', 'cite'],
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
    category: 'blocks',
    description: 'Visually divide blocks with a line',
    shortcut: '---',
    keywords: ['divider', 'hr', 'line', 'rule', 'separator', 'break'],
    onSelect: (editor) => {
      editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
    },
  }),
  new CommandOption('Text', <Type size={16} />, {
    category: 'blocks',
    description: 'Start writing with plain paragraph text',
    shortcut: 'P',
    keywords: ['text', 'p', 'paragraph', 'plain', 'normal'],
    onSelect: (editor) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    },
  }),
];

/**
 * 4. TOOLS & ADVANCED ACTIONS
 */
export const getAdvancedOptions = () => [
  new CommandOption('Todo Table', <ListTodo size={16} />, {
    category: 'advanced',
    description: '2-column To Do / Done table',
    shortcut: 'Kanban',
    keywords: ['todo table', 'kanban', 'tasks', 'board'],
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
  new CommandOption('Open Overlay', <SlidersHorizontal size={16} />, {
    category: 'advanced',
    description: 'Open font & text styling overlay',
    shortcut: 'Style',
    keywords: ['overlay', 'toolbar', 'format', 'style'],
    onSelect: (editor) => {
      setTimeout(() => {
        editor.dispatchCommand(OPEN_CURSOR_TOOLBAR_COMMAND, undefined);
      }, 30);
    },
  }),
  new CommandOption('Add line above', <ArrowUpToLine size={16} />, {
    category: 'advanced',
    description: 'Insert an empty line above',
    shortcut: 'Above',
    keywords: ['above', 'add line above', 'insert above'],
    onSelect: (editor) => addBlock(editor, 'before'),
  }),
  new CommandOption('Add line below', <ArrowDownToLine size={16} />, {
    category: 'advanced',
    description: 'Insert an empty line below',
    shortcut: 'Below',
    keywords: ['below', 'add line below', 'insert below'],
    onSelect: (editor) => addBlock(editor, 'after'),
  }),
];

/**
 * 5. DANGER ACTIONS
 */
export const getDeleteOption = () =>
  new CommandOption('Delete Block', <Trash2 size={16} />, {
    category: 'danger',
    description: 'Delete this block or list item',
    shortcut: 'Del',
    keywords: ['delete', 'remove', 'trash', 'clear', 'del'],
    onSelect: (editor) => deleteBlock(editor),
  });

/** Backward-compatible export */
export const getBaseOptions = () => [
  ...getFrequentOptions(),
  ...getBlocksOptions(),
  ...getAdvancedOptions(),
];

/**
 * Ordered all-options:
 * 1. Frequent Formats (Headings, Checklist, Lists)
 * 2. Media & Embeds (YouTube, Image, Camera, Audio, Paste)
 * 3. Blocks & Structure (Table, Code, Quote, Divider, Text)
 * 4. Tools & Actions (Todo Table, Overlay, Add line)
 * 5. Danger (Delete)
 */
export const getAllCommandOptions = (): CommandOption[] => [
  ...getFrequentOptions(),
  ...getMediaOptions(),
  ...getBlocksOptions(),
  ...getAdvancedOptions(),
  getDeleteOption(),
];
