import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Check, Download, Loader2, PenLine, Replace, ScanText, X } from "lucide-react";
import { latexToMathjs, type LatexLine } from "../../lib/math/latexToMathjs";
import {
  cancelReaderDownload,
  downloadReader,
  onReaderStatus,
  readFormula,
  tidyLatex,
  warmUpReader,
  type DownloadProgress,
} from "../../lib/formulaReader/formulaReader";
import { TOTAL_BYTES, getStoredModel, isStorageAvailable, type StoredModel } from "../../lib/formulaReader/modelStore";
import { FormulaSketchPad, type FormulaSketchPadHandle } from "./FormulaSketchPad";
import { KIND_LABEL, KIND_STYLE, namesIn, renderTex, type ScannedRow } from "./FormulaScanner";

interface InlineFormulaDrawProps {
  /** The row's formula now; an empty row offers only "Use" (there is nothing to keep). */
  currentExpr: string;
  /** replace: the first row takes this row's place (the rest follow it); below: all go under it. */
  onApply: (rows: ScannedRow[], sliders: string[], mode: "replace" | "below") => void;
  onClose: () => void;
}

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

/** Per-browser preference: read while writing, or only when asked. */
const AUTO_READ_KEY = "mathNode.draw.autoRead";

function loadAutoRead(): boolean {
  try {
    return localStorage.getItem(AUTO_READ_KEY) !== "false";
  } catch {
    return true;
  }
}

function saveAutoRead(on: boolean) {
  try {
    localStorage.setItem(AUTO_READ_KEY, String(on));
  } catch {
    // Storage blocked (private mode): the choice just lasts for this session.
  }
}

/**
 * Handwriting input that lives inside an equation row: write the formula, it is read on this
 * device as you write, and the result replaces the row or is inserted under it.
 */
