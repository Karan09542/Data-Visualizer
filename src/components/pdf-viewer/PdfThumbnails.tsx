import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useMemo
} from "react";
import { createPortal } from "react-dom";
import { Check, Download, FileText, Loader2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PdfWorkerClient } from "./pdfWorkerClient";
import { IMAGE_FORMATS, type ExportImageFormat } from "./pdfExport";
import { pdfPalette } from "./pdfTheme";

/** How long a press on a download button lasts before it offers formats instead */
const HOLD_MS = 400;

/* ── One IntersectionObserver for the whole grid ─────────────────────────── */

type Observe = (el: Element, page: number) => () => void;
const ObserveContext = createContext<Observe | null>(null);

function useGridObserver(root: HTMLElement | null, client: PdfWorkerClient, enabled: boolean): Observe | null {
  const [observe, setObserve] = useState<Observe | null>(null);

  useEffect(() => {
    if (!root || !enabled) {
      setObserve(null);
      return;
    }
    const pages = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = pages.get(entry.target);
          if (page === undefined) continue;
          // Visible (or nearly): draw it. Scrolled past before it was drawn: don't bother.
          if (entry.isIntersecting) client.requestThumbnail(page);
          else client.cancelThumbnail(page);
        }
      },
      { root, rootMargin: "300px 0px" },
    );
    setObserve(() => (el: Element, page: number) => {
      pages.set(el, page);
      observer.observe(el);
      return () => {
        observer.unobserve(el);
        pages.delete(el);
      };
    });
    return () => observer.disconnect();
  }, [root, client, enabled]);

  return observe;
}

/* ── Format menu for a page's download button ────────────────────────────── */

const FormatMenu: React.FC<{
  anchor: HTMLElement;
  pageNum: number;
  current: ExportImageFormat;
  isDark: boolean;
  onPick: (format: ExportImageFormat) => void;
  onClose: () => void;
}> = ({ anchor, pageNum, current, isDark, onPick, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const width = 200;
    const height = menuRef.current?.offsetHeight ?? 170;
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ ...pdfPalette(isDark), top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="fixed z-[999999] w-[200px] overflow-hidden rounded-xl border border-(--pv-line) bg-(--pv-elevated) p-1 text-(--pv-text) shadow-(--pv-shadow)"
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-(--pv-muted)">Download page {pageNum} as</p>
      {IMAGE_FORMATS.map((f) => (
        <button
          key={f.id}
          role="menuitem"
          onClick={() => onPick(f.id)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-(--pv-hover)"
        >
          <span>
            <span className="block text-[13px] font-medium">{f.label}</span>
            <span className="block text-[11px] text-(--pv-muted)">{f.hint}</span>
          </span>
          {current === f.id && <Check size={14} className="text-(--pv-accent)" />}
        </button>
      ))}
    </div>,
    document.body,
  );
};

/* ── A thumbnail ─────────────────────────────────────────────────────────── */

interface CardProps {
  pageNum: number;
  url: string | undefined;
  /** Extra rotation chosen in the viewer, shown on the thumbnail too */
  rotation?: number;
  isCurrent: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  isDownloading?: boolean;
  isOverlay?: boolean;
  defaultFormat: ExportImageFormat;
  thumbnailsEnabled: boolean;
  onGoToPage?: (page: number) => void;
  onToggleSelect?: (page: number) => void;
  onDownload?: (page: number, format: ExportImageFormat) => void;
  onOpenFormats?: (page: number, anchor: HTMLElement) => void;
}

const ThumbnailCard: React.FC<CardProps> = React.memo(({
  pageNum,
  url,
  rotation = 0,
  isCurrent,
  isSelected,
  selectionMode,
  isDownloading,
  isOverlay,
  defaultFormat,
  thumbnailsEnabled,
  onGoToPage,
  onToggleSelect,
  onDownload,
  onOpenFormats,
}) => {
  const hold = useRef<number | null>(null);
  const held = useRef(false);
  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current);
    hold.current = null;
  };

  return (
    <div
      onClick={() => {
        if (isOverlay) return;
        if (selectionMode) onToggleSelect?.(pageNum);
        else onGoToPage?.(pageNum);
      }}
      className={`group relative flex cursor-pointer select-none flex-col items-center gap-1.5 ${isOverlay ? "scale-105" : ""}`}
    >
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-white transition-shadow ${isSelected || isCurrent
            ? "ring-2 ring-(--pv-accent) ring-offset-2 ring-offset-(--pv-panel)"
            : "ring-1 ring-(--pv-line) group-hover:ring-(--pv-muted)/40"
          } ${isOverlay ? "shadow-2xl" : "shadow-sm"}`}
        style={{ aspectRatio: "1 / 1.414" }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full object-contain transition-transform duration-200"
            style={rotation ? { transform: `rotate(${rotation}deg)${rotation % 180 ? " scale(0.707)" : ""}` } : undefined}
          />
        ) : thumbnailsEnabled ? (
          <div className="flex h-full w-full items-center justify-center bg-(--pv-chip)">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-(--pv-line) border-t-(--pv-muted)" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-(--pv-chip)/60 p-2 text-(--pv-muted) transition-colors group-hover:bg-(--pv-hover)">
            <FileText size={20} className="opacity-40 transition-transform group-hover:scale-105" />
            <div className="flex w-full flex-col items-center gap-1 px-2 opacity-30">
              <div className="h-1 w-3/4 rounded-full bg-(--pv-line)" />
              <div className="h-1 w-1/2 rounded-full bg-(--pv-line)" />
              <div className="h-1 w-2/3 rounded-full bg-(--pv-line)" />
            </div>
          </div>
        )}

        {!isOverlay && (
          <>
            {/* Select */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(pageNum);
              }}
              aria-label={isSelected ? `Deselect page ${pageNum}` : `Select page ${pageNum}`}
              aria-pressed={isSelected}
              className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-opacity ${isSelected
                  ? "bg-(--pv-accent) text-(--pv-on-accent) opacity-100"
                  : `border-2 border-white bg-black/25 text-transparent shadow ${selectionMode ? "opacity-100" : "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:hidden"}`
                }`}
            >
              <Check size={13} strokeWidth={3} />
            </button>

            {/* Download: click for the usual format, hold or right-click to choose */}
            {!selectionMode && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  held.current = false;
                  const target = e.currentTarget;
                  cancelHold();
                  hold.current = window.setTimeout(() => {
                    held.current = true;
                    onOpenFormats?.(pageNum, target);
                  }, HOLD_MS);
                }}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelHold();
                  held.current = true;
                  onOpenFormats?.(pageNum, e.currentTarget);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelHold();
                  if (held.current) return;
                  onDownload?.(pageNum, defaultFormat);
                }}
                title={`Download as ${defaultFormat.toUpperCase()} (hold for other formats)`}
                aria-label={`Download page ${pageNum}`}
                className="absolute left-1.5 top-1.5 flex h-6 items-center gap-1 rounded-full bg-black/55 px-2 text-[10px] font-semibold uppercase text-white backdrop-blur-sm transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:hidden"
              >
                {isDownloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                {defaultFormat}
              </button>
            )}
          </>
        )}
      </div>
      <span
        className={`text-[11px] tabular-nums ${isCurrent || isSelected ? "font-semibold text-(--pv-accent)" : "text-(--pv-muted)"}`}
      >
        {pageNum}
      </span>
    </div>
  );
});

