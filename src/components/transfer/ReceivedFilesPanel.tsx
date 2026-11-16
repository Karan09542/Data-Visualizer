import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Send,
  Trash2,
  Eye,
  HardDrive,
  ShieldCheck,
  File as FileIcon,
  Image as ImageIcon,
  ImageOff,
  Film,
  Music,
  FileText,
  CheckSquare,
  Square,
  Loader2,
  Check,
  Play,
  LayoutGrid,
  List as ListIcon,
  Maximize2,
  Minimize2,
  Search,
  ShieldAlert,
} from 'lucide-react';
import CustomSelect from '../CustomSelect';
import { ReceivedViewer } from './ReceivedViewer';
import { FileTypeIcon } from './FileTypeIcon';
import { useStore } from '../../store/useStore';
import { formatFileSize } from '../../lib/formatFileSize';
import {
  type AutoClean,
  type ReceivedFileRecord,
  type ReceivedSort,
  type StorageInfo,
  deleteReceived,
  getReceivedFile,
  getReceivedSettings,
  listReceived,
  receivedStorageInfo,
  refreshReceived,
  requestPersistentStorage,
  saveManyToDevice,
  saveReceivedToDevice,
  setReceivedSettings,
  subscribeReceived,
} from '../../utils/transferReceivedStore';
import { getThumbnail, peekThumbnail, thumbKind } from '../../utils/transferThumbs';

interface Props {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  /** A peer is connected, so files can be sent on. */
  canSend: boolean;
  onSend: (files: File[]) => void;
}

const size = (b: number) => formatFileSize(b, 'B', 1);

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};

const kindOf = (r: ReceivedFileRecord): 'image' | 'video' | 'audio' | 'pdf' | 'other' => {
  const t = thumbKind(r);
  if (t) return t;
  const m = r.mime || '';
  const ext = r.name.split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('audio/') || /^(mp3|wav|ogg|m4a|flac)$/.test(ext)) return 'audio';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'other';
};

const KIND_ICON = { image: ImageIcon, video: Film, audio: Music, pdf: FileText, other: FileIcon };

type Category = 'all' | 'image' | 'video' | 'audio' | 'doc' | 'other';
const DOC_EXT = /^(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|md|csv|tsv|json|xml|ya?ml|html?|sql|sqlite|db)$/;
const categoryOf = (r: ReceivedFileRecord): Exclude<Category, 'all'> => {
  const k = kindOf(r);
  if (k === 'image' || k === 'video' || k === 'audio') return k;
  if (k === 'pdf' || DOC_EXT.test(r.name.split('.').pop()?.toLowerCase() || '')) return 'doc';
  return 'other';
};
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'doc', label: 'Documents' },
  { id: 'other', label: 'Other' },
];
const SORT_OPTIONS: { value: ReceivedSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'largest', label: 'Largest first' },
  { value: 'name', label: 'Name A–Z' },
];

const CLEAN_OPTIONS: { value: AutoClean; label: string }[] = [
  { value: 'off', label: 'Never' },
  { value: 'saved', label: 'After saving' },
  { value: '1d', label: 'After 1 day' },
  { value: '7d', label: 'After 7 days' },
  { value: '30d', label: 'After 30 days' },
];

/* Layout of the virtual list and grid. */
const ROW_H = 64;
const GRID_PAD = 12;
const GRID_GAP = 10;
const GRID_INFO_H = 46; // name and size under a tile
/** Shown on hover where there is a mouse; always shown on touch screens. */
const HOVER_REVEAL = '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100 transition-opacity';
const OVERSCAN_PX = 320;

/**
 * A file's picture: its preview where it has one (made when first shown, then cached), its type
 * icon otherwise. Leaving the screen before the preview's turn cancels it.
 */
