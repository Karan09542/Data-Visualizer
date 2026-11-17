import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileType, Download, Trash2, AlertCircle, Loader2, Check, ArrowRight, Archive } from "lucide-react";
import { FileDropzoneUpload } from "./FileDropzoneUpload";
import { AddToCanvasButton, type CanvasImage } from "./AddToCanvasButton";
import { ModernSlider } from "./ModernSlider";
import { ColorPickerTrigger } from "../image-workspace/components/shared/ColorPickers";
import {
  FORMATS,
  formatInfo,
  encodeBmp,
  packIco,
  icoSizesFor,
  outputName,
  uniqueNames,
  formatBytes,
  sizeChange,
  parseSolidColor,
  rgbToHex,
  type OutputFormat,
} from "./imageFormatEncoders";

interface Settings {
  format: OutputFormat;
  /** 10–100, for JPG / WebP / AVIF */
  quality: number;
  /** Percent of the original size */
  scale: number;
}

interface Result {
  blob: Blob;
  url: string;
  name: string;
  width: number;
  height: number;
  /** The settings it was made with; a different key means it's out of date. */
  key: string;
}

interface Item {
  id: string;
  file: File;
  previewUrl: string;
  working: boolean;
  /** Set when it couldn't be converted with the settings in `errorKey`. */
  error?: string;
  errorKey?: string;
  result?: Result;
  /** Original pixel size, known once it's been opened. */
  natural?: { width: number; height: number };
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** How long settings must stay still before sizes are worked out again. */
const SETTLE_MS = 180;
/** Decoded pictures kept ready, so moving a slider doesn't reopen every file (big photos use a lot of memory). */
const KEEP_DECODED = 6;

const QUALITY_MARKS = [
  { value: 60, label: "Smallest" },
  { value: 75, label: "Balanced" },
  { value: 85, label: "High" },
  { value: 95, label: "Best" },
];
const SCALE_MARKS = [
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "Original" },
];
const BACKGROUND_PRESETS = ["#FFFFFF", "#000000", "#F1F5F9", "#1E293B", "#FDE68A", "#BFDBFE"];

