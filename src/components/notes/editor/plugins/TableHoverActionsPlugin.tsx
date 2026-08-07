import React, { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getNearestNodeFromDOMNode, LexicalEditor } from 'lexical';
import {
  $isTableNode,
  $isTableCellNode,
  $isTableRowNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  $insertTableRow__EXPERIMENTAL,
  $insertTableColumn__EXPERIMENTAL,
} from '@lexical/table';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

export default function TableHoverActionsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [tableKey, setTableKey] = useState<string | null>(null);
  const [tableRect, setTableRect] = useState<DOMRect | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isTodo, setIsTodo] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      let target = e.target as HTMLElement;
      let tableElement = target.closest('.editor-table, table');

      if (tableElement) {
        let key: string | null = null;
        let isTodoTable = false;
        editor.getEditorState().read(() => {
          const node = $getNearestNodeFromDOMNode(tableElement!);
          if (node) {
            key = node.getKey();
            if ($isTableNode(node)) {
              const firstRow = node.getFirstChild();
              if (firstRow && $isTableRowNode(firstRow)) {
                const headerCells = (firstRow as TableRowNode).getChildren();
                if (headerCells.length === 2) {
                  if (headerCells[0].getTextContent().trim() === 'To Do' && 
                      headerCells[1].getTextContent().trim() === 'Done') {
                    isTodoTable = true;
                  }
                }
              }
            }
          }
        }, { editor });
        
        if (key) {
          setTableKey(key);
          setTableRect(tableElement.getBoundingClientRect());
          setIsHovering(true);
          setIsTodo(isTodoTable);
          return;
        }
      }
      
      // Keep hovering if mouse is over the buttons
      if (target.closest('.table-hover-action-btn')) {
        return;
      }

      setIsHovering(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchstart', handleMouseMove, { passive: true });
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchstart', handleMouseMove);
    };
  }, [editor]);

  const insertRow = () => {
    if (!tableKey) return;
    editor.update(() => {
      const tableNode = $getNodeByKey(tableKey);
      if ($isTableNode(tableNode)) {
        const table = tableNode as TableNode;
        // Select the very last cell in the table so we insert at the end
        const lastRow = table.getLastChild() as TableRowNode;
        if (lastRow) {
          const lastCell = lastRow.getLastChild() as TableCellNode;
          if ($isTableCellNode(lastCell)) {
            lastCell.select();
            $insertTableRow__EXPERIMENTAL(true);
          }
        }
      }
    });
  };

  const insertColumn = () => {
    if (!tableKey) return;
    editor.update(() => {
      const tableNode = $getNodeByKey(tableKey);
      if ($isTableNode(tableNode)) {
        const table = tableNode as TableNode;
        // Select the very last cell in the table so we insert at the end
        const lastRow = table.getLastChild() as TableRowNode;
        if (lastRow) {
          const lastCell = lastRow.getLastChild() as TableCellNode;
          if ($isTableCellNode(lastCell)) {
            lastCell.select();
            $insertTableColumn__EXPERIMENTAL(true);
          }
        }
      }
    });
  };

  if (!isHovering || !tableRect) return null;

  return (
    <>
      {/* Add Row Button (Bottom) */}
      {createPortal(
        <button
          className="table-hover-action-btn fixed flex items-center justify-center w-6 h-6 bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 rounded-full shadow-sm hover:scale-110 transition-transform"
          style={{ top: tableRect.bottom - 12, left: tableRect.left + tableRect.width / 2 - 12, zIndex: 999999 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            insertRow();
          }}
        >
          <Plus size={14} />
        </button>,
        document.body
      )}

      {/* Add Column Button (Right) */}
      {!isTodo && createPortal(
        <button
          className="table-hover-action-btn fixed flex items-center justify-center w-6 h-6 bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 rounded-full shadow-sm hover:scale-110 transition-transform"
          style={{ top: tableRect.top + tableRect.height / 2 - 12, left: tableRect.right - 12, zIndex: 999999 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            insertColumn();
          }}
        >
          <Plus size={14} />
        </button>,
        document.body
      )}
    </>
  );
}
