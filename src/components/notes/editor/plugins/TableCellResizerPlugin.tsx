import React, { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getNearestNodeFromDOMNode } from 'lexical';
import { $isTableCellNode, $isTableRowNode } from '@lexical/table';
import { createPortal } from 'react-dom';

const MIN_COLUMN_WIDTH = 50;
const MIN_ROW_HEIGHT = 30;

export default function TableCellResizerPlugin() {
  const [editor] = useLexicalComposerContext();
  const [resizerPosition, setResizerPosition] = useState({ top: 0, left: 0, width: 0, height: 0, tableTop: 0, tableLeft: 0, tableWidth: 0, tableHeight: 0 });
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<'col' | 'row' | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const activeDOMCellRef = useRef<HTMLElement | null>(null);
  const initialXRef = useRef(0);
  const initialYRef = useRef(0);
  const initialWidthRef = useRef(0);
  const initialHeightRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeDirection) {
        if (activeDOMCellRef.current) {
          if (resizeDirection === 'col') {
            const newWidth = Math.max(MIN_COLUMN_WIDTH, e.clientX - resizerPosition.left);
            const table = activeDOMCellRef.current.closest('table');
            if (table) {
              Array.from(table.rows).forEach(r => {
                const c = r.cells[(activeDOMCellRef.current as HTMLTableCellElement).cellIndex];
                if (c) {
                  c.style.width = `${newWidth}px`;
                  c.style.minWidth = `${newWidth}px`;
                }
              });
            }

            setResizerPosition((prev) => ({
              ...prev,
              width: newWidth,
            }));
          } else {
            const newHeight = Math.max(MIN_ROW_HEIGHT, e.clientY - resizerPosition.top);

            // For row height, we should set it on the parent TR or the cell itself
            const tr = activeDOMCellRef.current.closest('tr');
            if (tr) {
              tr.style.height = `${newHeight}px`;
            }

            setResizerPosition((prev) => ({
              ...prev,
              height: newHeight,
            }));
          }
        }
        return;
      }

      const target = e.target as HTMLElement;
      const cell = target.closest('.editor-tableCell, .editor-tableCellHeader, td, th') as HTMLElement;

      if (cell) {
        const rect = cell.getBoundingClientRect();
        const isNearRightEdge = Math.abs(rect.right - e.clientX) <= 15;
        const isNearLeftEdge = Math.abs(e.clientX - rect.left) <= 15;
        const isNearBottomEdge = Math.abs(rect.bottom - e.clientY) <= 15;
        const isNearTopEdge = Math.abs(e.clientY - rect.top) <= 15;

        let newDir: 'col' | 'row' | null = null;
        let targetCell = cell;

        if (isNearRightEdge) {
          newDir = 'col';
        } else if (isNearLeftEdge && cell.previousElementSibling) {
          newDir = 'col';
          targetCell = cell.previousElementSibling as HTMLElement;
        } else if (isNearBottomEdge) {
          newDir = 'row';
        } else if (isNearTopEdge) {
          const tr = cell.closest('tr');
          if (tr && tr.previousElementSibling) {
            newDir = 'row';
            const prevRow = tr.previousElementSibling as HTMLTableRowElement;
            const targetCellIndex = (cell as HTMLTableCellElement).cellIndex;
            targetCell = prevRow.cells[targetCellIndex] || prevRow.cells[prevRow.cells.length - 1];
          }
        }

        if (newDir) {
          const targetRect = targetCell.getBoundingClientRect();
          let key: string | null = null;
          editor.getEditorState().read(() => {
            const node = $getNearestNodeFromDOMNode(targetCell);
            if (node) key = node.getKey();
          }, { editor });
          if (key) {
            setActiveCellKey(key);
            setResizeDirection(newDir);
            activeDOMCellRef.current = targetCell;
            const tableRect = targetCell.closest('table')?.getBoundingClientRect();
            setResizerPosition({
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              tableTop: tableRect ? tableRect.top : targetRect.top,
              tableLeft: tableRect ? tableRect.left : targetRect.left,
              tableWidth: tableRect ? tableRect.width : targetRect.width,
              tableHeight: tableRect ? tableRect.height : targetRect.height,
            });
            return;
          }
        }
      } else if (target.closest('.table-resizer-handle')) {
        return; // Don't hide if hovering over the handle itself
      }

      setActiveCellKey(null);
      setResizeDirection(null);
    };

    const handleMouseUp = () => {
      if (isResizing && activeCellKey && activeDOMCellRef.current) {
        setIsResizing(false);
        const finalWidth = parseInt(activeDOMCellRef.current.style.width, 10);
        const tr = activeDOMCellRef.current.closest('tr');
        const finalHeight = tr ? parseInt(tr.style.height, 10) : 0;
        const dir = resizeDirection;

        // Save to Lexical state
        editor.update(() => {
          const cellNode = $getNodeByKey(activeCellKey);
          if ($isTableCellNode(cellNode)) {
            if (dir === 'col' && finalWidth) {
              cellNode.setWidth(finalWidth);
            } else if (dir === 'row' && finalHeight) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                rowNode.setHeight(finalHeight);
              }
            }
          }
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editor, isResizing, activeCellKey, resizeDirection]);

  if (!activeCellKey || !resizeDirection) return null;

  const isCol = resizeDirection === 'col';

  return createPortal(
    <div
      className={`table-resizer-handle fixed z-[999999] transition-colors ${isCol ? 'cursor-col-resize' : 'cursor-row-resize'
        } ${isResizing ? 'bg-indigo-500' : 'bg-indigo-500/50 hover:bg-indigo-500'
        }`}
      style={{
        ...(isCol
          ? {
            top: resizerPosition.tableTop - 4,
            left: resizerPosition.left + resizerPosition.width - 2,
            height: resizerPosition.tableHeight + 8,
            width: 4
          }
          : {
            top: resizerPosition.top + resizerPosition.height - 2,
            left: resizerPosition.tableLeft - 4,
            height: 4,
            width: resizerPosition.tableWidth + 8
          }
        )
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        initialXRef.current = e.clientX;
        initialYRef.current = e.clientY;
        if (activeDOMCellRef.current) {
          initialWidthRef.current = activeDOMCellRef.current.getBoundingClientRect().width;
          const tr = activeDOMCellRef.current.closest('tr');
          initialHeightRef.current = tr ? tr.getBoundingClientRect().height : 0;
        }
      }}
    />,
    document.body
  );
}
