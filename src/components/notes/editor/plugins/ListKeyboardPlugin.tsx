import React, { useEffect, useState, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $isRootNode,
  COMMAND_PRIORITY_HIGH,
  KEY_TAB_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  LexicalNode,
} from 'lexical';
import {
  $isListItemNode,
  $isListNode,
  $createListNode,
  ListItemNode,
} from '@lexical/list';
import { Indent, Outdent, Type } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * Checks if a list item has complex block/media children (table, image, etc.)
 */
function hasComplexChildren(item: ListItemNode): boolean {
  for (const child of item.getChildren()) {
    const type = child.getType();
    if (
      type === 'table' ||
      type === 'image' ||
      type === 'youtube' ||
      type === 'audio' ||
      type === 'code'
    ) {
      return true;
    }
  }
  return false;
}

export default function ListKeyboardPlugin() {
  const [editor] = useLexicalComposerContext();
  const [activeListItemInfo, setActiveListItemInfo] = useState<{
    isInList: boolean;
    listType: string;
    canOutdent: boolean;
    canIndent: boolean;
    isEmpty: boolean;
  }>({
    isInList: false,
    listType: '',
    canOutdent: false,
    canIndent: false,
    isEmpty: false,
  });

  const [editorContainer, setEditorContainer] = useState<HTMLElement | null>(null);

  // Locate the editor container element on mount
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (rootElement) {
      const container =
        rootElement.closest('.sticky-note-scrollbar') ||
        rootElement.parentElement ||
        rootElement;
      setEditorContainer(container as HTMLElement);
    }
  }, [editor]);

  // Keep track of active list item status for mobile helper UI
  const updateListStatus = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        setActiveListItemInfo({
          isInList: false,
          listType: '',
          canOutdent: false,
          canIndent: false,
          isEmpty: false,
        });
        return;
      }

      const anchor = selection.anchor.getNode();
      let listItem: ListItemNode | null = null;
      let curr: LexicalNode | null = anchor;

      while (curr && !$isRootNode(curr)) {
        if ($isListItemNode(curr)) {
          listItem = curr;
          break;
        }
        curr = curr.getParent();
      }

      if (!listItem) {
        setActiveListItemInfo({
          isInList: false,
          listType: '',
          canOutdent: false,
          canIndent: false,
          isEmpty: false,
        });
        return;
      }

      const parentList = listItem.getParent();
      const listType = $isListNode(parentList) ? parentList.getListType() : 'bullet';
      const indent = listItem.getIndent();
      const isNested = indent > 0 || ($isListNode(parentList) && $isListItemNode(parentList.getParent()));
      const canOutdent = isNested || indent > 0;
      const canIndent = listItem.getPreviousSibling() !== null;
      const text = listItem.getTextContent().trim();
      const isEmpty = text === '' && !hasComplexChildren(listItem);

      setActiveListItemInfo({
        isInList: true,
        listType,
        canOutdent,
        canIndent,
        isEmpty,
      });
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateListStatus();
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, updateListStatus]);

  // 1. INSERT_PARAGRAPH_COMMAND handler:
  // Keeps non-empty list items in their current list, while an empty item exits it.
  useEffect(() => {
    return editor.registerCommand(
      INSERT_PARAGRAPH_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchor = selection.anchor.getNode();
        let listItem: ListItemNode | null = null;
        let curr: LexicalNode | null = anchor;

        while (curr && !$isRootNode(curr)) {
          if ($isListItemNode(curr)) {
            listItem = curr;
            break;
          }
          curr = curr.getParent();
        }

        if (!listItem) {
          return false;
        }

        const parentList = listItem.getParent();
        if (!$isListNode(parentList)) {
          return false;
        }

        const finish = () => {
          setTimeout(updateListStatus, 0);
          return true;
        };
        const isEmpty = listItem.getTextContent().trim() === '' && !hasComplexChildren(listItem);

        if (!isEmpty) {
          // ListItemNode.insertNewAfter keeps the new item in this exact list,
          // preserving both checklist/bullet type and nesting level.
          selection.insertParagraph();
          return finish();
        }

        const indent = listItem.getIndent();
        const isNested = indent > 0 || $isListItemNode(parentList.getParent());
        if (isNested) {
          listItem.setIndent(Math.max(0, indent - 1));
          return finish();
        }

        const children = parentList.getChildren();
        const paragraph = $createParagraphNode();

        if (children.length <= 1) {
          parentList.replace(paragraph);
        } else if (listItem.is(parentList.getLastChild())) {
          listItem.remove();
          parentList.insertAfter(paragraph);
        } else if (listItem.is(parentList.getFirstChild())) {
          listItem.remove();
          parentList.insertBefore(paragraph);
        } else {
          const nextSiblings = listItem.getNextSiblings();
          const newList = $createListNode(parentList.getListType());
          newList.append(...nextSiblings);
          listItem.remove();
          parentList.insertAfter(paragraph);
          paragraph.insertAfter(newList);
        }

        paragraph.select();
        return finish();
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, updateListStatus]);

  // 2. KEY_TAB_COMMAND handler:
  // - Prevents default browser focus traversal and eliminates the page scrolling to top!
  // - Tab indents / nests the current bullet or checkbox
  // - Shift+Tab outdents / un-nests
  useEffect(() => {
    return editor.registerCommand(
      KEY_TAB_COMMAND,
      (event) => {
        // ALWAYS prevent default to stop browser scrolling to top
        event.preventDefault();

        let inList = false;
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;

          const anchor = selection.anchor.getNode();
          let curr: LexicalNode | null = anchor;
          while (curr && !$isRootNode(curr)) {
            if ($isListItemNode(curr) || $isListNode(curr)) {
              inList = true;
              break;
            }
            curr = curr.getParent();
          }
        });

        if (event.shiftKey) {
          // Shift + Tab: Outdent
          if (inList) {
            editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
          }
        } else {
          // Tab: Indent
          if (inList) {
            editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
          } else {
            // Regular text: insert 2 spaces
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.insertText('  ');
              }
            });
          }
        }

        setTimeout(updateListStatus, 10);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, updateListStatus]);

  // Touch handlers for mobile helper buttons
  const handleTouchOutdent = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch { }
    }
    editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
    setTimeout(() => {
      editor.focus();
      updateListStatus();
    }, 0);
  };

  const handleTouchIndent = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch { }
    }
    editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
    setTimeout(() => {
      editor.focus();
      updateListStatus();
    }, 0);
  };

  const handleTouchTurnToText = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch { }
    }

    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchor = selection.anchor.getNode();
      let listItem: ListItemNode | null = null;
      let curr: LexicalNode | null = anchor;

      while (curr && !$isRootNode(curr)) {
        if ($isListItemNode(curr)) {
          listItem = curr;
          break;
        }
        curr = curr.getParent();
      }

      if (!listItem) return;

      const parentList = listItem.getParent();
      if (!$isListNode(parentList)) return;

      const paragraph = $createParagraphNode();
      // Move all children of listItem into paragraph
      paragraph.append(...listItem.getChildren());

      if (parentList.getChildrenSize() <= 1) {
        parentList.replace(paragraph);
      } else {
        listItem.replace(paragraph);
      }
      paragraph.select();
    });

    setTimeout(() => {
      editor.focus();
      updateListStatus();
    }, 0);
  };

  // Only render mobile helper bar when inside a list item
  if (!activeListItemInfo.isInList) {
    return null;
  }

  // Render floating list action pill inside editor container (or portal to body)
  const pillContent = (
    <div
      role="toolbar"
      aria-label="List nesting tools"
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute bottom-2.5 right-3 z-20 flex items-center gap-1 p-1 bg-white/95 dark:bg-[#1c1c1f]/95 backdrop-blur-xl border border-black/8 dark:border-white/12 shadow-[0_12px_28px_-8px_rgba(0,0,0,0.3)] rounded-xl select-none text-[11px] animate-in fade-in"
    >
      <button
        type="button"
        onClick={handleTouchOutdent}
        disabled={!activeListItemInfo.canOutdent}
        title="Un-nest / Outdent (Shift+Tab)"
        aria-label="Un-nest list item (Shift+Tab)"
        className="flex items-center gap-1 px-2 py-1 border border-black/6 dark:border-white/10 bg-black/4 hover:bg-black/8 dark:bg-white/6 dark:hover:bg-white/10 text-black/75 dark:text-white/75 disabled:opacity-35 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer font-medium active:scale-95"
      >
        <Outdent size={13} className="shrink-0" />
        <span className="hidden xs:inline sm:inline">Outdent</span>
      </button>

      <button
        type="button"
        onClick={handleTouchIndent}
        disabled={!activeListItemInfo.canIndent}
        title="Nest / Indent (Tab)"
        aria-label="Nest list item (Tab)"
        className="flex items-center gap-1 px-2 py-1 border border-black/6 dark:border-white/10 bg-black/4 hover:bg-black/8 dark:bg-white/6 dark:hover:bg-white/10 text-black/75 dark:text-white/75 disabled:opacity-35 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer font-medium active:scale-95"
      >
        <Indent size={13} className="shrink-0" />
        <span className="hidden xs:inline sm:inline">Indent</span>
      </button>

      <span className="mx-0.5 h-3.5 w-px bg-black/8 dark:bg-white/10" />

      <button
        type="button"
        onClick={handleTouchTurnToText}
        title="Convert to normal paragraph text"
        aria-label="Convert to paragraph text"
        className="flex items-center gap-1 px-1.5 py-1 border border-black/6 dark:border-white/10 bg-black/4 hover:bg-black/8 dark:bg-white/6 dark:hover:bg-white/10 text-black/70 dark:text-white/70 rounded-lg transition-colors cursor-pointer font-medium active:scale-95"
      >
        <Type size={12} className="shrink-0 text-black/45 dark:text-white/45" />
        <span className="hidden sm:inline">Text</span>
      </button>
    </div>
  );

  if (editorContainer) {
    return createPortal(pillContent, editorContainer);
  }

  return pillContent;
}
