import React, { useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode, $getNodeByKey } from 'lexical';
import { $isTableCellNode, $isTableRowNode, $isTableNode } from '@lexical/table';
import { createPortal } from 'react-dom';
import { GripVertical, GripHorizontal } from 'lucide-react';

export default function TableDragDropPlugin() {
  const [editor] = useLexicalComposerContext();
  
  // Track hovered cell for showing handles
  const [hoveredCell, setHoveredCell] = useState<{ key: string, rect: DOMRect, tableRect: DOMRect, colIndex: number, rowIndex: number } | null>(null);
  const hideHoverTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Drag state
  const [dragSource, setDragSource] = useState<{ type: 'row' | 'col', index: number, tableKey: string, rect: DOMRect } | null>(null);
  const [dragTarget, setDragTarget] = useState<{ index: number, rect: DOMRect } | null>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // Don't update hover if we are dragging
      if (dragSource) {
        // Find cell under pointer while dragging
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const cell = elements.find(el => el.closest('.editor-tableCell, .editor-tableCellHeader, td, th')) as HTMLElement;
        const actualCell = cell?.closest('td, th') as HTMLTableCellElement;
        
        if (actualCell) {
          if (dragSource.type === 'col') {
            setDragTarget({ index: actualCell.cellIndex, rect: actualCell.getBoundingClientRect() });
          } else {
            const tr = actualCell.parentElement as HTMLTableRowElement;
            setDragTarget({ index: tr.rowIndex, rect: actualCell.getBoundingClientRect() });
          }
        }
        return;
      }

      // Not dragging, handle hover logic
      const target = e.target as HTMLElement;
      
      // If hovering over the handles themselves, keep showing
      if (target.closest('.table-drag-handle-wrapper')) {
        if (hideHoverTimeout.current) clearTimeout(hideHoverTimeout.current);
        return;
      }

      const cell = target.closest('.editor-tableCell, .editor-tableCellHeader, td, th') as HTMLTableCellElement;
      
      if (cell) {
        if (hideHoverTimeout.current) clearTimeout(hideHoverTimeout.current);
        const table = cell.closest('table');
        if (table) {
          let cellKey: string | null = null;
          let tableKey: string | null = null;
          
          editor.getEditorState().read(() => {
            const node = $getNearestNodeFromDOMNode(cell);
            if (node && $isTableCellNode(node)) {
              cellKey = node.getKey();
              const row = node.getParent();
              if (row && $isTableRowNode(row)) {
                const tableNode = row.getParent();
                if (tableNode && $isTableNode(tableNode)) {
                  tableKey = tableNode.getKey();
                }
              }
            }
          }, { editor });

          if (cellKey && tableKey) {
            setHoveredCell({
              key: cellKey,
              rect: cell.getBoundingClientRect(),
              tableRect: table.getBoundingClientRect(),
              colIndex: cell.cellIndex,
              rowIndex: (cell.parentElement as HTMLTableRowElement).rowIndex
            });
            return;
          }
        }
      }
      
      // Debounce hide to allow moving mouse across small gaps
      if (hideHoverTimeout.current) clearTimeout(hideHoverTimeout.current);
      hideHoverTimeout.current = setTimeout(() => {
        setHoveredCell(null);
      }, 100);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (dragSource && dragTarget && dragSource.index !== dragTarget.index) {
        editor.update(() => {
          const tableNode = $getNodeByKey(dragSource.tableKey);
          if ($isTableNode(tableNode)) {
            const rows = tableNode.getChildren();
            
            if (dragSource.type === 'row') {
              const sourceRow = rows[dragSource.index];
              const targetRow = rows[dragTarget.index];
              if (sourceRow && targetRow && $isTableRowNode(sourceRow) && $isTableRowNode(targetRow)) {
                if (dragSource.index < dragTarget.index) {
                  targetRow.insertAfter(sourceRow);
                } else {
                  targetRow.insertBefore(sourceRow);
                }
              }
            } else if (dragSource.type === 'col') {
              rows.forEach(row => {
                if ($isTableRowNode(row)) {
                  const cells = row.getChildren();
                  const sourceCell = cells[dragSource.index];
                  const targetCell = cells[dragTarget.index];
                  if (sourceCell && targetCell && $isTableCellNode(sourceCell) && $isTableCellNode(targetCell)) {
                    if (dragSource.index < dragTarget.index) {
                      targetCell.insertAfter(sourceCell);
                    } else {
                      targetCell.insertBefore(sourceCell);
                    }
                  }
                }
              });
            }
          }
        });
      }
      
      // Release capture if held by any element
      if (document.activeElement && 'releasePointerCapture' in document.activeElement && e.pointerId) {
        try {
          (document.activeElement as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
      }
      
      setDragSource(null);
      setDragTarget(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [editor, dragSource, dragTarget]);

  if (!hoveredCell && !dragSource) return null;

  return (
    <>
      {hoveredCell && createPortal(
        <>
          {/* Column Drag Handle (Top) Wrapper with invisible padding */}
          <div
            className="table-drag-handle-wrapper fixed flex items-center justify-center z-[999999]"
            style={{
              top: hoveredCell.tableRect.top - 28, 
              left: hoveredCell.rect.left + hoveredCell.rect.width / 2 - 20,
              width: 40, // Larger hit area
              height: 28, // Connects perfectly to the table border
              touchAction: 'none' // Prevent scrolling on mobile
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              editor.getEditorState().read(() => {
                const node = $getNodeByKey(hoveredCell.key);
                if (node) {
                  const tableNode = node.getParent()?.getParent();
                  if (tableNode) {
                    setDragSource({ type: 'col', index: hoveredCell.colIndex, tableKey: tableNode.getKey(), rect: hoveredCell.rect });
                  }
                }
              }, { editor });
            }}
          >
            <div className="table-drag-handle flex items-center justify-center bg-black/20 dark:bg-white/20 shadow-md hover:bg-indigo-500 hover:text-white rounded text-black/70 dark:text-white/70 cursor-grab active:cursor-grabbing transition-colors w-7 h-5">
              <GripHorizontal size={14} />
            </div>
          </div>

          {/* Row Drag Handle (Left) Wrapper with invisible padding */}
          <div
            className="table-drag-handle-wrapper fixed flex items-center justify-center z-[999999]"
            style={{
              top: hoveredCell.rect.top + hoveredCell.rect.height / 2 - 20,
              left: hoveredCell.tableRect.left - 28,
              width: 28, // Connects perfectly to the table border
              height: 40, // Larger hit area
              touchAction: 'none' // Prevent scrolling on mobile
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              editor.getEditorState().read(() => {
                const node = $getNodeByKey(hoveredCell.key);
                if (node) {
                  const tableNode = node.getParent()?.getParent();
                  if (tableNode) {
                    setDragSource({ type: 'row', index: hoveredCell.rowIndex, tableKey: tableNode.getKey(), rect: hoveredCell.rect });
                  }
                }
              }, { editor });
            }}
          >
            <div className="table-drag-handle flex items-center justify-center bg-black/20 dark:bg-white/20 shadow-md hover:bg-indigo-500 hover:text-white rounded text-black/70 dark:text-white/70 cursor-grab active:cursor-grabbing transition-colors w-5 h-7">
              <GripVertical size={14} />
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Dynamic Drag Over Indicator */}
      {dragSource && dragTarget && createPortal(
        <div
          className="fixed pointer-events-none z-[999999] bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] rounded-full transition-all duration-75"
          style={{
            ...(dragSource.type === 'col' && hoveredCell
              ? {
                  top: hoveredCell.tableRect.top - 4,
                  left: dragTarget.rect.left + (dragTarget.index > dragSource.index ? dragTarget.rect.width : 0) - 2,
                  height: hoveredCell.tableRect.height + 8,
                  width: 4
                }
              : dragSource.type === 'row' && hoveredCell
              ? {
                  top: dragTarget.rect.top + (dragTarget.index > dragSource.index ? dragTarget.rect.height : 0) - 2,
                  left: hoveredCell.tableRect.left - 4,
                  width: hoveredCell.tableRect.width + 8,
                  height: 4
                }
              : {})
          }}
        />,
        document.body
      )}
      
      {/* Dragging Source Overlay (visual feedback of what is being dragged) */}
      {dragSource && hoveredCell && createPortal(
        <div
          className="fixed pointer-events-none z-[999998] bg-black/10 dark:bg-white/10 border-2 border-dashed border-black/30 dark:border-white/30"
          style={{
            ...(dragSource.type === 'col'
              ? {
                  top: hoveredCell.tableRect.top,
                  left: dragSource.rect.left,
                  height: hoveredCell.tableRect.height,
                  width: dragSource.rect.width
                }
              : dragSource.type === 'row'
              ? {
                  top: dragSource.rect.top,
                  left: hoveredCell.tableRect.left,
                  width: hoveredCell.tableRect.width,
                  height: dragSource.rect.height
                }
              : {})
          }}
        />,
        document.body
      )}
    </>
  );
}