export const InlineFormulaDraw: React.FC<InlineFormulaDrawProps> = ({ currentExpr, onApply, onClose }) => {
  const [stored, setStored] = useState<StoredModel | null | undefined>(undefined);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [readerStatus, setReaderStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const [sketch, setSketch] = useState<Blob | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [latex, setLatex] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [inserted, setInserted] = useState(false);
  const [autoRead, setAutoRead] = useState(loadAutoRead);

  const padRef = useRef<FormulaSketchPadHandle>(null);
  const readToken = useRef(0);
  const isEmptyRow = !currentExpr.trim();

  useEffect(() => {
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
  }, []);

  const clearResult = useCallback(() => {
    readToken.current++;
    setReading(false);
    setLatex("");
    setReadError(null);
    setEdits({});
  }, []);

  const runRead = useCallback((blob: Blob) => {
    const token = ++readToken.current;
    setReading(true);
    setReadError(null);
    readFormula(blob)
      .then((result) => {
        if (token !== readToken.current) return;
        setLatex(tidyLatex(result.latex));
        setEdits({});
        if (!result.latex) setReadError("No formula was found. Try writing a little larger and clearer.");
      })
      .catch((e) => {
        if (token === readToken.current) setReadError(e?.message || String(e));
      })
      .finally(() => {
        if (token === readToken.current) setReading(false);
      });
  }, []);

  // Auto-read: read the ink whenever it settles (and once the reader arrives, or auto-read is
  // switched on, with ink already on the pad).
  useEffect(() => {
    if (autoRead && stored && sketch) runRead(sketch);
  }, [autoRead, stored, sketch, runRead]);

  const handleInk = useCallback((blob: Blob | null) => {
    setSketch(blob);
    setInserted(false);
    // Without auto-read, a result for older ink would be stale: drop it until Read is pressed.
    if (!blob || !autoRead) clearResult();
  }, [autoRead, clearResult]);

  const toggleAutoRead = () => {
    const next = !autoRead;
    setAutoRead(next);
    saveAutoRead(next);
  };

  /** Manual mode: take the ink as it is right now (no waiting for the pen to rest) and read it. */
  const readNow = async () => {
    const blob = await padRef.current?.flush();
    if (blob && stored) runRead(blob);
  };

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

  const lines: LatexLine[] = useMemo(() => (latex.trim() ? latexToMathjs(latex) : []), [latex]);
  const previewHtml = useMemo(() => (latex.trim() ? renderTex(latex) : null), [latex]);
  const exprOf = (i: number) => edits[i] ?? lines[i]?.expr ?? "";
  const usable = lines.map((l, i) => (!l.error && l.kind && exprOf(i).trim() ? i : -1)).filter((i) => i >= 0);

  const apply = (mode: "replace" | "below") => {
    if (usable.length === 0) return;
    const rows: ScannedRow[] = usable.map((i) => ({
      kind: lines[i].kind!,
      expr: exprOf(i).trim(),
      name: lines[i].name,
      plotExpr: lines[i].plotExpr,
    }));
    const sliders = [...new Set(usable.flatMap((i) => {
      const used = namesIn(exprOf(i));
      return lines[i].symbols.filter((s) => used.has(s));
    }))];
    onApply(rows, sliders, mode);
    if (mode === "replace") {
      onClose();
    } else {
      // Ready for the next formula; the pad is the quickest way to add a few in a row.
      setInserted(true);
      padRef.current?.clear();
    }
  };

  const pct = progress ? Math.min(100, (progress.loaded / progress.total) * 100) : 0;

  return (
    <div
      className="nodrag nopan nowheel cursor-default mt-2 rounded-lg border border-blue-200 dark:border-blue-500/25 bg-blue-50/40 dark:bg-slate-900/60 p-2.5 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {/* Title */}
      <div className="flex items-center gap-2">
        <PenLine size={13} className="text-blue-600 dark:text-blue-400" />
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Draw formula</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoRead}
          onClick={toggleAutoRead}
          title={autoRead
            ? "Auto-read is on: the formula is read each time you pause. Turn off to write it all, then press Read."
            : "Auto-read is off: write the whole formula, then press Read. Turn on to read as you write."}
          className="ml-auto flex items-center gap-1.5 px-1.5 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Auto-read</span>
          <span
            className={`relative block w-7 h-4 rounded-full border transition-colors ${autoRead
              ? "bg-blue-600 border-blue-500"
              : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"}`}
          >
            <span
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm transition-[left] duration-150 ${autoRead ? "left-3.5" : "left-0.5"}`}
            />
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Close the drawing pad (Esc)"
          aria-label="Close drawing pad"
        >
          <X size={13} />
        </button>
      </div>

      {/* Reader not installed yet: one-time download */}
      {stored === null && (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
            Reading handwriting needs the formula reader, a one-time {mb(TOTAL_BYTES)} download kept in this browser.
            Nothing you draw is uploaded.
          </p>
          {downloading ? (
            <div className="flex flex-col gap-1">
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-blue-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <Loader2 size={11} className="animate-spin" />
                {progress ? `${mb(progress.loaded)} of ${mb(progress.total)}` : "Connecting…"}
                <button type="button" onClick={cancelReaderDownload} className="ml-auto hover:text-slate-800 dark:hover:text-slate-100">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isStorageAvailable()}
              onClick={startDownload}
              className="self-start flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
            >
              <Download size={12} /> Download reader ({mb(TOTAL_BYTES)})
            </button>
          )}
          {downloadError && (
            <p className="text-[10px] text-red-600 dark:text-red-400 flex items-start gap-1">
              <AlertTriangle size={11} className="mt-px shrink-0" /> {downloadError}
            </p>
          )}
        </div>
      )}

      <FormulaSketchPad
        ref={padRef}
        onInkChange={handleInk}
        // Manual mode only stores the ink, so hand it over almost at once to enable Read.
        settleMs={autoRead ? 650 : 150}
        padClassName="h-[150px] sm:h-[170px]"
      />

      {/* Manual mode: read once the formula is fully written */}
      {!autoRead && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {sketch ? "Finished writing? Read it when ready." : "Write the whole formula, then read it."}
          </span>
          <button
            type="button"
            onClick={readNow}
            disabled={!sketch || !stored || reading}
            title={!stored ? "Download the reader first" : "Read the formula on the pad"}
            className="ml-auto flex items-center gap-1.5 px-3 h-7 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reading ? <Loader2 size={12} className="animate-spin" /> : <ScanText size={12} />}
            {latex ? "Read again" : "Read formula"}
          </button>
        </div>
      )}

      {/* Reading */}
      {reading && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <Loader2 size={12} className="animate-spin text-blue-600" />
          {readerStatus === "loading" ? "Starting the reader (first time only)…" : "Reading…"}
        </div>
      )}
      {readError && !reading && (
        <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {readError}
        </p>
      )}
      {inserted && !latex && !reading && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <Check size={12} /> Inserted below. Write another, or close the pad.
        </p>
      )}

      {/* Result */}
      {latex && !reading && (
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 overflow-x-auto custom-scrollbar text-slate-900 dark:text-slate-100 text-[1.05rem] min-h-[44px]">
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 py-2">This LaTeX doesn't render; fix it below.</p>
            )}
          </div>

          <input
            value={latex}
            onChange={(e) => {
              setLatex(e.target.value);
              setEdits({});
            }}
            spellCheck={false}
            aria-label="LaTeX that was read"
            title="LaTeX: edit to fix a misread symbol"
            className="w-full h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500"
          />

          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              {line.error ? (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {line.error}
                </p>
              ) : (
                <>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${KIND_STYLE[line.kind!]}`}>
                    {KIND_LABEL[line.kind!]}
                  </span>
                  <input
                    value={exprOf(i)}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [i]: e.target.value }))}
                    spellCheck={false}
                    aria-label="Expression for the row"
                    className="flex-1 min-w-0 h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[12px] text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                </>
              )}
            </div>
          ))}

          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            {!isEmptyRow && (
              <button
                type="button"
                onClick={() => apply("below")}
                disabled={usable.length === 0}
                title="Add as a new row under this one"
                className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ArrowDownToLine size={12} /> Insert below
              </button>
            )}
            <button
              type="button"
              onClick={() => apply("replace")}
              disabled={usable.length === 0}
              title={isEmptyRow ? "Use this formula for the row" : "Replace this row's formula"}
              className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
            >
              {isEmptyRow ? <Check size={12} /> : <Replace size={12} />}
              {isEmptyRow ? "Use formula" : "Replace"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
