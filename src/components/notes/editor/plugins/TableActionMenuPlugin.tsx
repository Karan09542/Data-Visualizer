import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, $getNodeByKey, LexicalEditor } from 'lexical';
import {
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableNode,
  $isTableCellNode,
  $isTableRowNode,
  TableRowNode,
  $unmergeCellNode,
  $mergeCells,
} from '@lexical/table';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

function TableActionMenu({
  onClose,
  editor,
  buttonRef,
  cellKey,
  isTodo,
}: {
  onClose: () => void;
  editor: LexicalEditor;
  buttonRef: React.RefObject<HTMLButtonElement>;
  cellKey: string;
  isTodo: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, buttonRef]);

  const insertRow = (insertAfter: boolean) => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        cellNode.select();
        $insertTableRow__EXPERIMENTAL(insertAfter);
      }
      onClose();
    });
  };

  const insertColumn = (insertAfter: boolean) => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        cellNode.select();
        $insertTableColumn__EXPERIMENTAL(insertAfter);
      }
      onClose();
    });
  };

  const deleteRow = () => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        cellNode.select();
        $deleteTableRow__EXPERIMENTAL();
      }
      onClose();
    });
  };

  const deleteColumn = () => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        cellNode.select();
        $deleteTableColumn__EXPERIMENTAL();
      }
      onClose();
    });
  };

  const deleteTable = () => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        const tableNode = cellNode.getParent()?.getParent();
        if ($isTableNode(tableNode)) {
          tableNode.remove();
        }
      }
      onClose();
    });
  };

  const mergeRight = () => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        const nextCell = cellNode.getNextSibling();
        if ($isTableCellNode(nextCell)) {
          $mergeCells([cellNode, nextCell]);
        }
      }
      onClose();
    });
  };

  const mergeDown = () => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        const row = cellNode.getParent();
        if ($isTableRowNode(row)) {
          const nextRow = row.getNextSibling();
          if ($isTableRowNode(nextRow)) {
            const index = cellNode.getIndexWithinParent();
            const cellBelow = nextRow.getChildAtIndex(index);
            if ($isTableCellNode(cellBelow)) {
              $mergeCells([cellNode, cellBelow]);
            }
          }
        }
      }
      onClose();
    });
  };

  const unmerge = () => {
    editor.update(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        $unmergeCellNode(cellNode);
      }
      onClose();
    });
  };

  const [isMerged, setIsMerged] = useState(false);
  const [canMergeRight, setCanMergeRight] = useState(false);
  const [canMergeDown, setCanMergeDown] = useState(false);

  useEffect(() => {
    editor.getEditorState().read(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        setIsMerged(cellNode.getColSpan() > 1 || cellNode.getRowSpan() > 1);
        
        const nextCell = cellNode.getNextSibling();
        setCanMergeRight($isTableCellNode(nextCell));

        const row = cellNode.getParent();
        if ($isTableRowNode(row)) {
          const nextRow = row.getNextSibling();
          if ($isTableRowNode(nextRow)) {
            const index = cellNode.getIndexWithinParent();
            const cellBelow = nextRow.getChildAtIndex(index);
            setCanMergeDown($isTableCellNode(cellBelow));
          }
        }
      }
    });
  }, [editor, cellKey]);

  if (!buttonRef.current) return null;

  const rect = buttonRef.current.getBoundingClientRect();

  return createPortal(
    <div
      ref={menuRef}
      className="fixed w-48 bg-white dark:bg-[#1f1f1f] border border-black/10 dark:border-white/10 rounded-lg shadow-xl overflow-hidden py-1 text-sm font-medium"
      style={{
        top: rect.bottom + 4,
        left: rect.left - 160 + rect.width, // align right
        zIndex: 999999
      }}
    >
      <button onClick={() => insertRow(false)} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
        Insert row above
      </button>
      <button onClick={() => insertRow(true)} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
        Insert row below
      </button>
      <div className="h-px bg-black/10 dark:bg-white/10 my-1" />
      
      {isMerged && (
        <button onClick={unmerge} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
          Unmerge cells
        </button>
      )}
      {!isMerged && canMergeRight && (
        <button onClick={mergeRight} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
          Merge right
        </button>
      )}
      {!isMerged && canMergeDown && (
        <button onClick={mergeDown} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
          Merge down
        </button>
      )}

      {!isTodo && (
        <>
          <div className="h-px bg-black/10 dark:bg-white/10 my-1" />
          <button onClick={() => insertColumn(false)} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
            Insert column left
          </button>
          <button onClick={() => insertColumn(true)} className="w-full text-left px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 text-black/80 dark:text-white/80">
            Insert column right
          </button>
        </>
      )}
      
      <div className="h-px bg-black/10 dark:bg-white/10 my-1" />
      
      {!isTodo && (
        <button onClick={deleteColumn} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
          Delete column
        </button>
      )}
      <button onClick={deleteRow} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
        Delete row
      </button>
      <button onClick={deleteTable} className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400">
        Delete table
      </button>
    </div>,
    document.body
  );
}

export default function TableActionMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cellKey, setCellKey] = useState<string | null>(null);
  const [isTodo, setIsTodo] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      // Don't hide if menu is open
      if (isMenuOpen) return;

      const target = e.target as HTMLElement;
      
      // If hovering over the button itself, do nothing
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }

      const cell = target.closest('.editor-tableCell, .editor-tableCellHeader, td, th') as HTMLElement;
      
      if (cell) {
        let key: string | null = null;
        let isTodoTable = false;
        editor.getEditorState().read(() => {
          const node = $getNearestNodeFromDOMNode(cell);
          if (node) {
            key = node.getKey();
            const tableNode = node.getParent()?.getParent();
            if ($isTableNode(tableNode)) {
              const firstRow = tableNode.getFirstChild();
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
          setCellKey(key);
          setIsTodo(isTodoTable);
          const rect = cell.getBoundingClientRect();
          // Prevent unnecessary re-renders if position is roughly the same
          setPosition(prev => {
            const newTop = rect.top + 4;
            const newLeft = rect.right - 24;
            if (Math.abs(prev.top - newTop) > 2 || Math.abs(prev.left - newLeft) > 2) {
              return { top: newTop, left: newLeft };
            }
            return prev;
          });
          return;
        }
      }
      
      // If we got here and didn't return, we're not hovering a cell
      setCellKey(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('touchstart', handleMouseMove, { passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchstart', handleMouseMove);
    };
  }, [editor, isMenuOpen]);

  if (!cellKey) return null;

  return (
    <>
      {createPortal(
        <button
          ref={buttonRef}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="fixed flex items-center justify-center w-7 h-7 bg-indigo-500 text-white rounded shadow-lg hover:bg-indigo-600 hover:scale-110 transition-transform cursor-pointer"
          style={{ top: position.top, left: position.left, zIndex: 999999 }}
        >
          <ChevronDown size={16} />
        </button>,
        document.body
      )}
      {isMenuOpen && (
        <TableActionMenu onClose={() => setIsMenuOpen(false)} editor={editor} buttonRef={buttonRef} cellKey={cellKey} isTodo={isTodo} />
      )}
    </>
  );
}
