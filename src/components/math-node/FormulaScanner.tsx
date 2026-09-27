import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import * as mathjs from "mathjs";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Download,
  HardDrive,
  ImagePlus,
  ArrowDownToLine,
  Loader2,
  Plus,
  Replace,
  RotateCcw,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { CameraCaptureModal } from "../CameraCaptureModal";
import { ConfirmModal } from "../ConfirmModal";
import { latexToMathjs, type LatexLine, type LatexRowKind } from "../../lib/math/latexToMathjs";
import {
  cancelReaderDownload,
  downloadReader,
  onReaderStatus,
  readFormula,
  shutDownReader,
  tidyLatex,
  warmUpReader,
  type CropFractions,
  type DownloadProgress,
} from "../../lib/formulaReader/formulaReader";
import {
  TOTAL_BYTES,
  getStoredModel,
  isStorageAvailable,
  removeStoredModel,
  type StoredModel,
} from "../../lib/formulaReader/modelStore";

/** One row to add to the graph, as the scanner read it. */
export interface ScannedRow {
  kind: LatexRowKind;
  expr: string;
  /** Name for a point (the P in P = (2, 3)). */
  name?: string;
  /** For f(x) = …: the row that draws it. */
  plotExpr?: string;
}

/** Where read rows go when the scanner was opened for an existing row. */
export interface RowPlacement {
  fnId: string;
  /** replace: the first row takes the target's place (the rest follow it); below: all go under it. */
  mode: "replace" | "below";
}

interface FormulaScannerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Adds the rows; `sliders` are names the rows use that may need a slider. */
  onAddRows: (rows: ScannedRow[], sliders: string[], placement?: RowPlacement) => void;
  /** An existing row to replace or insert under, instead of adding at the end. */
  target?: { id: string; expr: string } | null;
}

export const KIND_LABEL: Record<LatexRowKind, string> = {
  function: "Curve",
  definition: "Definition",
  implicit: "Implicit curve",
  inequality: "Region",
  point: "Point",
  polar: "Polar curve",
  differential: "Differential equation",
  calculator: "Calculator",
};

