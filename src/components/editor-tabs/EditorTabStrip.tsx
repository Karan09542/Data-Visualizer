/**
 * An editor group's row of tabs, VS Code style: click to show a file, double-click to keep a
 * preview open, drag to reorder - or into the other group's row to move it there - and a menu on
 * right-click, two-finger click, two-finger tap or a held finger.
 *
 * On a touch screen a tab is dragged by holding it and then moving: the held finger opens the
 * menu, and moving it closes the menu and picks the tab up. A quick swipe still scrolls the row.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { EditorGroupId, WorkspaceTab } from "../../store/useStore";
import { useTabContextMenu, type TabMenuEntry, type TabTouchDrag } from "./useTabContextMenu";

/** What a dragged tab carries, so a drop knows which group it came from. */
const TAB_DRAG_TYPE = "application/x-dv-editor-tab";
/** A tab dropped by a finger on a row: sent to that row, which may belong to the other group. */
const TAB_TOUCH_DROP = "dv-tab-touch-drop";

interface EditorTabStripProps {
  group: EditorGroupId;
  tabs: WorkspaceTab[];
  activePath: string | null;
  /** The group the reader is working in; its active tab gets the accent line. */
  focused: boolean;
  getIcon: (path: string, isActive: boolean) => React.ReactNode;
  getName: (path: string) => string;
  onActivate: (tab: WorkspaceTab) => void;
  onClose: (path: string) => void;
  onReorder: (tabs: WorkspaceTab[]) => void;
  onKeepOpen: (path: string) => void;
  /** A tab dropped here from the other group, and where it should go. */
  onMoveIn: (path: string, fromGroup: EditorGroupId, index: number) => void;
  menuFor: (path: string) => TabMenuEntry[];
  /** Buttons at the right end of the row. */
  actions?: React.ReactNode;
  hidden?: boolean;
}

const LEFT_MARK = ["border-l-[3px]", "border-l-blue-500", "pl-[9px]"];
const RIGHT_MARK = ["border-r-[3px]", "border-r-blue-500", "pr-[9px]"];
const DROP_MARKS = [...LEFT_MARK, ...RIGHT_MARK];

/** The colours the dragged tab's picture needs, read off the row so it keeps the workspace theme. */
const GHOST_VARS = ["--vsc-tab-active", "--vsc-fg", "--vsc-accent", "--vsc-border-strong", "--vsc-widget-shadow"];

interface TouchDragState {
  path: string;
  x: number;
  y: number;
  theme: Record<string, string>;
}

