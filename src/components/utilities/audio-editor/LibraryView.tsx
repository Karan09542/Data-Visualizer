import React, { useEffect, useState } from "react";
import { Download, Film, Library, Loader2, Pause, Play, Trash2, WandSparkles } from "lucide-react";
import { useLibrary } from "./hooks";
import { clearLibrary, libraryOnDevice, readLibraryFile, removeFromLibrary, type LibraryItem } from "./library";
import { IconButton, bytes, card, download } from "./ui";

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(t).toLocaleDateString();
};

export const LibraryView: React.FC<{ onUse: (f: File) => void }> = ({ onUse }) => {
  const items = useLibrary();
  const [open, setOpen] = useState<{ id: string; url: string; video: boolean } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => () => open && URL.revokeObjectURL(open.url), [open]);

  const play = async (it: LibraryItem) => setOpen(open?.id === it.id ? null : { id: it.id, url: URL.createObjectURL(await readLibraryFile(it)), video: it.mime.startsWith("video/") });
  const total = (items ?? []).reduce((n, i) => n + i.size, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
        <Library size={14} />
        {items ? `${items.length} file${items.length === 1 ? "" : "s"} · ${bytes(total)} · ${libraryOnDevice() ? "kept on this device" : "kept until the page closes"}` : "Loading…"}
        {!!items?.length && (
          <span className="ml-auto">
            {confirm ? (
              <span className="flex gap-2">
                Delete everything?
                <button className="font-semibold text-red-500" onClick={() => clearLibrary().then(() => setConfirm(false))}>
                  Delete
                </button>
                <button onClick={() => setConfirm(false)}>Keep</button>
              </span>
            ) : (
              <button className="hover:text-red-500" onClick={() => setConfirm(true)}>
                Clear library
              </button>
            )}
          </span>
        )}
      </div>

      {items?.length === 0 && (
        <div className={`${card} p-10 flex flex-col items-center text-center gap-3`}>
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
            <Library size={26} />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nothing here yet</p>
          <p className="text-xs text-slate-500 max-w-xs">Everything you make with the tools is kept here — play it, download it, or carry on editing it in another tool.</p>
        </div>
      )}

      {!!items?.length && (
        <ul className={`${card} divide-y divide-slate-100 dark:divide-white/[0.06]`}>
          {items.map((it) => {
            const video = it.mime.startsWith("video/");
            const playing = open?.id === it.id;
            return (
              <li key={it.id} className="p-3 sm:px-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => play(it)} className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${playing ? "bg-violet-600 text-white" : "bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20"}`} aria-label={playing ? "Close player" : `Play ${it.name}`}>
                    {playing ? <Pause size={16} /> : video ? <Film size={16} /> : <Play size={16} className="ml-0.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{it.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {it.tool} · {bytes(it.size)} · {ago(it.createdAt)}
                    </p>
                  </div>
                  {!video && (
                    <IconButton label="Use in another tool" onClick={async () => (setBusy(it.id), onUse(await readLibraryFile(it).finally(() => setBusy(null))))}>
                      {busy === it.id ? <Loader2 size={14} className="animate-spin" /> : <WandSparkles size={14} />}
                      <span className="hidden sm:inline">Use in…</span>
                    </IconButton>
                  )}
                  <IconButton label={`Download ${it.name}`} onClick={async () => download(await readLibraryFile(it), it.name)}>
                    <Download size={16} />
                  </IconButton>
                  <IconButton label={`Delete ${it.name}`} onClick={() => removeFromLibrary(it.id)} className="hover:!text-red-500">
                    <Trash2 size={16} />
                  </IconButton>
                </div>
                {playing && (open!.video ? <video src={open!.url} controls autoPlay className="mt-3 w-full max-h-72 rounded-xl bg-black" /> : <audio src={open!.url} controls autoPlay className="mt-3 w-full h-10" />)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