export const KIND_STYLE: Record<LatexRowKind, string> = {
  function: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  definition: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  implicit: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  inequality: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  point: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  polar: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  differential: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  calculator: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const FULL_CROP: Crop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

export function renderTex(latex: string): string | null {
  try {
    return katex.renderToString(latex, { displayMode: true, throwOnError: true, strict: "ignore" });
  } catch {
    return null;
  }
}

/** The crop as fractions, or undefined when it is (nearly) the whole image. */
function cropFractions(crop: Crop | null): CropFractions | undefined {
  if (!crop || crop.unit !== "%") return undefined;
  if (crop.width >= 99.5 && crop.height >= 99.5) return undefined;
  if (crop.width < 1 || crop.height < 1) return undefined;
  return { x: crop.x / 100, y: crop.y / 100, width: crop.width / 100, height: crop.height / 100 };
}

/** Names an expression uses, for keeping only the sliders an edited row still needs. */
export function namesIn(expr: string): Set<string> {
  const names = new Set<string>();
  for (const statement of expr.split(";")) {
    // Primes and "=" aside (x'' = …, f(x) = …), a row is an ordinary expression.
    const clean = statement.replace(/'+/g, "").replace(/(^|[^<>!=])=(?!=)/, "$1==");
    try {
      mathjs.parse(clean).traverse((n: any) => {
        if (n.isSymbolNode) names.add(n.name);
      });
    } catch {
      for (const name of clean.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) names.add(name);
    }
  }
  return names;
}

/**
 * Reads a formula from a photo or screenshot and adds it to the graph. The reading
 * happens on this device, with a model downloaded once and kept in the browser.
 */
export const FormulaScanner: React.FC<FormulaScannerProps> = ({
  isOpen,
  onClose,
  onAddRows,
  target = null,
}) => {
  const [stored, setStored] = useState<StoredModel | null | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [readerStatus, setReaderStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [readCrop, setReadCrop] = useState<Crop | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [latex, setLatex] = useState("");
  const [readMs, setReadMs] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [makeSliders, setMakeSliders] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const readToken = useRef(0);

  // What's installed, and warm the model up so the first read is quick.
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    getStoredModel().then((s) => {
      if (!alive) return;
      setStored(s);
      if (s) warmUpReader();
    });
    const stop = onReaderStatus((status, detail) => {
      setReaderStatus(status);
      if (status === "error" && detail) setReadError(detail);
    });
    return () => {
      alive = false;
      stop();
    };
  }, [isOpen]);

  // Keep the object URL for the picture only as long as it's shown.
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  const takeImage = useCallback((blob: Blob) => {
    if (!blob.type.startsWith("image/")) {
      setReadError("That file isn't a picture. Choose a PNG, JPEG or WebP image.");
      return;
    }
    setImage({ blob, url: URL.createObjectURL(blob) });
    setCrop(FULL_CROP);
    setReadCrop(FULL_CROP);
    setLatex("");
    setReadMs(null);
    setReadError(null);
    setEdits({});
    setAdded(new Set());
  }, []);

  // Paste a screenshot straight in.
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      takeImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isOpen, takeImage]);

  /** Clears the last reading. */
  const resetResult = useCallback(() => {
    readToken.current++;
    setReading(false);
    setLatex("");
    setReadMs(null);
    setReadError(null);
    setEdits({});
    setAdded(new Set());
  }, []);

  // Each opening (possibly for a different row) starts without last time's result.
  useEffect(() => {
    if (isOpen) resetResult();
  }, [isOpen, target?.id, resetResult]);

  // Read whenever there is a picture, the reader is installed, and the box changed.
  useEffect(() => {
    if (!isOpen || !image || !stored || !readCrop) return;
    const token = ++readToken.current;
    setReading(true);
    setReadError(null);
    readFormula(image.blob, cropFractions(readCrop))
      .then((result) => {
        if (token !== readToken.current) return;
        setLatex(tidyLatex(result.latex));
        setReadMs(result.ms);
        setEdits({});
        setAdded(new Set());
        if (!result.latex) setReadError("No formula was found. Try cropping closer to it.");
      })
      .catch((e) => {
        if (token === readToken.current) setReadError(e?.message || String(e));
      })
      .finally(() => {
        if (token === readToken.current) setReading(false);
      });
  }, [isOpen, image, stored, readCrop]);

  const startDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    setProgress(null);
    try {
      const s = await downloadReader(setProgress);
      setStored(s);
      warmUpReader();
    } catch (e: any) {
      if (!e?.cancelled) setDownloadError(e?.message || String(e));
    } finally {
      setDownloading(false);
    }
  };

  const removeReader = async () => {
    setConfirmRemove(false);
    shutDownReader();
    await removeStoredModel();
    setStored(null);
    setReaderStatus("idle");
  };

  const lines: LatexLine[] = useMemo(() => (latex.trim() ? latexToMathjs(latex) : []), [latex]);
  const previewHtml = useMemo(() => (latex.trim() ? renderTex(latex) : null), [latex]);

  const exprOf = (i: number) => edits[i] ?? lines[i]?.expr ?? "";
  const addable = lines.map((l, i) => (!l.error && l.kind && exprOf(i).trim() ? i : -1)).filter((i) => i >= 0);
  const sliderNames = useMemo(() => {
    const names = new Set<string>();
    lines.forEach((l, i) => {
      const used = namesIn(exprOf(i));
      l.symbols.forEach((s) => used.has(s) && names.add(s));
    });
    return [...names];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, edits]);

  const add = (indexes: number[], mode?: RowPlacement["mode"]) => {
    const rows: ScannedRow[] = indexes.map((i) => ({
      kind: lines[i].kind!,
      expr: exprOf(i).trim(),
      name: lines[i].name,
      plotExpr: lines[i].plotExpr,
    }));
    const sliders = makeSliders
      ? [...new Set(indexes.flatMap((i) => {
          const used = namesIn(exprOf(i));
          return lines[i].symbols.filter((s) => used.has(s));
        }))]
      : [];
    onAddRows(rows, sliders, target && mode ? { fnId: target.id, mode } : undefined);
    setAdded((prev) => new Set([...prev, ...indexes]));
    // Replacing is a one-shot edit of that row: done, so get out of the way.
    if (mode === "replace") onClose();
  };

  const copyLatex = () => {
    navigator.clipboard?.writeText(latex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }, () => {});
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showCamera && !confirmRemove) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, showCamera, confirmRemove]);

  if (!isOpen) return null;

  const storageOk = isStorageAvailable();
  const pct = progress ? Math.min(100, (progress.loaded / progress.total) * 100) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={target ? "Rewrite a formula" : "Scan a formula"}
        className="w-full max-w-2xl max-h-full flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <ScanLine size={16} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {target ? "Rewrite formula" : "Scan a formula"}
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
            Photo or screenshot → equation
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
          {/* The reader itself: download once */}
          {stored === null && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/5 p-3.5 flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <Download size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">Download the formula reader</p>
                  <p>
                    It reads formulas from pictures on this device, so your images are never uploaded. It's a one-time
                    download of {mb(TOTAL_BYTES)}, kept in this browser so it also works offline.
                  </p>
                </div>
              </div>
              {!storageOk && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> This browser can't store files for the site (private mode or an in-app
                  browser?), so the reader can't be kept here.
                </p>
              )}
              {downloading ? (
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 rounded-full bg-blue-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-blue-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span>
                      {progress ? `${mb(progress.loaded)} of ${mb(progress.total)} · from ${progress.source}` : "Connecting…"}
                    </span>
                    <button
                      type="button"
                      onClick={cancelReaderDownload}
                      className="ml-auto px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!storageOk}
                    onClick={startDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow-sm"
                  >
                    <Download size={13} /> Download ({mb(TOTAL_BYTES)})
                  </button>
                  {image && <span className="text-[11px] text-slate-500 dark:text-slate-400">Your picture is read as soon as it's done.</span>}
                </div>
              )}
              {downloadError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {downloadError}
                </p>
              )}
            </div>
          )}

          {/* The row being rewritten */}
          {target && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
              <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold text-slate-500">Current</span>
              <code className="flex-1 min-w-0 truncate font-mono text-[12px] text-slate-700 dark:text-slate-200" title={target.expr}>
                {target.expr || "(empty)"}
              </code>
            </div>
          )}

          {/* The picture */}
          {!image ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
                if (file) takeImage(file);
              }}
              className={`rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-3 text-center transition-colors ${
                dragOver
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                  : "border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30"
              }`}
            >
              <ImagePlus size={28} className="text-slate-400 dark:text-slate-500" />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Drop a picture of a formula here, or paste a screenshot (Ctrl+V).
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                >
                  <ImagePlus size={13} /> Upload image
                </button>
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
                >
                  <Camera size={13} /> Take photo
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Printed and neat handwritten formulas both work. One formula per picture reads best.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Drag a box around the formula to read just that part.</span>
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setLatex("");
                    setReadError(null);
                  }}
                  className="ml-auto shrink-0 whitespace-nowrap flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <RotateCcw size={11} /> Another picture
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] dark:bg-slate-950 bg-[length:16px_16px] flex justify-center overflow-hidden">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percent) => setCrop(percent)}
                  onComplete={(_, percent) => setReadCrop(percent)}
                  keepSelection
                  ruleOfThirds={false}
                >
                  <img src={image.url} alt="The formula to read" className="max-h-[34vh] w-auto object-contain block" />
                </ReactCrop>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) takeImage(file);
              e.target.value = "";
            }}
          />

          {/* The result */}
          {image && stored && (reading || readError || latex) && (
            <div className="flex flex-col gap-3">
              {reading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  {readerStatus === "loading" ? "Starting the reader (first time only)…" : "Reading the formula…"}
                </div>
              )}
              {readError && !reading && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {readError}
                </p>
              )}

              {latex && (
                <>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-1 overflow-x-auto custom-scrollbar text-slate-900 dark:text-slate-100 min-h-[56px] text-[1.3rem]">
                    {previewHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    ) : (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 py-2">This LaTeX doesn't render; fix it below.</p>
                    )}
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      LaTeX
                      <span className="normal-case tracking-normal font-normal text-slate-400">edit to fix a misread symbol</span>
                      {readMs !== null && (
                        <span className="ml-auto normal-case tracking-normal font-normal text-slate-400">
                          read in {(readMs / 1000).toFixed(readMs < 1000 ? 2 : 1)} s
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={copyLatex}
                        title="Copy the LaTeX"
                        className={`${readMs === null ? "ml-auto" : ""} p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`}
                      >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </span>
                    <textarea
                      value={latex}
                      onChange={(e) => {
                        setLatex(e.target.value);
                        setEdits({});
                        setAdded(new Set());
                      }}
                      rows={Math.min(6, Math.max(2, latex.split("\n").length + 1))}
                      spellCheck={false}
                      className="w-full px-2.5 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[12px] text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 resize-y"
                    />
                  </label>

                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                      {lines.length === 1 ? "Row to add" : `Rows to add (${lines.length})`}
                    </span>
                    {lines.map((line, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-2.5 flex flex-col gap-1.5"
                      >
                        {line.error ? (
                          <>
                            <code className="text-[11px] text-slate-500 dark:text-slate-400 break-all">{line.latex}</code>
                            <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1.5">
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {line.error}
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${KIND_STYLE[line.kind!]}`}>
                                {KIND_LABEL[line.kind!]}
                              </span>
                              {line.kind === "polar" && <span className="text-[11px] font-mono text-slate-400">r =</span>}
                              {line.kind === "point" && line.name && (
                                <span className="text-[11px] font-mono text-slate-400">{line.name} =</span>
                              )}
                              <input
                                value={exprOf(i)}
                                onChange={(e) => setEdits((prev) => ({ ...prev, [i]: e.target.value }))}
                                spellCheck={false}
                                aria-label="Expression for the row"
                                className="flex-1 min-w-0 h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono text-[12px] text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                              />
                              {target ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => add([i], "below")}
                                    disabled={!exprOf(i).trim()}
                                    title="Add as a new row under the current one"
                                    className={`shrink-0 flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-semibold border transition-colors disabled:opacity-40 ${
                                      added.has(i)
                                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                                        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    {added.has(i) ? <Check size={12} /> : <ArrowDownToLine size={12} />}
                                    <span className="hidden sm:inline">{added.has(i) ? "Inserted" : "Insert below"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => add([i], "replace")}
                                    disabled={!exprOf(i).trim()}
                                    title="Replace the current row with this formula"
                                    className="shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
                                  >
                                    <Replace size={12} /> Replace
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => add([i])}
                                  disabled={!exprOf(i).trim()}
                                  className={`shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                                    added.has(i)
                                      ? "bg-emerald-600 text-white"
                                      : "bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
                                  }`}
                                >
                                  {added.has(i) ? <Check size={12} /> : <Plus size={12} />}
                                  {added.has(i) ? "Added" : "Add"}
                                </button>
                              )}
                            </div>
                            {line.plotExpr && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Also adds <code className="font-mono">{line.plotExpr}</code> to draw it.
                              </p>
                            )}
                            {line.notes.map((note) => (
                              <p key={note} className="text-[10px] leading-snug text-amber-700 dark:text-amber-400">
                                {note}
                              </p>
                            ))}
                          </>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-3 flex-wrap">
                      {sliderNames.length > 0 && (
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={makeSliders}
                            onChange={(e) => setMakeSliders(e.target.checked)}
                            className="accent-blue-600"
                          />
                          Make sliders for <span className="font-mono">{sliderNames.join(", ")}</span>
                        </label>
                      )}
                      {addable.length > 1 && (
                        <button
                          type="button"
                          onClick={() => add(addable.filter((i) => !added.has(i)), target ? "below" : undefined)}
                          disabled={addable.every((i) => added.has(i))}
                          className="ml-auto flex items-center gap-1 px-3 h-7 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
                        >
                          {target ? <ArrowDownToLine size={12} /> : <Plus size={12} />}
                          {target ? "Insert all below" : "Add all"}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer: what's stored */}
        {stored && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
            <HardDrive size={12} />
            <span>
              Formula reader: {mb(stored.bytes)} on this device
              {readerStatus === "loading" ? " · starting…" : readerStatus === "ready" ? " · ready" : ""}
            </span>
            <a
              href="https://github.com/alephpi/Texo"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline hover:underline"
              title="The model: Texo FormulaNet, AGPL-3.0"
            >
              · Texo model
            </a>
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600"
            >
              <Trash2 size={11} /> Remove
            </button>
          </div>
        )}
      </div>

      {showCamera && (
        <CameraCaptureModal
          onClose={() => setShowCamera(false)}
          onCapture={(file) => {
            setShowCamera(false);
            takeImage(file);
          }}
        />
      )}

      <ConfirmModal
        isOpen={confirmRemove}
        title="Remove the formula reader"
        message={
          <>
            Delete the reader from this browser to free {stored ? mb(stored.bytes) : "its space"}? You can download it again
            any time.
          </>
        }
        confirmText="Remove"
        variant="danger"
        onClose={() => setConfirmRemove(false)}
        onConfirm={removeReader}
      />
    </div>,
    document.body,
  );
};
