import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
  Film,
  Music,
  FileText,
  AlertTriangle,
  CheckSquare,
  Square,
  Loader2,
  Check,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatFileSize } from '../../lib/formatFileSize';
import {
  type AutoClean,
  type ReceivedFileRecord,
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
  const m = r.mime || '';
  const ext = r.name.split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/') || /^(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(ext)) return 'image';
  if (m.startsWith('video/') || /^(mp4|webm|mov|mkv)$/.test(ext)) return 'video';
  if (m.startsWith('audio/') || /^(mp3|wav|ogg|m4a|flac)$/.test(ext)) return 'audio';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'other';
};

const KIND_ICON = { image: ImageIcon, video: Film, audio: Music, pdf: FileText, other: FileIcon };

const CLEAN_OPTIONS: { value: AutoClean; label: string }[] = [
  { value: 'off', label: 'Never' },
  { value: 'saved', label: 'After saving' },
  { value: '1d', label: 'After 1 day' },
  { value: '7d', label: 'After 7 days' },
  { value: '30d', label: 'After 30 days' },
];

/** Received files kept in the browser: save them, send them on, open them or free the space. */
export function ReceivedFilesPanel({ open, onClose, isDark, canSend, onSend }: Props) {
  const records = useSyncExternalStore(subscribeReceived, listReceived);
  const settings = useSyncExternalStore(subscribeReceived, getReceivedSettings);
  const setNotification = useStore((s) => s.setNotification);
  const setActivePreviewMedia = useStore((s) => s.setActivePreviewMedia);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = useMemo(() => [...records].sort((a, b) => b.receivedAt - a.receivedAt), [records]);
  const usedBytes = useMemo(() => records.reduce((s, r) => s + (r.received || 0), 0), [records]);

  useEffect(() => {
    if (!open) return;
    void refreshReceived();
  }, [open]);
  // Storage figures: on open and whenever the list changes size.
  useEffect(() => {
    if (!open) return;
    let live = true;
    receivedStorageInfo().then((i) => live && setInfo(i));
    return () => {
      live = false;
    };
  }, [open, records.length, usedBytes > 0]);
  // Selection only holds files that still exist.
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(records.map((r) => r.id));
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [records]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  const openFile = (r: ReceivedFileRecord) =>
    run(`open:${r.id}`, async () => {
      const f = await getReceivedFile(r.id);
      if (!f) return fail('Could not open', 'the file is no longer stored');
      const url = URL.createObjectURL(f);
      const k = kindOf(r);
      if (k === 'image' || k === 'video' || k === 'audio' || k === 'pdf') setActivePreviewMedia({ url, type: k });
      else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    });

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
    ? { panel: 'bg-[#0f1523] border-white/10 text-slate-200', sub: 'text-slate-400', row: 'hover:bg-white/[0.04] border-white/[0.06]', chip: 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200', track: 'bg-white/10' }
    : { panel: 'bg-white border-slate-200 text-slate-800', sub: 'text-slate-500', row: 'hover:bg-slate-50 border-slate-100', chip: 'bg-slate-100 hover:bg-slate-200 text-slate-700', track: 'bg-slate-200' };
  const iconBtn = `h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-35 disabled:pointer-events-none ${c.chip}`;
  const pct = info?.quota ? Math.min(100, (usedBytes / info.quota) * 100) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[12500] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 nodrag nowheel"
      onClick={onClose}
      onKeyDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label="Received files"
        className={`w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-2xl border shadow-2xl ${c.panel}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-500 inline-flex items-center justify-center">
            <HardDrive size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Received files</p>
            <p className={`text-[11px] ${c.sub}`}>
              {records.length ? `${records.length} file${records.length === 1 ? '' : 's'} · ${size(usedBytes)}` : 'Kept in this browser until you save or delete them'}
            </p>
          </div>
          <button onClick={onClose} className={iconBtn} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Storage */}
        <div className="px-4 pb-3">
          <div className={`h-1.5 rounded-full overflow-hidden ${c.track}`}>
            <div className="h-full bg-emerald-500 rounded-full transition-[width]" style={{ width: `${Math.max(pct, usedBytes ? 1 : 0)}%` }} />
          </div>
          <div className={`mt-1.5 flex justify-between text-[10px] font-medium ${c.sub}`}>
            <span>{size(usedBytes)} used</span>
            <span>{info?.free != null ? `${size(info.free)} free` : ''}</span>
          </div>
          {info && !info.persisted && records.length > 0 && (
            <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] ${isDark ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-800'}`}>
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1 leading-snug">The browser may clear these when the device is low on space. Save the ones you need.</span>
              <button
                onClick={async () => {
                  const ok = await requestPersistentStorage();
                  setInfo(await receivedStorageInfo());
                  setNotification({ message: ok ? 'Files are protected from automatic clearing' : 'The browser did not allow it; save important files to the device', type: ok ? 'success' : 'warning' });
                }}
                className="shrink-0 inline-flex items-center gap-1 font-bold underline-offset-2 hover:underline"
              >
                <ShieldCheck size={13} /> Protect
              </button>
            </div>
          )}
        </div>

        {/* Toolbar: selection actions, or auto-clean and delete all */}
        {records.length > 0 && (
          <div className={`flex items-center gap-2 px-4 py-2 border-y ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
            <button
              onClick={() => setSelected(allOn ? new Set() : new Set(selectable.map((r) => r.id)))}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${c.sub}`}
              aria-label={allOn ? 'Select none' : 'Select all'}
            >
              {allOn ? <CheckSquare size={15} className="text-emerald-500" /> : <Square size={15} />}
              {selected.size ? `${selected.size} selected` : 'Select'}
            </button>
            <span className="flex-1" />
            {selected.size > 0 ? (
              <>
                <button
                  disabled={!chosenComplete.length || !!busy}
                  onClick={() =>
                    run('save-many', async () => {
                      try {
                        const n = await saveManyToDevice(chosenComplete);
                        if (n) setNotification({ message: `Saved ${n} file${n === 1 ? '' : 's'}`, type: 'success' });
                      } catch (err) {
                        fail('Could not save the files', err);
                      }
                    })
                  }
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 disabled:opacity-35 ${c.chip}`}
                >
                  <Download size={13} /> Save
                </button>
                <button
                  disabled={!canSend || !chosenComplete.length || !!busy}
                  onClick={() => send(chosenComplete)}
                  title={canSend ? 'Send to the connected device' : 'Connect to a device to send'}
                  className={`h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 disabled:opacity-35 ${c.chip}`}
                >
                  <Send size={13} /> Send
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => remove(chosen, true)}
                  className="h-8 px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-35"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </>
            ) : (
              <>
                <label className={`inline-flex items-center gap-1.5 text-[11px] ${c.sub}`}>
                  Auto-delete
                  <select
                    value={settings.autoClean}
                    onChange={(e) => setReceivedSettings({ autoClean: e.target.value as AutoClean })}
                    className={`h-7 rounded-md px-1.5 text-[11px] font-semibold outline-none ${c.chip}`}
                  >
                    {CLEAN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!selectable.length || !!busy}
                  onClick={() => remove(selectable.map((r) => r.id), true)}
                  className="h-7 px-2 rounded-md text-[11px] font-bold text-red-500 hover:bg-red-500/10 disabled:opacity-35"
                >
                  Delete all
                </button>
              </>
            )}
          </div>
        )}

        {/* Files */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sorted.length === 0 ? (
            <div className={`px-6 py-12 text-center text-xs ${c.sub}`}>
              <HardDrive size={28} className="mx-auto mb-3 opacity-40" />
              Large files you receive are stored here.
              <br />
              Save them to the device, send them on, or delete them to free space.
            </div>
          ) : (
            sorted.map((r) => {
              const Icon = KIND_ICON[kindOf(r)];
              const done = r.status === 'complete';
              const live = r.status === 'receiving';
              const p = r.size ? Math.min(100, Math.floor((r.received / r.size) * 100)) : 0;
              return (
                <div key={r.id} className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${c.row}`}>
                  <button
                    onClick={() => toggle(r.id)}
                    disabled={live}
                    className={`shrink-0 disabled:opacity-30 ${c.sub}`}
                    aria-label={`Select ${r.name}`}
                  >
                    {selected.has(r.id) ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} />}
                  </button>
                  <div className={`h-9 w-9 shrink-0 rounded-lg inline-flex items-center justify-center ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate" title={r.name}>
                      {r.name}
                    </p>
                    <p className={`text-[10px] truncate ${c.sub}`}>
                      {size(r.size)} · {ago(r.receivedAt)}
                      {r.from ? ` · from ${r.from}` : ''}
                    </p>
                    {(live || r.status === 'partial') && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className={`h-1 flex-1 rounded-full overflow-hidden ${c.track}`}>
                          <div className={`h-full rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${p}%` }} />
                        </div>
                        <span className={`text-[10px] font-semibold tabular-nums ${live ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {live ? `${p}%` : `Interrupted · ${p}%`}
                        </span>
                      </div>
                    )}
                    {r.status === 'damaged' && (
                      <p className="mt-0.5 text-[10px] font-semibold text-red-500">Damaged in transfer: ask for it again</p>
                    )}
                    {done && r.savedAt && (
                      <p className="mt-0.5 text-[10px] font-semibold text-emerald-500 inline-flex items-center gap-1">
                        <Check size={11} /> Saved to device
                      </p>
                    )}
                  </div>
                  {done && (
                    <>
                      <button onClick={() => openFile(r)} disabled={!!busy} className={iconBtn} title="Open" aria-label={`Open ${r.name}`}>
                        {busy === `open:${r.id}` ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => save(r)} disabled={!!busy} className={iconBtn} title="Save to device" aria-label={`Save ${r.name} to device`}>
                        {busy === `save:${r.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </button>
                      <button
                        onClick={() => send([r.id])}
                        disabled={!canSend || !!busy}
                        className={iconBtn}
                        title={canSend ? 'Send to the connected device' : 'Connect to a device to send'}
                        aria-label={`Send ${r.name}`}
                      >
                        <Send size={14} />
                      </button>
                    </>
                  )}
                  {!live && (
                    <button
                      onClick={() => remove([r.id], !r.savedAt && done)}
                      disabled={!!busy}
                      className={`${iconBtn} hover:!bg-red-500/15 hover:text-red-500`}
                      title="Delete"
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
