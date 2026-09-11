/**
 * The menu on an editor tab: right-click it, click it with two fingers on a touchpad, tap it with
 * two fingers or hold it on a touch screen.
 *
 * The menu is drawn at the pointer and kept inside the window. It is portalled to the body, so it
 * takes the workspace's theme colours along from the tab it was opened on.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** How long a finger must stay on a tab before its menu opens. */
const HOLD_MS = 500;
/** Moving further than this during a hold means the tab strip is being scrolled, not held. */
const MOVE_CANCEL_PX = 10;
/**
 * Clicking a tab half out of view scrolls the tab row to show it, just as the menu opens; that
 * scroll is not the reader scrolling away, so it does not close the menu.
 */
const SCROLL_GRACE_MS = 400;
const MENU_WIDTH = 264;

export interface TabMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Shown on the right, as VS Code shows keybindings. */
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export type TabMenuEntry = TabMenuItem | "separator";

/** The theme colours the menu needs, read off the tab so a themed workspace stays themed. */
const THEME_VARS = [
  "--vsc-widget",
  "--vsc-widget-shadow",
  "--vsc-border",
  "--vsc-border-strong",
  "--vsc-fg",
  "--vsc-fg-muted",
  "--vsc-hover",
  "--vsc-accent",
  "--vsc-accent-fg",
];

interface OpenMenu {
  x: number;
  y: number;
  path: string;
  openedAt: number;
  /** Opened by a finger: bigger rows, easier to hit. */
  touch: boolean;
  theme: Record<string, string>;
}

interface Hold {
  timer: number;
  x: number;
  y: number;
  path: string;
  el: HTMLElement;
}

const themeOf = (el: HTMLElement | null) => {
  const theme: Record<string, string> = {};
  if (!el) return theme;
  const style = getComputedStyle(el);
  for (const name of THEME_VARS) {
    const value = style.getPropertyValue(name).trim();
    if (value) theme[name] = value;
  }
  return theme;
};

export function useTabContextMenu(build: (path: string) => TabMenuEntry[]) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const hold = useRef<Hold | null>(null);
  // A touch that opened the menu is followed by a click on the tab; that click is not a choice.
  const swallowClickUntil = useRef(0);

  const close = useCallback(() => setMenu(null), []);

  const cancelHold = useCallback(() => {
    if (!hold.current) return;
    clearTimeout(hold.current.timer);
    hold.current = null;
  }, []);

  const open = useCallback((x: number, y: number, path: string, el: HTMLElement | null, touch: boolean) => {
    if (touch) swallowClickUntil.current = Date.now() + 600;
    setMenu({ x, y, path, touch, theme: themeOf(el), openedAt: Date.now() });
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  // Anywhere else, Escape, a scroll or a resize closes it.
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.("[data-tab-context-menu]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onScroll = (e: Event) => {
      if (Date.now() - menu.openedAt < SCROLL_GRACE_MS) return;
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.("[data-tab-context-menu]")) close();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [menu, close]);

  /** Spread onto a tab. */
  const bind = useCallback(
    (path: string) => ({
      onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const byTouch = !!hold.current || Date.now() < swallowClickUntil.current;
        cancelHold();
        open(e.clientX, e.clientY, path, e.currentTarget, byTouch);
      },
      onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
        if (e.touches.length >= 2) {
          // A two-finger tap. The first finger says which tab; it may be this one or another.
          const first = hold.current;
          const a = e.touches[0];
          const b = e.touches[1];
          cancelHold();
          open((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, first?.path ?? path, first?.el ?? e.currentTarget, true);
          return;
        }
        const t = e.touches[0];
        cancelHold();
        const el = e.currentTarget;
        hold.current = {
          x: t.clientX,
          y: t.clientY,
          path,
          el,
          timer: window.setTimeout(() => {
            const h = hold.current;
            hold.current = null;
            if (h) open(h.x, h.y, h.path, h.el, true);
          }, HOLD_MS),
        };
      },
      onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
        const h = hold.current;
        const t = e.touches[0];
        if (!h || !t) return;
        if (Math.hypot(t.clientX - h.x, t.clientY - h.y) > MOVE_CANCEL_PX) cancelHold();
      },
      onTouchEnd: cancelHold,
      onTouchCancel: cancelHold,
      onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
        if (Date.now() < swallowClickUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    }),
    [cancelHold, open],
  );

  const element = menu
    ? createPortal(
      <TabMenu menu={menu} entries={build(menu.path)} onClose={close} />,
      document.body,
    )
    : null;

  return { bind, element, close, openFor: menu?.path ?? null };
}