const SortableSlot: React.FC<Omit<CardProps, "url" | "isOverlay"> & { client: PdfWorkerClient; thumbnailsEnabled: boolean }> = React.memo(
  ({ client, thumbnailsEnabled, ...card }) => {
    const observe = useContext(ObserveContext);
    const url = useSyncExternalStore(
      useCallback((cb) => client.thumbnails.subscribe(card.pageNum, cb), [client, card.pageNum]),
      () => client.thumbnails.get(card.pageNum),
    );
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: String(card.pageNum),
    });
    const elRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!observe || !elRef.current) return;
      return observe(elRef.current, card.pageNum);
    }, [observe, card.pageNum]);

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          elRef.current = node;
        }}
        data-thumb={card.pageNum}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: isDragging ? undefined : transition,
          opacity: isDragging ? 0.3 : 1,
          touchAction: "pan-y",
        }}
        {...attributes}
        {...listeners}
        aria-label={`Page ${card.pageNum}`}
        aria-current={card.isCurrent ? "page" : undefined}
      >
        <ThumbnailCard {...card} url={url} thumbnailsEnabled={thumbnailsEnabled} />
      </div>
    );
  },
);

/* ── The grid ────────────────────────────────────────────────────────────── */

interface ThumbnailGridProps {
  client: PdfWorkerClient;
  scrollRoot: HTMLElement | null;
  pages: number[];
  currentPage: number;
  selectionMode: boolean;
  selected: Set<number>;
  rotations: Record<number, number>;
  columns: number;
  isDark: boolean;
  defaultFormat: ExportImageFormat;
  thumbnailsEnabled: boolean;
  downloadingPage: number | null;
  sidebarOpen?: boolean;
  sidebarWide?: boolean;
  onReorder: (pages: number[]) => void;
  onGoToPage: (page: number) => void;
  onToggleSelect: (page: number) => void;
  onDownloadPage: (page: number, format: ExportImageFormat) => void;
}

