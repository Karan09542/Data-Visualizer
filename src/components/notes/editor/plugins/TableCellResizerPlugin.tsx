import React, { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $getNearestNodeFromDOMNode } from 'lexical';
import { $isTableCellNode, $isTableRowNode } from '@lexical/table';
import { createPortal } from 'react-dom';

const MIN_COLUMN_WIDTH = 50;
const MIN_ROW_HEIGHT = 30;

interface Segment {
  start: number;
  size: number;
}

/**
 * A merged cell straddles the boundary its neighbours share, so the resize bar must not be drawn
 * across it. This takes the table's full span and cuts out every cell that crosses the boundary,
 * leaving the stretches where the boundary genuinely exists.
 */
const boundarySegments = (
  table: HTMLTableElement,
  axis: 'row' | 'col',
  boundary: number,
): Segment[] => {
  const tableRect = table.getBoundingClientRect();
  const from = axis === 'row' ? tableRect.left : tableRect.top;
  const to = axis === 'row' ? tableRect.right : tableRect.bottom;

  let spans: { from: number; to: number }[] = [{ from, to }];

  for (const row of Array.from(table.rows)) {
    for (const cell of Array.from(row.cells)) {
      const rect = cell.getBoundingClientRect();
      const crossesStart = axis === 'row' ? rect.top : rect.left;
      const crossesEnd = axis === 'row' ? rect.bottom : rect.right;
      // Only a cell that starts before and ends after the boundary is straddling it
      if (crossesStart >= boundary - 1 || crossesEnd <= boundary + 1) continue;

      const blockFrom = axis === 'row' ? rect.left : rect.top;
      const blockTo = axis === 'row' ? rect.right : rect.bottom;

      const remaining: typeof spans = [];
      for (const span of spans) {
        if (blockTo <= span.from || blockFrom >= span.to) {
          remaining.push(span);
          continue;
        }
        if (blockFrom > span.from) remaining.push({ from: span.from, to: blockFrom });
        if (blockTo < span.to) remaining.push({ from: blockTo, to: span.to });
      }
      spans = remaining;
    }
  }

  return spans
    .filter(span => span.to - span.from > 2)
    .map(span => ({ start: span.from, size: span.to - span.from }));
};

export default function TableCellResizerPlugin() {
  const [editor] = useLexicalComposerContext();
  const [resizerPosition, setResizerPosition] = useState({ top: 0, left: 0, width: 0, height: 0, tableTop: 0, tableLeft: 0, tableWidth: 0, tableHeight: 0 });
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<'col' | 'row' | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
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
            const table = targetCell.closest('table') as HTMLTableElement | null;
            const tableRect = table?.getBoundingClientRect();

            // Where the bar would sit, so the parts crossed by a merged cell can be cut out
            const boundary = newDir === 'row' ? targetRect.bottom : targetRect.right;
            const available = table ? boundarySegments(table, newDir, boundary) : [];
            if (available.length === 0) {
              setActiveCellKey(null);
              setResizeDirection(null);
              return;
            }
            setSegments(available);

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
    <>
      {segments.map((segment, i) => (
    <div
      key={i}
      className={`table-resizer-handle fixed z-[999999] transition-colors ${isCol ? 'cursor-col-resize' : 'cursor-row-resize'
        } ${isResizing ? 'bg-indigo-500' : 'bg-indigo-500/50 hover:bg-indigo-500'
        }`}
      style={{
        ...(isCol
          ? {
            top: segment.start,
            left: resizerPosition.left + resizerPosition.width - 2,
            height: segment.size,
            width: 4
          }
          : {
            top: resizerPosition.top + resizerPosition.height - 2,
            left: segment.start,
            height: 4,
            width: segment.size
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
    />
      ))}
    </>,
    document.body
  );
}
