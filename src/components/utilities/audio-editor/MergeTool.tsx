import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Combine, GripVertical, Trash2 } from "lucide-react";
import { FileDropzoneUpload } from "../FileDropzoneUpload";
import { probe, useJob, fsName } from "./hooks";
import { Select, Slider, ACCEPT_MEDIA, ActionBar, Card, CommandLine, Field, IconButton, OutputCard, ResultCard, ToggleRow, bytes } from "./ui";
import { useAccent } from "./palette";
import { DEFAULT_MERGE, DEFAULT_OUTPUT, estimateBytes, formatInfo, formatTime, mergeArgs, mergeLength, type MergeSettings, type OutputSettings, type ProbeInfo } from "./commands";

interface Item {
  id: string;
  file: File;
  info?: ProbeInfo;
  error?: string;
}

const isMedia = (f: File) => /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|wma|aiff?|amr|webm|mkv|mp4|mov|3gp|avi)$/i.test(f.name);

export const MergeTool: React.FC<{ ready: boolean; file: File | null; onUse: (f: File) => void; onLibrary: () => void }> = ({ ready, file, onUse, onLibrary }) => {
  const a = useAccent();
  const make = (files: File[]) => files.filter(isMedia).map((f) => ({ id: Math.random().toString(36).slice(2, 10), file: f }));
  const [items, setItems] = useState<Item[]>(() => (file ? make([file]) : []));
  const [m, setM] = useState<MergeSettings>(DEFAULT_MERGE);
  const [out, setOut] = useState<OutputSettings>(DEFAULT_OUTPUT);
  const [dragging, setDragging] = useState<string | null>(null);
  const reading = useRef(new Set<string>());
  const { job, output, run } = useJob();

  useEffect(() => {
    if (!ready) return;
    for (const it of items) {
      if (it.info || it.error || reading.current.has(it.id)) continue;
      reading.current.add(it.id);
      probe(it.file).then(
        (info) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, info, error: info.hasAudio ? undefined : "No sound in this file" } : x))),
        (e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, error: String(e?.message || e) } : x))),
      );
    }
  }, [items, ready]);

  const move = (from: number, to: number) =>
    setItems((xs) => {
      if (to < 0 || to >= xs.length || from === to) return xs;
      const next = [...xs];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });

  const usable = items.filter((i) => i.info?.hasAudio);
  const settled = items.length > 0 && items.every((i) => i.info || i.error);
  const lengths = usable.map((i) => i.info?.duration ?? 0);
  const maxCross = Math.max(0.5, Math.min(10, Math.floor((Math.min(...lengths, 20) / 2) * 2) / 2));
  const merge = { ...m, crossfade: Math.min(m.crossfade, maxCross) };
  const total = mergeLength(lengths, merge);
  const fmt = formatInfo(out.format);
  const names = usable.map((it, i) => fsName(`in${i}`, it.file));
  const args = usable.length >= 2 ? mergeArgs(names, `merged.${fmt.ext}`, merge, out) : null;
  const key = JSON.stringify([merge, out, usable.map((i) => i.id)]);
  const est = estimateBytes({ ...out, sampleRate: out.sampleRate || 48000 }, total, 48000, 2);
  const outdated = !!output && output.key !== key;

  return (
    <div className="flex flex-col gap-4">
      <FileDropzoneUpload
        onFilesSelected={(f) => setItems((xs) => [...xs, ...make(f)])}
        multiple
        accept={ACCEPT_MEDIA}
        title={items.length ? "Add more files" : "Drop the files to merge"}
        subtitle="Two or more audio or video files · they play in the order below"
        accentColor="blue"
        compact={items.length > 0}
        enableCamera={false}
        enableClipboard={false}
      />

      {items.length > 0 && (
        <Card
          title={`${items.length} file${items.length === 1 ? "" : "s"}${usable.length > 1 ? ` · ${formatTime(total, 0)}` : ""}`}
          icon={Combine}
          right={
            <button onClick={() => setItems([])} className="text-xs font-medium text-slate-500 hover:text-red-500">
              Clear all
            </button>
          }
        >
          {usable.length > 1 && (
            <div className="flex h-1.5 mb-4 rounded-full overflow-hidden gap-0.5">
              {usable.map((it, i) => (
                <div key={it.id} className={i % 2 ? "bg-slate-300 dark:bg-slate-600" : a.fill} style={{ flex: it.info?.duration || 1 }} title={it.file.name} />
              ))}
            </div>
          )}
          <ul className="flex flex-col -my-1">
            {items.map((it, i) => (
              <li
                key={it.id}
                draggable
                onDragStart={() => setDragging(it.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  const from = items.findIndex((x) => x.id === dragging);
                  if (dragging && from !== i) move(from, i);
                }}
                onDragEnd={() => setDragging(null)}
                className={`group flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 ${dragging === it.id ? "opacity-40" : ""}`}
              >
                <GripVertical size={15} className="hidden sm:block text-slate-300 dark:text-slate-600 cursor-grab shrink-0" />
                <span className={`w-7 h-7 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center shrink-0 ${a.icon}`}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-900 dark:text-slate-100 truncate">{it.file.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {it.info?.duration != null && `${formatTime(it.info.duration, 0)} · `}
                    {bytes(it.file.size)}
                    {!it.info && !it.error && ready && " · reading…"}
                    {it.error && <span className="text-red-500"> · {it.error}</span>}
                  </p>
                </div>
                <IconButton label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton label="Move down" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}>
                  <ArrowDown size={15} />
                </IconButton>
                <IconButton label="Remove" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} className="hover:!text-red-500">
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length > 0 && (
        <>
          <Card title="Joining" icon={Combine}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
              <Slider label="Crossfade" value={merge.crossfade} min={0} max={maxCross} step={0.5} onChange={(v) => setM({ ...m, crossfade: v })} format={(v) => (v ? `${v} s overlap` : "Off")} ends={["Off", "Long blend"]} />
              <Slider label="Gap between" value={m.gap} min={0} max={5} step={0.5} onChange={(v) => setM({ ...m, gap: v })} format={(v) => (v ? `${v} s silence` : "None")} disabled={merge.crossfade > 0} />
              <ToggleRow label="Even out loudness" hint="Every part sounds equally loud" checked={m.normalize} onChange={(v) => setM({ ...m, normalize: v })} />
              {m.normalize && (
                <Field label="Target">
                  <Select label="Target" value={String(m.loudness)} onChange={(v) => setM({ ...m, loudness: Number(v) as MergeSettings["loudness"] })} options={[{ label: "Podcast · −16 LUFS", value: "-16" }, { label: "Music apps · −14", value: "-14" }, { label: "Broadcast · −23", value: "-23" }]} />
                </Field>
              )}
            </div>
          </Card>
          <OutputCard o={out} set={(x) => setOut((o) => ({ ...o, ...x }))} autoRate="Automatic · 48 kHz" />
          <CommandLine args={args} />
          {output && <ResultCard output={output} outdated={outdated} onUse={onUse} onLibrary={onLibrary} />}
          <ActionBar
            job={job}
            icon={Combine}
            canRun={ready && !!args && settled}
            outdated={outdated}
            label={outdated ? "Merge again" : `Merge into ${fmt.label}`}
            summary={!ready ? "Set up the engine to merge" : usable.length < 2 ? (settled ? "Add at least two files with sound" : "Reading files…") : `${usable.length} files · ${formatTime(total, 0)} · ${fmt.label}${est ? ` · ~${bytes(est)}` : ""}`}
            onRun={() =>
              args &&
              run({
                args,
                inputs: usable.map((it, i) => ({ name: names[i], data: it.file })),
                outputs: [`merged.${fmt.ext}`],
                name: () => `${usable[0].file.name.replace(/\.[^.]+$/, "")} (merged).${fmt.ext}`,
                key,
                seconds: total,
                tool: "Merge Audio",
              })
            }
          />
        </>
      )}
    </div>
  );
};