export const ThumbnailGrid: React.FC<ThumbnailGridProps> = ({
  client,
  scrollRoot,
  pages,
  currentPage,
  selectionMode,
  selected,
  rotations,
  columns,
  isDark,
  defaultFormat,
  thumbnailsEnabled,
  downloadingPage,
  sidebarOpen = true,
  sidebarWide = false,
  onReorder,
  onGoToPage,
  onToggleSelect,
  onDownloadPage,
}) => {
  const observe = useGridObserver(scrollRoot, client, thumbnailsEnabled);
  const [dragging, setDragging] = useState<number | null>(null);
  const [formatMenu, setFormatMenu] = useState<{ page: number; anchor: HTMLElement } | null>(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const rowCount = Math.ceil(pages.length / columns);
  const sortableItemIds = useMemo(() => pages.map(String), [pages]);

  const estimatedRowHeight = useMemo(() => {
    const width = scrollRoot?.clientWidth || (columns > 2 ? 480 : 240);
    const innerWidth = width - 24;
    const cardWidth = Math.max(70, (innerWidth - (columns - 1) * 12) / columns);
    return Math.round(cardWidth * 1.414 + 36);
  }, [scrollRoot?.clientWidth, columns]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRoot,
    estimateSize: () => estimatedRowHeight,
    overscan: 3,
    paddingStart: 12,
    paddingEnd: 12,
  });

  useEffect(() => {
    if (sidebarOpen) {
      rowVirtualizer.measure();
    }
  }, [sidebarOpen, columns, sidebarWide, rowVirtualizer]);

  // Keep the current page's thumbnail in view as the reader moves through the document
  const lastScrolledPage = useRef<number | null>(null);
  useEffect(() => {
    if (!scrollRoot || !sidebarOpen || lastScrolledPage.current === currentPage) return;
    const pageIndex = pages.indexOf(currentPage);
    if (pageIndex === -1) return;
    lastScrolledPage.current = currentPage;
    const rowIndex = Math.floor(pageIndex / columns);
    rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
  }, [currentPage, columns, pages, scrollRoot, sidebarOpen, rowVirtualizer]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onOpenFormats = useCallback((page: number, anchor: HTMLElement) => setFormatMenu({ page, anchor }), []);
  const closeFormats = useCallback(() => setFormatMenu(null), []);

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <ObserveContext.Provider value={observe}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setDragging(Number(e.active.id))}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          if (over && active.id !== over.id) {
            const list = pagesRef.current;
            onReorder(arrayMove(list, list.indexOf(Number(active.id)), list.indexOf(Number(over.id))));
          }
          setDragging(null);
        }}
        onDragCancel={() => setDragging(null)}
      >
        <SortableContext items={sortableItemIds} strategy={rectSortingStrategy}>
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const startIdx = virtualRow.index * columns;
              const rowPages = pages.slice(startIdx, startIdx + columns);

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    padding: "0 12px 16px 12px",
                  }}
                >
                  <div
                    className="grid gap-x-3"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  >
                    {rowPages.map((page) => (
                      <SortableSlot
                        key={page}
                        client={client}
                        pageNum={page}
                        rotation={rotations[page] || 0}
                        isCurrent={page === currentPage}
                        isSelected={selected.has(page)}
                        selectionMode={selectionMode}
                        isDownloading={downloadingPage === page}
                        defaultFormat={defaultFormat}
                        thumbnailsEnabled={thumbnailsEnabled}
                        onGoToPage={onGoToPage}
                        onToggleSelect={onToggleSelect}
                        onDownload={onDownloadPage}
                        onOpenFormats={onOpenFormats}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
          {dragging !== null ? (
            <ThumbnailCard
              pageNum={dragging}
              url={client.thumbnails.get(dragging)}
              rotation={rotations[dragging] || 0}
              isCurrent={dragging === currentPage}
              isSelected={selected.has(dragging)}
              selectionMode={selectionMode}
              defaultFormat={defaultFormat}
              thumbnailsEnabled={thumbnailsEnabled}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {formatMenu && (
        <FormatMenu
          anchor={formatMenu.anchor}
          pageNum={formatMenu.page}
          current={defaultFormat}
          isDark={isDark}
          onPick={(format) => {
            setFormatMenu(null);
            onDownloadPage(formatMenu.page, format);
          }}
          onClose={closeFormats}
        />
      )}
    </ObserveContext.Provider>
  );
};
