import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import {
  ChevronDown,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Combine,
  Split,
  Trash2,
  ImageDown,
  Download,
  Share2,
  Hash,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import {
  extractTableData,
  renderTableToCanvas,
  copyCanvas,
  downloadCanvas,
  shareCanvas,
  canShareImages,
  tableToMarkdown,
  tableToCsv,
} from '../../../../utils/tableImage';

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

  const [status, setStatus] = useState<string | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
  }, []);

  // Say what happened, then close, so the menu is not a dead end
  const flash = useCallback((message: string) => {
    setStatus(message);
    statusTimerRef.current = window.setTimeout(() => {
      setStatus(null);
      onClose();
    }, 1100);
  }, [onClose]);

  /**
   * Drawing the image needs the fonts and any pictures loaded, which is asynchronous. Sharing has
   * to be called straight out of the click that asked for it, so the image is prepared as soon as
   * the menu opens and the buttons then work from the finished canvas.
   */
  const preparedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const tableElement = useCallback(
    () => editor.getElementByKey(cellKey)?.closest('table') as HTMLTableElement | null,
    [editor, cellKey],
  );

  useEffect(() => {
    let cancelled = false;
    const table = tableElement();
    if (!table) return;

    renderTableToCanvas(extractTableData(table))
      .then((canvas) => {
        if (!cancelled) preparedCanvasRef.current = canvas;
      })
      .catch((err) => console.error('Preparing the table image failed', err));

    return () => {
      cancelled = true;
    };
  }, [tableElement]);

  const buildCanvas = useCallback(async () => {
    if (preparedCanvasRef.current) return preparedCanvasRef.current;
    const table = tableElement();
    if (!table) return null;
    const canvas = await renderTableToCanvas(extractTableData(table));
    preparedCanvasRef.current = canvas;
    return canvas;
  }, [tableElement]);

  const fileName = isTodo ? 'todo-table.png' : 'table.png';

  const copyImage = async () => {
    const canvas = await buildCanvas();
    if (!canvas) return;
    const result = await copyCanvas(canvas, fileName);
    flash(result === 'copied' ? 'Image copied' : 'Image saved');
  };

  const downloadImage = async () => {
    const canvas = await buildCanvas();
    if (!canvas) return;
    downloadCanvas(canvas, fileName);
    flash('Image saved');
  };

  const shareImage = async () => {
    // Uses the canvas prepared when the menu opened, so no await sits between the tap and sharing
    const canvas = preparedCanvasRef.current ?? (await buildCanvas());
    if (!canvas) return;
    try {
      const result = await shareCanvas(canvas, fileName, isTodo ? 'To-do table' : 'Table');
      if (result === 'shared') flash('Shared');
      else if (result === 'unsupported') flash('Sharing is unavailable');
      else onClose();
    } catch (err) {
      console.error('Sharing the table failed', err);
      flash("Couldn't share");
    }
  };

  const copyAsText = async (kind: 'markdown' | 'csv') => {
    const table = tableElement();
    if (!table) return;
    const data = extractTableData(table);
    try {
      await navigator.clipboard.writeText(kind === 'markdown' ? tableToMarkdown(data) : tableToCsv(data));
      flash(kind === 'markdown' ? 'Markdown copied' : 'CSV copied');
    } catch (err) {
      console.error('Copying the table failed', err);
      flash("Couldn't copy");
    }
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

  /**
   * The menu used to sit at `button.bottom + 4` with no regard for the viewport, so opening it
   * near the bottom or the right edge cut it off. This measures both and flips it above the
   * button when there is more room there, then caps its height so its own scrollbar takes over.
   */
  const [placement, setPlacement] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;

    const place = () => {
      const rect = button.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const menuWidth = menu.offsetWidth || 224;
      const menuHeight = menu.scrollHeight;

      const roomBelow = window.innerHeight - rect.bottom - margin - gap;
      const roomAbove = rect.top - margin - gap;

      let top: number;
      let maxHeight: number;
      if (menuHeight <= roomBelow || roomBelow >= roomAbove) {
        top = rect.bottom + gap;
        maxHeight = Math.max(140, roomBelow);
      } else {
        maxHeight = Math.max(140, roomAbove);
        top = Math.max(margin, rect.top - gap - Math.min(menuHeight, maxHeight));
      }

      // Right-aligned with the button, but never past either edge
      const rightAligned = rect.right - menuWidth;
      const furthestLeft = Math.max(margin, window.innerWidth - menuWidth - margin);
      const left = Math.min(Math.max(margin, rightAligned), furthestLeft);

      setPlacement({ top, left, maxHeight });
    };

    place();
    window.addEventListener('resize', place);
    // Capture, so scrolling any container the table sits in keeps the menu on the button
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [status, isMerged, canMergeRight, canMergeDown, isTodo]);

  if (!buttonRef.current) return null;

  const itemClass =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 transition-colors';
  const dangerClass =
    'flex w-full items-center gap-2.5 px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors';
  const groupLabelClass =
    'px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35';
  const divider = <div className="h-px bg-black/10 dark:bg-white/10 my-1" />;

  return createPortal(
    <div
      ref={menuRef}
      className="custom-scrollbar fixed w-56 overflow-y-auto overscroll-contain bg-white dark:bg-[#1f1f1f] border border-black/10 dark:border-white/10 rounded-lg shadow-xl py-1 text-sm font-medium"
      style={{
        top: placement?.top ?? -9999,
        left: placement?.left ?? -9999,
        maxHeight: placement?.maxHeight,
        // Hidden for the single frame before it has been measured
        visibility: placement ? 'visible' : 'hidden',
        zIndex: 999999
      }}
    >
      {status && (
        <div className="flex items-center gap-2 px-3 py-2 text-emerald-600 dark:text-emerald-400">
          <Check size={15} className="shrink-0" />
          <span>{status}</span>
        </div>
      )}

      {!status && (
        <>
          <div className={groupLabelClass}>Share</div>
          <button onClick={copyImage} className={itemClass}>
            <ImageDown size={15} className="shrink-0 opacity-70" /> Copy as image
          </button>
          <button onClick={downloadImage} className={itemClass}>
            <Download size={15} className="shrink-0 opacity-70" /> Download image
          </button>
          {canShareImages() && (
            <button onClick={shareImage} className={itemClass}>
              <Share2 size={15} className="shrink-0 opacity-70" /> Share image
            </button>
          )}
          <button onClick={() => copyAsText('markdown')} className={itemClass}>
            <Hash size={15} className="shrink-0 opacity-70" /> Copy as Markdown
          </button>
          <button onClick={() => copyAsText('csv')} className={itemClass}>
            <FileSpreadsheet size={15} className="shrink-0 opacity-70" /> Copy as CSV
          </button>

          {divider}

          <div className={groupLabelClass}>Rows</div>
          <button onClick={() => insertRow(false)} className={itemClass}>
            <ArrowUpToLine size={15} className="shrink-0 opacity-70" /> Insert row above
          </button>
          <button onClick={() => insertRow(true)} className={itemClass}>
            <ArrowDownToLine size={15} className="shrink-0 opacity-70" /> Insert row below
          </button>

          {!isTodo && (
            <>
              <div className={groupLabelClass}>Columns</div>
              <button onClick={() => insertColumn(false)} className={itemClass}>
                <ArrowLeftToLine size={15} className="shrink-0 opacity-70" /> Insert column left
              </button>
              <button onClick={() => insertColumn(true)} className={itemClass}>
                <ArrowRightToLine size={15} className="shrink-0 opacity-70" /> Insert column right
              </button>
            </>
          )}

          {(isMerged || canMergeRight || canMergeDown) && (
            <>
              {divider}
              {isMerged && (
                <button onClick={unmerge} className={itemClass}>
                  <Split size={15} className="shrink-0 opacity-70" /> Unmerge cells
                </button>
              )}
              {!isMerged && canMergeRight && (
                <button onClick={mergeRight} className={itemClass}>
                  <Combine size={15} className="shrink-0 opacity-70" /> Merge right
                </button>
              )}
              {!isMerged && canMergeDown && (
                <button onClick={mergeDown} className={itemClass}>
                  <Combine size={15} className="shrink-0 rotate-90 opacity-70" /> Merge down
                </button>
              )}
            </>
          )}

          {divider}

          {!isTodo && (
            <button onClick={deleteColumn} className={dangerClass}>
              <Trash2 size={15} className="shrink-0" /> Delete column
            </button>
          )}
          <button onClick={deleteRow} className={dangerClass}>
            <Trash2 size={15} className="shrink-0" /> Delete row
          </button>
          <button onClick={deleteTable} className={dangerClass}>
            <Trash2 size={15} className="shrink-0" /> Delete table
          </button>
        </>
      )}
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