function TabMenu({ menu, entries, onClose }: { menu: OpenMenu; entries: TabMenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y, ready: false });
  const [focusIndex, setFocusIndex] = useState(-1);

  const items = entries.filter((e): e is TabMenuItem => e !== "separator");
  const enabled = items.filter((i) => !i.disabled);

  // Kept inside the window: flipped left or up when it would run off an edge.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { innerWidth: vw, innerHeight: vh } = window;
    const rect = el.getBoundingClientRect();
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > vw - 8) left = Math.max(8, menu.x - rect.width);
    if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
    setPos({ left, top, ready: true });
  }, [menu.x, menu.y]);

  // Arrow keys move through the enabled items, Enter picks one, as in VS Code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabled.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setFocusIndex((i) => {
          const step = e.key === "ArrowDown" ? 1 : -1;
          return (i + step + enabled.length) % enabled.length;
        });
      } else if (e.key === "Enter" && focusIndex >= 0) {
        e.preventDefault();
        e.stopPropagation();
        const item = enabled[focusIndex];
        onClose();
        item?.onSelect();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, focusIndex, onClose]);

  const row = menu.touch ? "min-h-[40px] text-[14px]" : "min-h-[26px] text-[12.5px]";

  return (
    <div
      ref={ref}
      data-tab-context-menu
      role="menu"
      aria-label="Tab actions"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[10000] py-1 rounded-[6px] border border-[var(--vsc-border-strong)] bg-[var(--vsc-widget)] text-[var(--vsc-fg)] shadow-[0_6px_24px_var(--vsc-widget-shadow)] select-none animate-in fade-in zoom-in-95 duration-75"
      style={{
        ...(menu.theme as React.CSSProperties),
        left: pos.left,
        top: pos.top,
        width: `min(${MENU_WIDTH}px, calc(100vw - 16px))`,
        visibility: pos.ready ? "visible" : "hidden",
      }}
    >
      {entries.map((entry, i) => {
        if (entry === "separator") {
          return <div key={`sep-${i}`} role="separator" className="my-1 mx-2 h-px bg-[var(--vsc-border-strong)] opacity-70" />;
        }
        const focused = !entry.disabled && enabled[focusIndex]?.id === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            data-menu-item={entry.id}
            onMouseEnter={() => setFocusIndex(enabled.findIndex((x) => x.id === entry.id))}
            onClick={() => {
              if (entry.disabled) return;
              onClose();
              entry.onSelect();
            }}
            className={`w-[calc(100%-8px)] mx-1 px-2.5 flex items-center gap-2.5 rounded-[4px] text-left transition-colors ${row} ${entry.disabled
              ? "opacity-40 cursor-default"
              : focused
                ? "bg-[var(--vsc-accent)] text-[var(--vsc-accent-fg)] cursor-pointer"
                : "hover:bg-[var(--vsc-accent)] hover:text-[var(--vsc-accent-fg)] cursor-pointer"
              }`}
          >
            <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-80">{entry.icon}</span>
            <span className="flex-1 truncate">{entry.label}</span>
            {entry.shortcut && !menu.touch && (
              <span className="text-[11px] opacity-70 font-mono shrink-0">{entry.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