function Thumb({ rec, enabled, iconSize }: { rec: ReceivedFileRecord; enabled: boolean; iconSize: number }) {
  const kind = thumbKind(rec);
  const can = enabled && rec.status === 'complete' && !!kind;
  const [url, setUrl] = useState<string | null | undefined>(() => (can ? peekThumbnail(rec.id) : null));

  useEffect(() => {
    if (!can) {
      setUrl(null);
      return;
    }
    const known = peekThumbnail(rec.id);
    if (known !== undefined) {
      setUrl(known);
      return;
    }
    setUrl(undefined);
    let live = true;
    getThumbnail(rec.id, () => live).then((u) => {
      if (live && u !== undefined) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [rec.id, can]);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {url ? (
        <img src={url} alt="" draggable={false} decoding="async" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <>
          {can && url === undefined && <div className="absolute inset-0 animate-pulse bg-current opacity-[0.07]" />}
          <FileTypeIcon name={rec.name} mime={rec.mime} size={iconSize} label={iconSize >= 20} fill />
        </>
      )}
      {kind === 'video' && url && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="h-7 w-7 rounded-full bg-black/55 text-white inline-flex items-center justify-center backdrop-blur-sm">
            <Play size={13} className="ml-0.5" fill="currentColor" />
          </span>
        </span>
      )}
    </div>
  );
}

/** Received files kept in the browser: save them, send them on, open them or free the space. */
export function ReceivedFilesPanel({ open, onClose, isDark, canSend, onSend }: Props) {
  const records = useSyncExternalStore(subscribeReceived, listReceived);
  const settings = useSyncExternalStore(subscribeReceived, getReceivedSettings);
  const setNotification = useStore((s) => s.setNotification);
  const setActivePreviewMedia = useStore((s) => s.setActivePreviewMedia);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  /** The file open in the viewer, as an index into the files that can be opened. */
  const [viewing, setViewing] = useState<number | null>(null);

  const { view, previews, fullscreen, sort } = settings;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');

  const counts = useMemo(() => {
    const c: Record<Category, number> = { all: records.length, image: 0, video: 0, audio: 0, doc: 0, other: 0 };
    for (const r of records) c[categoryOf(r)]++;
    return c;
  }, [records]);
  // What is listed: this category, matching the search, in the chosen order.
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter((r) => (category === 'all' || categoryOf(r) === category) && (!q || r.name.toLowerCase().includes(q)));
    const by: Record<ReceivedSort, (a: ReceivedFileRecord, b: ReceivedFileRecord) => number> = {
      newest: (a, b) => b.receivedAt - a.receivedAt,
      oldest: (a, b) => a.receivedAt - b.receivedAt,
      largest: (a, b) => b.size - a.size,
      name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    };
    return list.sort(by[sort] ?? by.newest);
  }, [records, query, category, sort]);
  // Opening a file pages through the received files listed (finished ones), in the same order.
  const viewable = useMemo(() => sorted.filter((r) => r.status === 'complete'), [sorted]);
  useEffect(() => {
    if (!open) setViewing(null);
  }, [open]);
  useEffect(() => {
    setViewing((v) => (v === null ? v : viewable.length ? Math.min(v, viewable.length - 1) : null));
  }, [viewable.length]);

  // Back to the top when what is listed changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [query, category, sort]);
  const usedBytes = useMemo(() => records.reduce((s, r) => s + (r.received || 0), 0), [records]);

  // The scroll area: where it is scrolled to and how big it is, for drawing only what shows.
  // The element is tracked, not just read once: the list is drawn afresh after the viewer closes
  // (and on full screen / view changes), and a removed element reports a size of 0 × 0.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const attachScroll = React.useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    setScrollEl(el);
  }, []);
  /** Where the list was scrolled to, so closing the viewer comes back to the same place. */
  const savedTop = useRef(0);
  const [vp, setVp] = useState({ top: 0, h: 600, w: 480 });
  const scrollFrame = useRef(0);
  useLayoutEffect(() => {
    const el = scrollEl;
    if (!el) return;
    if (savedTop.current && el.scrollTop !== savedTop.current) el.scrollTop = savedTop.current;
    const measure = () => {
      if (!el.isConnected || !el.clientWidth || !el.clientHeight) return; // removed, or not laid out yet
      setVp({ top: el.scrollTop, h: el.clientHeight, w: el.clientWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollEl, fullscreen, view]);
  useEffect(() => {
    if (!open) savedTop.current = 0;
  }, [open]);
  const onScroll = () => {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      savedTop.current = el.scrollTop;
      setVp((v) => (v.top === el.scrollTop ? v : { ...v, top: el.scrollTop }));
    });
  };
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  useEffect(() => {
    if (!open) return;
    void refreshReceived();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    receivedStorageInfo().then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, [open, records.length, usedBytes > 0]);
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(records.map((r) => r.id));
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [records]);
  const viewingRef = useRef(viewing);
  viewingRef.current = viewing;
  useEffect(() => {
    if (!open) return;
    // Captured and claimed, so Esc closes this panel only, not the full-screen chat beneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="listbox"]')) return; // a dropdown closes first
      if (viewingRef.current !== null) {
        // The viewer closes first, back to the list.
        e.preventDefault();
        e.stopImmediatePropagation();
        setViewing(null);
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const fail = (what: string, err: unknown) => {
    console.error(what, err);
    setNotification({ message: `${what}: ${(err as Error)?.message || err}`, type: 'error' });
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const save = (r: ReceivedFileRecord) =>
    run(`save:${r.id}`, async () => {
      try {
        if (await saveReceivedToDevice(r.id)) setNotification({ message: `Saved ${r.name}`, type: 'success' });
      } catch (err) {
        fail('Could not save the file', err);
      }
    });

  const send = (ids: string[]) =>
    run('send', async () => {
      const files: File[] = [];
      for (const id of ids) {
        const f = await getReceivedFile(id);
        if (f) files.push(f);
      }
      if (!files.length) return fail('Could not send', 'the files are no longer stored');
      onSend(files);
      setNotification({ message: files.length === 1 ? `Sending ${files[0].name}` : `Sending ${files.length} files`, type: 'success' });
    });

  const openFile = (r: ReceivedFileRecord) => {
    const i = viewable.findIndex((v) => v.id === r.id);
    if (i >= 0) setViewing(i);
  };

  const remove = (ids: string[], ask: boolean) =>
    run('delete', async () => {
      if (!ids.length) return;
      const unsaved = ids.filter((id) => !records.find((r) => r.id === id)?.savedAt).length;
      if (ask && !window.confirm(`Delete ${ids.length === 1 ? 'this file' : `${ids.length} files`}?${unsaved ? ' Files not saved to the device are lost.' : ''}`))
        return;
      await deleteReceived(ids);
    });

  const selectable = sorted.filter((r) => r.status !== 'receiving');
  const allOn = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const chosen = [...selected];
  const chosenComplete = chosen.filter((id) => records.find((r) => r.id === id)?.status === 'complete');
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const c = isDark
    ? {
        panel: 'bg-[#0e131d] border-white/[0.08] text-slate-200',
        sub: 'text-slate-400',
        row: 'hover:bg-white/[0.03] border-white/[0.05]',
        chip: 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200',
        track: 'bg-white/[0.08]',
        thumb: 'bg-white/[0.04] text-slate-500',
        line: 'border-white/[0.06]',
        field: 'bg-white/[0.03] border-white/[0.08] focus-within:border-emerald-500/50',
        seg: 'bg-white/[0.05]',
        segOn: 'bg-white/[0.12] text-white',
        segOff: 'text-slate-400 hover:text-slate-200',
        pillOn: 'bg-slate-100 text-slate-900',
        pillOff: 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09]',
        ghost: 'text-slate-400 hover:text-white hover:bg-white/[0.07]',
      }
    : {
        panel: 'bg-white border-slate-200 text-slate-800',
        sub: 'text-slate-500',
        row: 'hover:bg-slate-50 border-slate-100',
        chip: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
        track: 'bg-slate-200',
        thumb: 'bg-slate-100 text-slate-400',
        line: 'border-slate-100',
        field: 'bg-slate-50 border-slate-200 focus-within:border-emerald-500/60 focus-within:bg-white',
        seg: 'bg-slate-100',
        segOn: 'bg-white text-slate-900 shadow-sm',
        segOff: 'text-slate-500 hover:text-slate-800',
        pillOn: 'bg-slate-900 text-white',
        pillOff: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        ghost: 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
      };
  const ghostBtn = `h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-35 disabled:pointer-events-none ${c.ghost}`;
  const iconBtn = `h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-35 disabled:pointer-events-none ${c.ghost}`;
  const pct = info?.quota ? Math.min(100, (usedBytes / info.quota) * 100) : 0;
  const progress = (r: ReceivedFileRecord) => (r.size ? Math.min(100, Math.floor((r.received / r.size) * 100)) : 0);

  /* ---- what is on screen */
  const n = sorted.length;
  let totalH = 0;
  let items: { rec: ReceivedFileRecord; style: React.CSSProperties }[] = [];
  let cellW = 0;
  if (view === 'grid') {
    const inner = Math.max(0, vp.w - GRID_PAD * 2);
    const min = fullscreen ? 170 : 140;
    const cols = Math.max(2, Math.floor((inner + GRID_GAP) / (min + GRID_GAP)));
    cellW = (inner - (cols - 1) * GRID_GAP) / cols;
    const rowH = cellW + GRID_INFO_H + GRID_GAP;
    const rows = Math.ceil(n / cols);
    totalH = rows ? GRID_PAD * 2 + rows * rowH - GRID_GAP : 0;
    const first = Math.max(0, Math.floor((vp.top - GRID_PAD - OVERSCAN_PX) / rowH));
    const last = Math.min(rows - 1, Math.floor((vp.top + vp.h + OVERSCAN_PX - GRID_PAD) / rowH));
    for (let r = first; r <= last; r++) {
      for (let col = 0; col < cols; col++) {
        const i = r * cols + col;
        if (i >= n) break;
        items.push({
          rec: sorted[i],
          style: { position: 'absolute', left: GRID_PAD + col * (cellW + GRID_GAP), top: GRID_PAD + r * rowH, width: cellW, height: cellW + GRID_INFO_H },
        });
      }
    }
  } else {
    totalH = n * ROW_H;
    const first = Math.max(0, Math.floor((vp.top - OVERSCAN_PX) / ROW_H));
    const last = Math.min(n - 1, Math.ceil((vp.top + vp.h + OVERSCAN_PX) / ROW_H));
    items = [];
    for (let i = first; i <= last; i++) {
      items.push({ rec: sorted[i], style: { position: 'absolute', left: 0, right: 0, top: i * ROW_H, height: ROW_H } });
    }
  }

  const checkbox = (r: ReceivedFileRecord, overlay = false) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggle(r.id);
      }}
      disabled={r.status === 'receiving'}
      className={`shrink-0 disabled:opacity-30 ${overlay ? `absolute top-1.5 left-1.5 z-10 h-7 w-7 inline-flex items-center justify-center rounded-md bg-black/45 text-white backdrop-blur-sm ${selected.size || selected.has(r.id) ? '' : HOVER_REVEAL}` : c.sub}`}
      aria-label={`Select ${r.name}`}
      aria-pressed={selected.has(r.id)}
    >
      {selected.has(r.id) ? <CheckSquare size={16} className="text-emerald-400" /> : <Square size={16} />}
    </button>
  );

  const statusLine = (r: ReceivedFileRecord) => {
    const live = r.status === 'receiving';
    if (live || r.status === 'partial') {
      const p = progress(r);
      return (
        <div className="mt-1 flex items-center gap-2">
          <div className={`h-1 flex-1 rounded-full overflow-hidden ${c.track}`}>
            <div className={`h-full rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${p}%` }} />
          </div>
          <span className={`text-[10px] font-semibold tabular-nums ${live ? 'text-emerald-500' : 'text-amber-500'}`}>
            {live ? `${p}%` : `Interrupted · ${p}%`}
          </span>
        </div>
      );
    }
    if (r.status === 'damaged') return <p className="mt-0.5 text-[10px] font-semibold text-red-500 truncate">Damaged in transfer: ask for it again</p>;
    if (r.savedAt)
      return (
        <p className="mt-0.5 text-[10px] font-semibold text-emerald-500 inline-flex items-center gap-1">
          <Check size={11} /> Saved to device
        </p>
      );
    return null;
  };

  const actions = (r: ReceivedFileRecord, btn: string, withOpen: boolean) => {
    const done = r.status === 'complete';
    return (
      <>
        {done && withOpen && (
          <button onClick={() => openFile(r)} disabled={!!busy} className={btn} title="Open" aria-label={`Open ${r.name}`}>
            {busy === `open:${r.id}` ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          </button>
        )}
        {done && (
          <button onClick={() => save(r)} disabled={!!busy} className={btn} title="Save to device" aria-label={`Save ${r.name} to device`}>
            {busy === `save:${r.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
        )}
        {done && (
          <button
            onClick={() => send([r.id])}
            disabled={!canSend || !!busy}
            className={btn}
            title={canSend ? 'Send to the connected device' : 'Connect to a device to send'}
            aria-label={`Send ${r.name}`}
          >
            <Send size={14} />
          </button>
        )}
        {r.status !== 'receiving' && (
          <button
            onClick={() => remove([r.id], !r.savedAt && done)}
            disabled={!!busy}
            className={`${btn} hover:!bg-red-500/15 hover:text-red-500`}
            title="Delete"
            aria-label={`Delete ${r.name}`}
          >
            <Trash2 size={14} />
          </button>
        )}
      </>
    );
  };


  if (viewing !== null && viewable[viewing]) {
    return (
      <ReceivedViewer
        items={viewable}
        index={viewing}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
        isDark={isDark}
        canSend={canSend}
        onSave={save}
        onSend={(r) => send([r.id])}
      />
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[12500] flex justify-center bg-black/60 backdrop-blur-sm nodrag nowheel ${fullscreen ? 'items-stretch' : 'items-end sm:items-center sm:p-4'}`}
      onClick={onClose}
      onKeyDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label="Received files"
        className={`flex flex-col shadow-2xl ${c.panel} ${
          fullscreen
            ? 'w-full h-full rounded-none border-0'
            : `w-full ${view === 'grid' ? 'sm:max-w-3xl' : 'sm:max-w-lg'} h-[88dvh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-2xl border`
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingTop: fullscreen ? 'env(safe-area-inset-top)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 sm:px-5 pt-4 pb-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-500/12 text-emerald-500 inline-flex items-center justify-center ring-1 ring-emerald-500/20">
            <HardDrive size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight truncate">Received files</p>
            <p className={`text-xs truncate ${c.sub}`}>
              {records.length ? (
                <>
                  {records.length} file{records.length === 1 ? '' : 's'} · {size(usedBytes)}
                  {info?.free != null && <span className="hidden sm:inline"> · {size(info.free)} free</span>}
                </>
              ) : (
                'Kept in this browser until you save or delete them'
              )}
            </p>
          </div>
          {/* View */}
          <div className={`hidden min-[400px]:flex p-0.5 rounded-lg ${c.seg}`} role="radiogroup" aria-label="View">
            {(
              [
                ['list', 'List', ListIcon],
                ['grid', 'Grid', LayoutGrid],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="radio"
                aria-checked={view === id}
                aria-label={`${label} view`}
                title={`${label} view`}
                onClick={() => setReceivedSettings({ view: id })}
                className={`h-7 w-8 inline-flex items-center justify-center rounded-md transition-colors ${view === id ? c.segOn : c.segOff}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <button
            onClick={() => setReceivedSettings({ view: view === 'grid' ? 'list' : 'grid' })}
            className={`min-[400px]:hidden ${ghostBtn}`}
            title={view === 'grid' ? 'List view' : 'Grid view'}
            aria-label={view === 'grid' ? 'List view' : 'Grid view'}
          >
            {view === 'grid' ? <ListIcon size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button
            onClick={() => setReceivedSettings({ previews: !previews })}
            className={`${ghostBtn} ${previews ? 'text-emerald-500' : ''}`}
            title={previews ? 'Hide previews' : 'Show picture and video previews'}
            aria-label="Previews"
            aria-pressed={previews}
          >
            {previews ? <ImageIcon size={16} /> : <ImageOff size={16} />}
          </button>
          <button
            onClick={() => setReceivedSettings({ fullscreen: !fullscreen })}
            className={ghostBtn}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} className={ghostBtn} title="Close (Esc)" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Storage */}
        {records.length > 0 && (
          <div className="shrink-0 px-4 sm:px-5 pb-3 flex items-center gap-3">
            <div className={`h-1 flex-1 rounded-full overflow-hidden ${c.track}`} title={info?.quota ? `${size(usedBytes)} of ${size(info.quota)}` : undefined}>
              <div className="h-full bg-emerald-500 rounded-full transition-[width]" style={{ width: `${Math.max(pct, usedBytes ? 1 : 0)}%` }} />
            </div>
            {info && !info.persisted ? (
              <button
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setInfo(await receivedStorageInfo());
                  setNotification({ message: ok ? 'Files are protected from automatic clearing' : 'The browser did not allow it; save important files to the device', type: ok ? 'success' : 'warning' });
                }}
                title="The browser may clear these files when the device is low on space. Protect asks it not to."
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500 hover:text-amber-400"
              >
                <ShieldAlert size={13} /> Protect files
              </button>
            ) : info?.persisted ? (
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500" title="The browser will not clear these files on its own">
                <ShieldCheck size={13} /> Protected
              </span>
            ) : null}
          </div>
        )}

        {/* Search and order */}
        {records.length > 0 && (
          <div className="shrink-0 px-4 sm:px-5 pb-2.5 flex items-center gap-2">
            <label className={`h-8 flex-1 min-w-0 flex items-center gap-2 px-2.5 rounded-lg border transition-colors ${c.field}`}>
              <Search size={14} className={`shrink-0 ${c.sub}`} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setQuery('');
                  }
                }}
                placeholder="Search files"
                aria-label="Search files"
                className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-slate-500"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search" className={`shrink-0 ${c.sub} hover:opacity-80`}>
                  <X size={13} />
                </button>
              )}
            </label>
            <CustomSelect
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setReceivedSettings({ sort: v as ReceivedSort })}
              variant="toolbar"
              menuTitle="Sort by"
              className="w-[132px] shrink-0 [&>button]:h-8"
            />
          </div>
        )}

        {/* Type */}
        {records.length > 0 && (
          <div className="shrink-0 px-4 sm:px-5 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="File type">
            {CATEGORIES.filter((k) => k.id === 'all' || counts[k.id] > 0).map((k) => (
              <button
                key={k.id}
                role="tab"
                aria-selected={category === k.id}
                onClick={() => setCategory(k.id)}
                className={`h-7 px-2.5 shrink-0 inline-flex items-center gap-1.5 rounded-full text-xs font-medium transition-colors ${category === k.id ? c.pillOn : c.pillOff}`}
              >
                {k.label}
                <span className={`tabular-nums text-[10px] ${category === k.id ? 'opacity-70' : 'opacity-60'}`}>{counts[k.id]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Selection, or auto-delete and delete all */}
        {records.length > 0 && (
          <div className={`flex items-center gap-2 px-4 sm:px-5 h-11 shrink-0 border-y ${c.line} ${selected.size ? (isDark ? 'bg-emerald-500/[0.06]' : 'bg-emerald-50/70') : ''}`}>
            <button
              onClick={() => setSelected(allOn ? new Set() : new Set(selectable.map((r) => r.id)))}
              disabled={!selectable.length}
              className={`inline-flex items-center gap-2 text-xs font-medium disabled:opacity-40 ${selected.size ? '' : c.sub}`}
              aria-label={allOn ? 'Select none' : 'Select all'}
            >
              {allOn ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} />}
              {selected.size ? `${selected.size} selected` : 'Select all'}
            </button>
            <span className="flex-1" />
            {selected.size > 0 ? (
              <>
                <button
                  disabled={!chosenComplete.length || !!busy}
                  onClick={() =>
                    run('save-many', async () => {
                      try {
                        const k = await saveManyToDevice(chosenComplete);
                        if (k) setNotification({ message: `Saved ${k} file${k === 1 ? '' : 's'}`, type: 'success' });
                      } catch (err) {
                        fail('Could not save the files', err);
                      }
                    })
                  }
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-35 ${c.chip}`}
                >
                  <Download size={14} /> <span className="hidden min-[380px]:inline">Save</span>
                </button>
                <button
                  disabled={!canSend || !chosenComplete.length || !!busy}
                  onClick={() => send(chosenComplete)}
                  title={canSend ? 'Send to the connected device' : 'Connect to a device to send'}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-35 ${c.chip}`}
                >
                  <Send size={14} /> <span className="hidden min-[380px]:inline">Send</span>
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => remove(chosen, true)}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-35"
                >
                  <Trash2 size={14} /> <span className="hidden min-[380px]:inline">Delete</span>
                </button>
                <button onClick={() => setSelected(new Set())} className={ghostBtn} title="Clear selection" aria-label="Clear selection">
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <span className={`hidden min-[420px]:inline text-xs ${c.sub}`}>Auto-delete</span>
                <CustomSelect
                  value={settings.autoClean}
                  options={CLEAN_OPTIONS}
                  onChange={(v) => setReceivedSettings({ autoClean: v as AutoClean })}
                  variant="toolbar"
                  menuTitle="Delete received files automatically"
                  className="w-[128px] shrink-0"
                />
                <button
                  disabled={!selectable.length || !!busy}
                  onClick={() => remove(selectable.map((r) => r.id), true)}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:opacity-35"
                  title={category !== 'all' || query ? 'Delete the files listed' : 'Delete every received file'}
                >
                  {category !== 'all' || query ? 'Delete these' : 'Delete all'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Files: only those on screen are drawn */}
        <div ref={attachScroll} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {n === 0 ? (
            records.length ? (
              <div className={`px-6 py-14 text-center text-xs ${c.sub}`}>
                <Search size={26} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">No files match</p>
                <button
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                  }}
                  className="mt-2 font-semibold text-emerald-500 hover:text-emerald-400"
                >
                  Show all files
                </button>
              </div>
            ) : (
              <div className={`px-6 py-14 text-center text-xs leading-relaxed ${c.sub}`}>
                <div className={`mx-auto mb-4 h-14 w-14 rounded-2xl inline-flex items-center justify-center ${c.thumb}`}>
                  <HardDrive size={24} />
                </div>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>No received files yet</p>
                <p className="mt-1">Files you receive are kept here until you save or delete them.</p>
              </div>
            )
          ) : (
            <div className="relative w-full" style={{ height: totalH }}>
              {items.map(({ rec: r, style }) =>
                view === 'grid' ? (
                  <div key={r.id} style={style} className="group relative flex flex-col">
                    <div className={`relative w-full shrink-0 rounded-xl overflow-hidden ${c.thumb} ${selected.has(r.id) ? 'ring-2 ring-emerald-500 ring-offset-2 ' + (isDark ? 'ring-offset-[#0f1523]' : 'ring-offset-white') : ''}`} style={{ height: cellW }}>
                      <button
                        onClick={() => (r.status === 'complete' ? openFile(r) : toggle(r.id))}
                        className="absolute inset-0"
                        aria-label={r.status === 'complete' ? `Open ${r.name}` : r.name}
                      >
                        <Thumb rec={r} enabled={previews} iconSize={Math.round(Math.min(32, cellW / 5))} />
                      </button>
                      {checkbox(r, true)}
                      {(r.status === 'partial' || r.status === 'receiving' || r.status === 'damaged') && (
                        <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-black/60 backdrop-blur-sm text-white">
                          {r.status === 'damaged' ? (
                            <p className="text-[10px] font-semibold text-red-300">Damaged</p>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                                <div className={`h-full rounded-full ${r.status === 'receiving' ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${progress(r)}%` }} />
                              </div>
                              <span className="text-[10px] font-semibold tabular-nums">{progress(r)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                      {r.status !== 'receiving' && (
                        <div className={`absolute top-1.5 right-1.5 flex gap-1 p-0.5 rounded-lg bg-black/45 backdrop-blur-sm ${HOVER_REVEAL}`}>
                          {actions(r, 'h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-white/90 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-35 disabled:pointer-events-none', false)}
                        </div>
                      )}
                    </div>
                    <div className="pt-1.5 px-0.5 min-w-0">
                      <p className="text-[11px] font-semibold truncate" title={r.name}>
                        {r.name}
                      </p>
                      <p className={`text-[10px] truncate ${c.sub}`}>
                        {size(r.size)} · {r.savedAt ? 'saved' : ago(r.receivedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={r.id} style={style} className={`group flex items-center gap-3 px-4 border-b ${c.row} ${selected.has(r.id) ? (isDark ? 'bg-emerald-500/[0.06]' : 'bg-emerald-50') : ''}`}>
                    {checkbox(r)}
                    <button
                      onClick={() => r.status === 'complete' && openFile(r)}
                      className={`relative h-10 w-10 shrink-0 rounded-lg overflow-hidden ${c.thumb}`}
                      aria-label={`Open ${r.name}`}
                      tabIndex={r.status === 'complete' ? 0 : -1}
                    >
                      <Thumb rec={r} enabled={previews} iconSize={16} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate" title={r.name}>
                        {r.name}
                      </p>
                      <p className={`text-[10px] truncate ${c.sub}`}>
                        {size(r.size)} · {ago(r.receivedAt)}
                        {r.from ? ` · from ${r.from}` : ''}
                      </p>
                      {statusLine(r)}
                    </div>
                    <div className={`flex items-center gap-1.5 ${HOVER_REVEAL}`}>{actions(r, iconBtn, true)}</div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
