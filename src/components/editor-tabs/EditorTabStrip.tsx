/**
 * An editor group's row of tabs, VS Code style: click to show a file, double-click to keep a
 * preview open, drag to reorder - or into the other group's row to move it there - and a menu on
 * right-click, two-finger click, two-finger tap or a held finger.
 */
import React from "react";
import { X } from "lucide-react";
import type { EditorGroupId, WorkspaceTab } from "../../store/useStore";
import { useTabContextMenu, type TabMenuEntry } from "./useTabContextMenu";

/** What a dragged tab carries, so a drop knows which group it came from. */
const TAB_DRAG_TYPE = "application/x-dv-editor-tab";

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

const DROP_MARKS = [
  "border-l-[3px]",
  "border-l-blue-500",
  "pl-[9px]",
  "border-r-[3px]",
  "border-r-blue-500",
  "pr-[9px]",
];

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
  const menu = useTabContextMenu(menuFor);

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

  return (
    <div
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
      <div className="flex items-stretch flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {tabs.length === 0 && (
          <div className="px-4 flex items-center text-xs font-mono text-[var(--vsc-fg-muted)] italic">
            No files open
          </div>
        )}

        {tabs.map((tab, idx) => {
          const isActive = activePath === tab.path;
          const menuOpen = menu.openFor === tab.path;
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
                const left = dropSide(e) === "left";
                e.currentTarget.classList.remove(...DROP_MARKS);
                e.currentTarget.classList.add(
                  ...(left ? ["border-l-[3px]", "border-l-blue-500", "pl-[9px]"] : ["border-r-[3px]", "border-r-blue-500", "pr-[9px]"]),
                );
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
              className={`relative flex items-center gap-1.5 px-3 h-full text-[13px] border-r border-[var(--vsc-border)] transition-colors cursor-pointer shrink-0 group ${isActive
                ? `bg-[var(--vsc-tab-active)] text-[var(--vsc-fg)] after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-[var(--vsc-tab-active)] before:absolute before:inset-x-0 before:top-0 before:h-px ${focused ? "before:bg-[var(--vsc-accent)]" : "before:bg-[var(--vsc-border-strong)]"}`
                : "text-[var(--vsc-tab-inactive-fg)] hover:bg-[var(--vsc-hover)]"
                } ${menuOpen ? "ring-1 ring-inset ring-[var(--vsc-accent)]" : ""}`}
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
    </div>
  );
}
