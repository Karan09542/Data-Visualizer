import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, LayoutGrid, Rows3, HardDrive, Timer, Check, FolderOpen } from 'lucide-react';
import { getReceivedSettings, setReceivedSettings, subscribeReceived } from '../../utils/transferReceivedStore';

interface Props {
  isDark: boolean;
  onOpenReceived: () => void;
}

const MENU_W = 272;

/**
 * The chat's ⋮ menu: how several photos in one message are shown, and where received files are
 * kept. Drawn in a portal, so the scrolling toolbar never clips it.
 */
export function ChatOptionsMenu({ isDark, onOpenReceived }: Props) {
  const settings = useSyncExternalStore(subscribeReceived, getReceivedSettings);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const left = Math.min(window.innerWidth - MENU_W - 8, Math.max(8, r.right - MENU_W));
      setPos({ top: r.bottom + 6, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);

  const c = isDark
    ? { menu: 'bg-[#141b29] border-white/10 text-slate-200', sub: 'text-slate-400', head: 'text-slate-500', hover: 'hover:bg-white/[0.06]', on: 'bg-indigo-500/[0.12]', line: 'border-white/[0.06]', btn: 'hover:bg-white/[0.08] text-slate-400 hover:text-white', btnOn: 'bg-white/[0.1] text-white' }
    : { menu: 'bg-white border-slate-200 text-slate-800', sub: 'text-slate-500', head: 'text-slate-400', hover: 'hover:bg-slate-50', on: 'bg-indigo-50', line: 'border-slate-100', btn: 'hover:bg-slate-100 text-slate-500 hover:text-slate-900', btnOn: 'bg-slate-100 text-slate-900' };

  const option = (
    on: boolean,
    Icon: typeof LayoutGrid,
    label: string,
    hint: string,
    onPick: () => void,
  ) => (
    <button
      role="menuitemradio"
      aria-checked={on}
      onClick={onPick}
      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${on ? c.on : c.hover}`}
    >
      <Icon size={16} className={`mt-0.5 shrink-0 ${on ? 'text-indigo-400' : c.sub}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold">{label}</span>
        <span className={`block text-[11px] leading-snug ${c.sub}`}>{hint}</span>
      </span>
      {on && <Check size={14} className="mt-0.5 shrink-0 text-indigo-400" />}
    </button>
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Chat options"
        aria-label="Chat options"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors ${open ? c.btnOn : c.btn}`}
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Chat options"
            className={`fixed z-[12600] rounded-xl border shadow-2xl p-1.5 nodrag nowheel ${c.menu}`}
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <p className={`px-2.5 pt-1.5 pb-1 text-[11px] font-semibold ${c.head}`}>Several photos in one message</p>
            {option(settings.chatMedia === 'album', LayoutGrid, 'Group as album', 'Show up to 4, then "+N" for the rest', () => setReceivedSettings({ chatMedia: 'album' }))}
            {option(settings.chatMedia === 'all', Rows3, 'Show all', 'Every photo and video in the chat', () => setReceivedSettings({ chatMedia: 'all' }))}

            <div className={`my-1.5 border-t ${c.line}`} />
            <p className={`px-2.5 pt-1 pb-1 text-[11px] font-semibold ${c.head}`}>Files you receive</p>
            {option(settings.keepOnDevice, HardDrive, 'Keep on this device', 'Saved in this browser until you delete them', () => setReceivedSettings({ keepOnDevice: true }))}
            {option(!settings.keepOnDevice, Timer, 'Temporary', 'Gone when you close or reload the page. Best for small files', () => setReceivedSettings({ keepOnDevice: false }))}

            <div className={`my-1.5 border-t ${c.line}`} />
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenReceived();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-semibold transition-colors ${c.hover}`}
            >
              <FolderOpen size={16} className={c.sub} />
              Open received files
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