export function EditorTabStrip({
  group,
  tabs,
  activePath,
  focused,
  getIcon,
  getName,
  onActivate,
  onClose,
  onReorder,
  onKeepOpen,
  onMoveIn,
  menuFor,
  actions,
  hidden,
}: EditorTabStripProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [touchDrag, setTouchDrag] = useState<TouchDragState | null>(null);
  const markedTab = useRef<HTMLElement | null>(null);
  const touchTarget = useRef<{ root: HTMLElement; index: number } | null>(null);

  const dropSide = (e: React.DragEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? "left" : "right";
  };

  const readDrag = (e: React.DragEvent) => {
    try {
      const raw = e.dataTransfer.getData(TAB_DRAG_TYPE);
      return raw ? (JSON.parse(raw) as { group: EditorGroupId; path: string }) : null;
    } catch {
      return null;
    }
  };

  const dropAt = (from: { group: EditorGroupId; path: string }, toIndex: number) => {
    if (from.group !== group) {
      onMoveIn(from.path, from.group, toIndex);
      return;
    }
    const fromIdx = tabs.findIndex((t) => t.path === from.path);
    if (fromIdx < 0) return;
    let to = toIndex;
    if (fromIdx < to) to--; // the tab leaves its old place first
    if (fromIdx === to) return;
    const next = [...tabs];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  // A finger's drop arrives as an event on the row it ended over - this one, or the other group's.
  const dropAtRef = useRef(dropAt);
  dropAtRef.current = dropAt;
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onTouchDrop = (e: Event) => {
      const { group: fromGroup, path, index } = (e as CustomEvent).detail;
      dropAtRef.current({ group: fromGroup, path }, index);
    };
    el.addEventListener(TAB_TOUCH_DROP, onTouchDrop);
    return () => el.removeEventListener(TAB_TOUCH_DROP, onTouchDrop);
  }, []);

  const clearMark = () => {
    markedTab.current?.classList.remove(...DROP_MARKS);
    markedTab.current = null;
  };

  /** Where a finger at (x, y) would put a tab: which row, and at what place in it. */
  const locate = (x: number, y: number) => {
    const under = document.elementFromPoint(x, y) as HTMLElement | null;
    const root = under?.closest<HTMLElement>("[data-editor-group-tabs]");
    if (!under || !root) return null;
    const rowTabs = [...root.querySelectorAll<HTMLElement>("[data-tab-path]")];
    const tabEl = under.closest<HTMLElement>("[data-tab-path]");
    if (tabEl && root.contains(tabEl)) {
      const rect = tabEl.getBoundingClientRect();
      const left = x < rect.left + rect.width / 2;
      const i = rowTabs.indexOf(tabEl);
      return { root, tabEl, left, index: left ? i : i + 1 };
    }
    // Past the last tab: the end of the row.
    return { root, tabEl: null, left: false, index: rowTabs.length };
  };

  const finishTouchDrag = () => {
    clearMark();
    touchTarget.current = null;
    setTouchDrag(null);
  };

  const touchDragHandlers: TabTouchDrag = {
    onStart: (path, x, y) => {
      const style = rootRef.current ? getComputedStyle(rootRef.current) : null;
      const theme: Record<string, string> = {};
      for (const name of GHOST_VARS) {
        const value = style?.getPropertyValue(name).trim();
        if (value) theme[name] = value;
      }
      setTouchDrag({ path, x, y, theme });
    },
    onMove: (x, y) => {
      setTouchDrag((d) => (d ? { ...d, x, y } : d));
      const spot = locate(x, y);
      clearMark();
      touchTarget.current = spot ? { root: spot.root, index: spot.index } : null;
      if (spot?.tabEl) {
        spot.tabEl.classList.add(...(spot.left ? LEFT_MARK : RIGHT_MARK));
        markedTab.current = spot.tabEl;
      }
      // Near either end of a row, the row scrolls to bring more tabs into reach.
      const scroller = spot?.root.querySelector<HTMLElement>("[data-tab-scroll]");
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (x < r.left + 28) scroller.scrollLeft -= 12;
        else if (x > r.right - 28) scroller.scrollLeft += 12;
      }
    },
    onEnd: () => {
      const target = touchTarget.current;
      const dragged = touchDrag?.path;
      finishTouchDrag();
      if (!target || !dragged) return;
      target.root.dispatchEvent(new CustomEvent(TAB_TOUCH_DROP, { detail: { group, path: dragged, index: target.index } }));
    },
    onCancel: finishTouchDrag,
  };

  const menu = useTabContextMenu(menuFor, touchDragHandlers);

  return (
    <div
      ref={rootRef}
      data-editor-group-tabs={group}
      className={`items-stretch bg-[var(--vsc-tabbar)] select-none shrink-0 h-[35px] border-b border-[var(--vsc-border)] ${hidden ? "hidden" : "flex"}`}
      // Dropping on the empty end of the row puts the tab last.
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(TAB_DRAG_TYPE)) e.preventDefault();
      }}
      onDrop={(e) => {
        const from = readDrag(e);
        if (!from) return;
        e.preventDefault();
        dropAt(from, tabs.length);
      }}
    >
      <div data-tab-scroll className="flex items-stretch flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {tabs.length === 0 && (
          <div className="px-4 flex items-center text-xs font-mono text-[var(--vsc-fg-muted)] italic">
            No files open
          </div>
        )}

        {tabs.map((tab, idx) => {
          const isActive = activePath === tab.path;
          const menuOpen = menu.openFor === tab.path;
          const lifted = touchDrag?.path === tab.path;
          return (
            <button
              key={tab.path}
              type="button"
              data-tab-path={tab.path}
              draggable
              {...menu.bind(tab.path)}
              style={{ touchAction: "pan-x", WebkitTouchCallout: "none" } as React.CSSProperties}
              onDragStart={(e) => {
                (window as any).__isInternalDrag = true;
                e.dataTransfer.setData(TAB_DRAG_TYPE, JSON.stringify({ group, path: tab.path }));
                e.dataTransfer.setData("text/plain", idx.toString());
                e.dataTransfer.effectAllowed = "move";
                e.currentTarget.classList.add("opacity-50");
              }}
              onDragEnd={(e) => {
                (window as any).__isInternalDrag = false;
                e.currentTarget.classList.remove("opacity-50");
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove(...DROP_MARKS);
                e.currentTarget.classList.add(...(dropSide(e) === "left" ? LEFT_MARK : RIGHT_MARK));
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove(...DROP_MARKS)}
              onDrop={(e) => {
                e.currentTarget.classList.remove(...DROP_MARKS);
                const from = readDrag(e);
                if (!from) return;
                e.preventDefault();
                e.stopPropagation();
                dropAt(from, dropSide(e) === "left" ? idx : idx + 1);
              }}
              onDoubleClick={() => {
                if (tab.isPreview) onKeepOpen(tab.path);
              }}
              onClick={() => onActivate(tab)}
              onAuxClick={(e) => {
                // Middle click closes, as in VS Code.
                if (e.button === 1) {
                  e.preventDefault();
                  onClose(tab.path);
                }
              }}
              className={`relative flex items-center gap-1.5 px-3 h-full text-[13px] border-r border-[var(--vsc-border)] transition-[background-color,opacity] cursor-pointer shrink-0 group ${isActive
                ? `bg-[var(--vsc-tab-active)] text-[var(--vsc-fg)] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-[var(--vsc-tab-active)] before:absolute before:inset-x-0 before:top-0 before:h-px ${focused ? "before:bg-[var(--vsc-accent)]" : "before:bg-[var(--vsc-border-strong)]"}`
                : "text-[var(--vsc-tab-inactive-fg)] hover:bg-[var(--vsc-hover)]"
                } ${menuOpen ? "ring-1 ring-inset ring-[var(--vsc-accent)]" : ""} ${lifted ? "opacity-40" : ""}`}
            >
              {getIcon(tab.path, isActive)}
              <span className={`truncate max-w-[100px] sm:max-w-[160px] ${tab.isPreview ? "italic" : ""}`}>
                {getName(tab.path)}
              </span>

              <span
                role="button"
                aria-label={`Close ${getName(tab.path)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.path);
                }}
                className={`ml-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] transition-colors cursor-pointer ${tab.isDirty ? "" : isActive ? "opacity-100 pointer-coarse:opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-60"} hover:bg-[var(--vsc-active)] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)]`}
              >
                {tab.isDirty ? <div className="w-2 h-2 rounded-full bg-[var(--vsc-fg)] group-hover:hidden" /> : null}
                <X size={12} className={tab.isDirty ? "hidden group-hover:block" : ""} />
              </span>
            </button>
          );
        })}
      </div>

      {actions && <div className="flex items-center gap-0.5 px-1.5 shrink-0 border-l border-[var(--vsc-border)]">{actions}</div>}

      {menu.element}

      {/* The tab under the finger while it is dragged */}
      {touchDrag &&
        createPortal(
          <div
            data-tab-drag-ghost
            aria-hidden="true"
            className="fixed z-[10000] pointer-events-none flex items-center gap-1.5 h-[32px] px-3 rounded-[6px] text-[13px] border shadow-lg"
            style={{
              ...(touchDrag.theme as React.CSSProperties),
              left: touchDrag.x,
              top: touchDrag.y,
              transform: "translate(-50%, calc(-100% - 18px)) scale(1.04)",
              background: "var(--vsc-tab-active, #1e1e1e)",
              color: "var(--vsc-fg, #ccc)",
              borderColor: "var(--vsc-accent, #3b82f6)",
              boxShadow: "0 8px 24px var(--vsc-widget-shadow, rgba(0,0,0,.4))",
            }}
          >
            {getIcon(touchDrag.path, true)}
            <span className="truncate max-w-[160px]">{getName(touchDrag.path)}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