/** Reads any picture the browser understands (PNG, JPG, WebP, AVIF, GIF, BMP, SVG, ICO…). */
async function decode(file: File): Promise<Decoded> {
  if (file.type !== "image/svg+xml") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to an <img>, which handles SVG and a few more */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // An SVG without a size of its own gets a sensible one
    const width = img.naturalWidth || 1024;
    const height = img.naturalHeight || Math.round((width * 3) / 4);
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("This browser can't open this image type");
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Draws the picture at a size, optionally on a solid background, optionally centred on a square. */
function draw(source: CanvasImageSource, w: number, h: number, background?: string, square?: number) {
  const canvas = document.createElement("canvas");
  canvas.width = square ?? w;
  canvas.height = square ?? h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const dx = square ? (square - w) / 2 : 0;
  const dy = square ? (square - h) / 2 : 0;
  ctx.drawImage(source, dx, dy, w, h);
  return canvas;
}

async function encode(d: Decoded, s: Settings, background: [number, number, number], avifOk: boolean) {
  const w = Math.max(1, Math.round((d.width * s.scale) / 100));
  const h = Math.max(1, Math.round((d.height * s.scale) / 100));
  const f = formatInfo(s.format);

  if (s.format === "bmp") {
    const canvas = draw(d.source, w, h);
    const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
    return { blob: new Blob([encodeBmp(data, w, h, background) as BlobPart], { type: f.mime }), width: w, height: h };
  }

  if (s.format === "ico") {
    // Icons use the full picture, whatever the size setting
    const longest = Math.max(d.width, d.height);
    const entries: { size: number; png: Uint8Array }[] = [];
    for (const size of icoSizesFor(longest)) {
      const k = size / longest;
      const canvas = draw(d.source, Math.max(1, Math.round(d.width * k)), Math.max(1, Math.round(d.height * k)), undefined, size);
      const png = await toBlob(canvas, "image/png");
      if (png) entries.push({ size, png: new Uint8Array(await png.arrayBuffer()) });
    }
    const top = entries[entries.length - 1]?.size ?? 16;
    return { blob: new Blob([packIco(entries) as BlobPart], { type: f.mime }), width: top, height: top };
  }

  if (s.format === "avif" && !avifOk) throw new Error("This browser can't save AVIF");
  const canvas = draw(d.source, w, h, f.transparency ? undefined : rgbToHex(background));
  const blob = await toBlob(canvas, f.mime, f.lossy ? s.quality / 100 : undefined);
  // A browser that can't write a type quietly hands back a PNG instead
  if (!blob || blob.type !== f.mime) throw new Error(`This browser can't save ${f.label}`);
  return { blob, width: w, height: h };
}

/** Whether this browser can write AVIF (Chrome 121+, recent Firefox; not Safari yet). */
function useAvifSupport() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    c.toBlob((b) => setOk(b?.type === "image/avif"), "image/avif", 0.5);
  }, []);
  return ok;
}

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const ImageFormatConverter = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>({ format: "webp", quality: 85, scale: 100 });
  /** As the colour picker gives it (may be half-typed); the last real colour is what's used. */
  const [backgroundInput, setBackgroundInput] = useState("#FFFFFF");
  const lastBackground = useRef<[number, number, number]>([255, 255, 255]);
  const background = parseSolidColor(backgroundInput) ?? lastBackground.current;
  lastBackground.current = background;

  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const avifOk = useAvifSupport();

  const fmt = formatInfo(settings.format);
  /** Everything that changes the output. */
  const key = [
    settings.format,
    fmt.lossy ? settings.quality : "",
    fmt.transparency ? "" : rgbToHex(background),
    settings.format === "ico" ? "" : settings.scale,
  ].join("|");

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const live = useRef({ settings, background, key, avifOk });
  live.current = { settings, background, key, avifOk };
  const runId = useRef(0);
  const decoded = useRef(new Map<string, Decoded>());

  const dropDecoded = (id: string) => {
    decoded.current.get(id)?.close();
    decoded.current.delete(id);
  };
  const getDecoded = async (item: Item) => {
    const hit = decoded.current.get(item.id);
    if (hit) {
      // most recently used goes to the back
      decoded.current.delete(item.id);
      decoded.current.set(item.id, hit);
      return hit;
    }
    const d = await decode(item.file);
    decoded.current.set(item.id, d);
    while (decoded.current.size > KEEP_DECODED) dropDecoded(decoded.current.keys().next().value!);
    return d;
  };

  // Free everything when the tool closes
  useEffect(
    () => () => {
      runId.current++;
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.previewUrl);
        if (it.result) URL.revokeObjectURL(it.result.url);
      }
      for (const id of [...decoded.current.keys()]) dropDecoded(id);
    },
    [],
  );

  const setItem = (id: string, f: (i: Item) => Item) => setItems((prev) => prev.map((i) => (i.id === id ? f(i) : i)));

  /** Works out every image not yet made with the current settings, one at a time. */
  const run = async () => {
    const me = ++runId.current;
    const { settings: s, background: bg, key: k, avifOk: avif } = live.current;
    const todo = itemsRef.current.filter((i) => i.result?.key !== k && i.errorKey !== k);
    if (!todo.length) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const ext = formatInfo(s.format).ext;
    const names = uniqueNames(itemsRef.current.map((i) => outputName(i.file.name, ext)));
    const nameOf = new Map(itemsRef.current.map((i, n) => [i.id, names[n]]));

    for (const it of todo) {
      if (me !== runId.current) return; // settings changed: a newer run takes over
      if (!itemsRef.current.some((i) => i.id === it.id)) continue;
      setItem(it.id, (i) => ({ ...i, working: true }));
      try {
        const d = await getDecoded(it);
        if (!it.natural) setItem(it.id, (i) => ({ ...i, natural: { width: d.width, height: d.height } }));
        const out = await encode(d, s, bg, !!avif);
        if (me !== runId.current) {
          setItem(it.id, (i) => ({ ...i, working: false }));
          return;
        }
        const url = URL.createObjectURL(out.blob);
        setItem(it.id, (i) => {
          if (i.result) URL.revokeObjectURL(i.result.url);
          return { ...i, working: false, error: undefined, errorKey: undefined, result: { ...out, url, key: k, name: nameOf.get(it.id)! } };
        });
      } catch (err: any) {
        setItem(it.id, (i) => ({ ...i, working: false, error: err?.message || "Couldn't convert this image", errorKey: k }));
      }
      await new Promise((r) => setTimeout(r, 0)); // let the page breathe between images
    }
    if (me === runId.current) setBusy(false);
  };

  // Sizes follow the settings: work them out again shortly after anything changes
  const ids = items.map((i) => i.id).join(",");
  useEffect(() => {
    if (!ids) {
      runId.current++;
      setBusy(false);
      return;
    }
    const t = window.setTimeout(run, SETTLE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, key, avifOk]);

  const addFiles = (files: File[]) => {
    const fresh = files
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif|avif|ico|bmp|svg)$/i.test(f.name))
      .map<Item>((file) => ({ id: Math.random().toString(36).slice(2, 10), file, previewUrl: URL.createObjectURL(file), working: false }));
    if (fresh.length) setItems((prev) => [...prev, ...fresh]);
  };

  const remove = (id: string) =>
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) {
        URL.revokeObjectURL(it.previewUrl);
        if (it.result) URL.revokeObjectURL(it.result.url);
      }
      dropDecoded(id);
      return prev.filter((i) => i.id !== id);
    });

  const clearAll = () => {
    runId.current++;
    for (const it of items) {
      URL.revokeObjectURL(it.previewUrl);
      if (it.result) URL.revokeObjectURL(it.result.url);
    }
    for (const id of [...decoded.current.keys()]) dropDecoded(id);
    setItems([]);
  };

  const ready = items.filter((i) => i.result?.key === key);
  const failed = items.filter((i) => i.errorKey === key).length;
  const allReady = items.length > 0 && ready.length + failed === items.length && !busy;
  const totals = useMemo(
    () => ready.reduce((t, i) => ({ before: t.before + i.file.size, after: t.after + i.result!.blob.size }), { before: 0, after: 0 }),
    [ready],
  );

  const downloadAll = async () => {
    if (ready.length === 1) return download(ready[0].result!.blob, ready[0].result!.name);
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const i of ready) zip.file(i.result!.name, i.result!.blob);
      download(await zip.generateAsync({ type: "blob", compression: "STORE" }), `images-${fmt.ext}.zip`);
    } finally {
      setZipping(false);
    }
  };

  const canvasImages = (): CanvasImage[] =>
    ready.map((i) => ({ blob: i.result!.blob, name: i.result!.name.replace(/\.[^.]+$/, "") }));

  const chip = (active: boolean, disabled?: boolean) =>
    `relative px-3 py-2 rounded-xl border text-left transition-colors ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${
      active
        ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-500/40"
        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22] hover:border-slate-300 dark:hover:border-slate-700"
    }`;

  const bgHex = rgbToHex(background).toUpperCase();
  /** With one image, the size slider shows the pixel size it will have, straight away. */
  const sizeLabel = (v: number) => {
    const n = items.length === 1 ? items[0].natural : undefined;
    if (n) return `${v}% · ${Math.max(1, Math.round((n.width * v) / 100))}×${Math.max(1, Math.round((n.height * v) / 100))}`;
    return v === 100 ? "Original" : `${v}%`;
  };

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="flex flex-col items-stretch p-6 md:p-8 w-full max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-violet-200 dark:border-violet-800/50">
            <FileType size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Change Image Format</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Convert pictures to PNG, JPG, WebP, AVIF, BMP or ICO. Sizes update as you change the settings, and
            everything stays on your device.
          </p>
        </div>

        <div className="mb-6">
          <FileDropzoneUpload
            onFilesSelected={addFiles}
            multiple
            accept="image/*,.heic,.heif,.avif,.ico,.bmp,.svg"
            title={items.length ? "Add more images" : "Drop images to convert"}
            subtitle="PNG, JPG, WebP, AVIF, GIF, BMP, SVG, ICO • one or many"
            accentColor="purple"
            compact={items.length > 0}
          />
        </div>

        {/* Output settings */}
        <section className="mb-6 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#0d1117]/60">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Convert to</h3>
            {items.length > 0 && (
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 flex items-center gap-1.5" aria-live="polite">
                {busy ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-violet-500" /> Updating sizes…
                  </>
                ) : ready.length > 0 ? (
                  <>
                    {formatBytes(totals.before)} <ArrowRight size={11} />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{formatBytes(totals.after)}</span>
                    <span className={totals.after <= totals.before ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400 font-semibold"}>
                      {sizeChange(totals.before, totals.after)}
                    </span>
                  </>
                ) : null}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Output format">
            {FORMATS.map((f) => {
              const unsupported = f.id === "avif" && avifOk === false;
              const active = settings.format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={unsupported}
                  onClick={() => setSettings((s) => ({ ...s, format: f.id }))}
                  className={chip(active, unsupported)}
                  title={unsupported ? "This browser can't save AVIF" : f.hint}
                >
                  <span className={`block text-sm font-bold ${active ? "text-violet-700 dark:text-violet-300" : "text-slate-800 dark:text-slate-100"}`}>{f.label}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{unsupported ? "Not in this browser" : f.hint}</span>
                  {active && <Check size={14} className="absolute top-2 right-2 text-violet-500" />}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {fmt.lossy && (
              <ModernSlider
                label="Quality"
                value={settings.quality}
                min={10}
                max={100}
                onChange={(v) => setSettings((s) => ({ ...s, quality: v }))}
                format={(v) => `${v}%`}
                ends={["Smaller file", "Better quality"]}
                marks={QUALITY_MARKS}
              />
            )}

            {settings.format !== "ico" && (
              <ModernSlider
                label="Size"
                value={settings.scale}
                min={5}
                max={100}
                step={5}
                onChange={(v) => setSettings((s) => ({ ...s, scale: v }))}
                format={sizeLabel}
                ends={["Smaller", "Original"]}
                marks={SCALE_MARKS}
              />
            )}

            {!fmt.transparency && (
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Fill transparent areas with</span>
                <div className="flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-xl bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500/50 transition-colors w-full sm:w-auto">
                  <ColorPickerTrigger
                    color={backgroundInput}
                    onChange={setBackgroundInput}
                    presets={BACKGROUND_PRESETS}
                    title="Choose the fill colour"
                    label="Fill colour"
                    className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/20 shadow-inner cursor-pointer transition active:scale-95 shrink-0"
                    style={{ backgroundColor: bgHex }}
                  />
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">{bgHex}</span>
                  <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">{fmt.label} has no transparency</span>
                </div>
              </div>
            )}

            {settings.format === "ico" && (
              <p className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400">
                Each icon holds 16, 32, 48, 64, 128 and 256 px versions (as large as the picture allows), centred on a
                square. Use it as a website favicon or an app icon.
              </p>
            )}
          </div>
        </section>

        {items.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {items.length} image{items.length !== 1 ? "s" : ""}
                {failed > 0 && <span className="ml-2 text-xs font-medium text-red-500">{failed} couldn't be converted</span>}
              </h3>
              <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-600 font-medium">
                Clear all
              </button>
            </div>

            <ul className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
              {items.map((it) => {
                const res = it.result;
                const current = res?.key === key;
                const err = it.errorKey === key ? it.error : undefined;
                const from = (it.file.name.split(".").pop() || it.file.type.split("/")[1] || "?").toUpperCase();
                return (
                  <li key={it.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161b22]">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700/60 bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] dark:bg-[conic-gradient(#1e293b_25%,#0f172a_0_50%,#1e293b_0_75%,#0f172a_0)] bg-[length:12px_12px]">
                      <img src={res ? res.url : it.previewUrl} alt="" className="w-full h-full object-contain" draggable={false} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={it.file.name}>
                        {res ? res.name : it.file.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {from} · {formatBytes(it.file.size)}
                        </span>
                        {res && !err && (
                          <span className={`flex items-center gap-1.5 flex-wrap transition-opacity ${current ? "" : "opacity-50"}`}>
                            <ArrowRight size={11} className="shrink-0" />
                            <span className="text-slate-700 dark:text-slate-200 font-medium tabular-nums">
                              {formatInfo(res.key.split("|")[0] as OutputFormat).label} · {formatBytes(res.blob.size)}
                            </span>
                            <span
                              className={`font-semibold tabular-nums ${res.blob.size <= it.file.size ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
                            >
                              {sizeChange(it.file.size, res.blob.size)}
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {res.width}×{res.height}
                            </span>
                          </span>
                        )}
                        {!res && !err && <span className="text-violet-500">Working out size…</span>}
                        {err && (
                          <span className="text-red-500 flex items-center gap-1">
                            <AlertCircle size={11} /> {err}
                          </span>
                        )}
                      </p>
                    </div>
                    {it.working ? (
                      <Loader2 size={16} className="animate-spin text-violet-500 shrink-0 mx-2" />
                    ) : current ? (
                      <button
                        onClick={() => download(res!.blob, res!.name)}
                        className="p-2 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors shrink-0"
                        title={`Download ${res!.name}`}
                        aria-label={`Download ${res!.name}`}
                      >
                        <Download size={16} />
                      </button>
                    ) : null}
                    <button
                      onClick={() => remove(it.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                      title="Remove"
                      aria-label={`Remove ${it.file.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <button
                onClick={downloadAll}
                disabled={!allReady || ready.length === 0 || zipping}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-white transition-all shadow-sm bg-violet-600 hover:bg-violet-700 active:scale-[0.98] disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {zipping || !allReady ? <Loader2 size={18} className="animate-spin" /> : ready.length > 1 ? <Archive size={18} /> : <Download size={18} />}
                {!allReady
                  ? "Updating…"
                  : ready.length > 1
                    ? `Download all (${ready.length}) as ZIP · ${formatBytes(totals.after)}`
                    : `Download ${fmt.label} · ${formatBytes(totals.after)}`}
              </button>
              {settings.format !== "ico" && settings.format !== "bmp" && (
                <AddToCanvasButton
                  getImages={canvasImages}
                  group="converted_images"
                  disabled={!allReady || ready.length === 0}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  iconSize={16}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
