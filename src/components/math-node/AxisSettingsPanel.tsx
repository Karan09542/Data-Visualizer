import React, { useEffect, useId, useMemo } from "react";
import * as mathjs from "mathjs";
import { Minus, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { evaluateStepExpression } from "./mathHelpers";

interface AxisSettingsPanelProps {
  axisStepStr: string;
  setAxisStepStr: (v: string) => void;
  parsedAxisStep: number;
  variableScope?: Record<string, number>;
  axisAutoFit: boolean;
  setAxisAutoFit: (v: boolean) => void;
  axisDecimals: number;
  setAxisDecimals: (v: number) => void;
  axisThousandsSep: boolean;
  setAxisThousandsSep: (v: boolean) => void;
  axisPrefix: string;
  setAxisPrefix: (v: string) => void;
  axisSuffix: string;
  setAxisSuffix: (v: string) => void;
  separateAxes?: boolean;
  setSeparateAxes?: (v: boolean) => void;
  axisPiSymbol?: boolean;
  setAxisPiSymbol?: (v: boolean) => void;
  axisComplexNotation?: boolean;
  setAxisComplexNotation?: (v: boolean) => void;
  axisFilterX?: "all" | "even" | "odd" | "custom";
  setAxisFilterX?: (v: "all" | "even" | "odd" | "custom") => void;
  axisFilterY?: "all" | "even" | "odd" | "custom";
  setAxisFilterY?: (v: "all" | "even" | "odd" | "custom") => void;
  axisCustomFilterX?: string;
  setAxisCustomFilterX?: (v: string) => void;
  axisCustomFilterY?: string;
  setAxisCustomFilterY?: (v: string) => void;
  axisPiSymbolX?: boolean;
  setAxisPiSymbolX?: (v: boolean) => void;
  axisPiSymbolY?: boolean;
  setAxisPiSymbolY?: (v: boolean) => void;
  axisComplexNotationX?: boolean;
  setAxisComplexNotationX?: (v: boolean) => void;
  axisComplexNotationY?: boolean;
  setAxisComplexNotationY?: (v: boolean) => void;
  zoomMin?: number;
  setZoomMin?: (v: number) => void;
  zoomMax?: number;
  setZoomMax?: (v: number) => void;
  getAxisLabel: (n: number, adaptiveStep?: number, axis?: "x" | "y") => React.ReactNode;
  onClose: () => void;
}


const STEP_PRESETS = [
  { label: "1", value: "1" },
  { label: "0.5", value: "0.5" },
  { label: "π/2", value: "pi/2" },
  { label: "π", value: "pi" },
  { label: "2π", value: "2*pi" },
  { label: "n%5==0", value: "n%5 == 0" },
];


const inputCls =
  "h-8 w-full rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/60 px-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const labelCls = "text-[11px] font-medium text-slate-600 dark:text-slate-300";

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
    {children}
  </h4>
);

const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  labelledBy: string;
}> = ({ checked, onChange, labelledBy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${checked ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-700"}`}
  >
    <span
      className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
    />
  </button>
);

export const AxisSettingsPanel: React.FC<AxisSettingsPanelProps> = ({
  axisStepStr,
  setAxisStepStr,
  parsedAxisStep,
  variableScope,
  axisAutoFit,
  setAxisAutoFit,
  axisDecimals,
  setAxisDecimals,
  axisThousandsSep,
  setAxisThousandsSep,
  axisPrefix,
  setAxisPrefix,
  axisSuffix,
  setAxisSuffix,
  separateAxes = false,
  setSeparateAxes,
  axisPiSymbol = false,
  setAxisPiSymbol,
  axisComplexNotation = false,
  setAxisComplexNotation,
  axisFilterX = "all",
  setAxisFilterX,
  axisFilterY = "all",
  setAxisFilterY,
  axisCustomFilterX = "",
  setAxisCustomFilterX,
  axisCustomFilterY = "",
  setAxisCustomFilterY,
  axisPiSymbolX = false,
  setAxisPiSymbolX,
  axisPiSymbolY = false,
  setAxisPiSymbolY,
  axisComplexNotationX = false,
  setAxisComplexNotationX,
  axisComplexNotationY = false,
  setAxisComplexNotationY,
  zoomMin = 0.1,
  setZoomMin,
  zoomMax = 20,
  setZoomMax,
  getAxisLabel,
  onClose,
}) => {
  const id = useId();
  const [previewAxis, setPreviewAxis] = React.useState<"x" | "y">("x");

  const evaluatedStep = useMemo(() => {
    return evaluateStepExpression(axisStepStr, variableScope);
  }, [axisStepStr, variableScope]);
  const stepValid = evaluatedStep.valid;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetDefaults = () => {
    setAxisStepStr("1");
    setAxisAutoFit(true);
    setAxisDecimals(2);
    setAxisThousandsSep(false);
    setAxisPrefix("");
    setAxisSuffix("");
    setSeparateAxes?.(false);
    setAxisPiSymbol?.(false);
    setAxisComplexNotation?.(false);
    setAxisFilterX?.("all");
    setAxisFilterY?.("all");
    setAxisCustomFilterX?.("");
    setAxisCustomFilterY?.("");
    setAxisPiSymbolX?.(false);
    setAxisPiSymbolY?.(false);
    setAxisComplexNotationX?.(false);
    setAxisComplexNotationY?.(false);
    setZoomMin?.(0.1);
    setZoomMax?.(20);
    setPreviewAxis("x");
  };


  const normalizedStep = axisStepStr.replace(/\s/g, "");
  const previewTicks = useMemo(() => {
    if (evaluatedStep.filterExpr) {
      const modMatch = evaluatedStep.filterExpr.match(/%\s*(\d+)/);
      const modVal = modMatch ? parseInt(modMatch[1], 10) : 1;
      if (modVal > 1 && modVal <= 10) {
        return [-modVal, 0, modVal, 2 * modVal];
      }
      return [-5, -2, 0, 2, 5];
    }
    return [-1, 0, 1, 2, 3].map((k) => k * parsedAxisStep);
  }, [evaluatedStep.filterExpr, parsedAxisStep]);

  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      data-no-trace
      data-capture-exclude
      className="absolute z-50 nodrag nowheel select-text cursor-default flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/40 text-slate-800 dark:text-slate-100 inset-x-2 bottom-2 max-h-[75%] md:inset-x-auto md:bottom-auto md:left-3 md:top-[3.75rem] md:w-80 md:max-h-[calc(100%-4.75rem)] animate-in fade-in slide-in-from-bottom-2 md:slide-in-from-top-1 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20">
            <SlidersHorizontal size={15} />
          </div>
          <div className="min-w-0">
            <h3
              id={`${id}-title`}
              className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-50"
            >
              Axis settings
            </h3>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              Changes apply to the graph live
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close axis settings"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
        {/* Scale */}
        <section className="space-y-3">
          <SectionHeading>Scale</SectionHeading>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`${id}-step`} className={labelCls}>
                Step size
              </label>
              {stepValid && evaluatedStep.formattedValue && (
                <span className={`font-mono text-[10px] ${evaluatedStep.isFilter ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
                  {evaluatedStep.isFilter ? evaluatedStep.formattedValue : `≈ ${evaluatedStep.formattedValue}`}
                </span>
              )}
            </div>
            <input
              id={`${id}-step`}
              type="text"
              value={axisStepStr}
              onChange={(e) => setAxisStepStr(e.target.value)}
              placeholder="e.g. 1, 0.5, pi/2, n%5 == 0, 2; n%4 == 0"
              aria-invalid={!stepValid && axisStepStr.trim() !== ""}
              className={`${inputCls} font-mono ${stepValid || axisStepStr.trim() === "" ? "" : "border-red-400 dark:border-red-500/70 focus:border-red-500 focus:ring-red-500/20"}`}
            />
            <div className="flex items-center gap-1">
              {STEP_PRESETS.map((p) => {
                const active =
                  normalizedStep === p.value.replace(/\s/g, "") ||
                  (p.value === "pi" && (normalizedStep === "π" || normalizedStep === "PI")) ||
                  (p.value === "pi/2" && normalizedStep === "π/2") ||
                  (p.value === "2*pi" && (normalizedStep === "2pi" || normalizedStep === "2π")) ||
                  (p.value === "n%5 == 0" && (normalizedStep === "n%5==0" || normalizedStep === "n%5=0"));
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setAxisStepStr(p.value);
                      if (p.value === "pi" || p.value === "pi/2" || p.value === "2*pi") {
                        if (separateAxes) {
                          setAxisPiSymbolX?.(true);
                          setAxisPiSymbolY?.(true);
                        } else {
                          setAxisPiSymbol?.(true);
                        }
                      }
                    }}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${active ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
              {!stepValid && axisStepStr.trim() !== "" && (
                <span className="ml-auto text-[10px] text-red-500 dark:text-red-400">
                  Invalid expression, using 1
                </span>
              )}
            </div>
          </div>


          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div id={`${id}-autofit`} className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Auto-fit on zoom
              </div>
              <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Thins labels as you zoom out so they never overlap
              </div>
            </div>
            <Switch
              checked={axisAutoFit}
              onChange={setAxisAutoFit}
              labelledBy={`${id}-autofit`}
            />
          </div>

          {/* Zoom limits */}
          <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className={labelCls}>Zoom limits</span>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {zoomMin}× — {zoomMax}×
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor={`${id}-zoom-min`} className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Min zoom (zoom out limit)
                </label>
                <input
                  id={`${id}-zoom-min`}
                  type="number"
                  step="0.05"
                  min="0.001"
                  max="100"
                  value={zoomMin}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setZoomMin?.(v);
                  }}
                  className={`${inputCls} font-mono text-center`}
                  placeholder="0.1"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${id}-zoom-max`} className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Max zoom (zoom in limit)
                </label>
                <input
                  id={`${id}-zoom-max`}
                  type="number"
                  step="1"
                  min="0.1"
                  max="1000"
                  value={zoomMax}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setZoomMax?.(v);
                  }}
                  className={`${inputCls} font-mono text-center`}
                  placeholder="20"
                />
              </div>
            </div>
            {/* Quick zoom presets */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-0.5">Presets:</span>
              {[
                { label: "Default", min: 0.1, max: 20 },
                { label: "Wide", min: 0.01, max: 50 },
                { label: "Deep", min: 0.05, max: 100 },
                { label: "Locked", min: 1, max: 1 },
              ].map((pz) => {
                const active = zoomMin === pz.min && zoomMax === pz.max;
                return (
                  <button
                    key={pz.label}
                    type="button"
                    onClick={() => {
                      setZoomMin?.(pz.min);
                      setZoomMax?.(pz.max);
                    }}
                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                      active
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
                    }`}
                  >
                    {pz.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>


        <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

        {/* Format */}
        <section className="space-y-3">
          <SectionHeading>Format</SectionHeading>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <span className={labelCls}>Decimals</span>
              <div className="flex h-8 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-950/60">
                <button
                  type="button"
                  aria-label="Fewer decimals"
                  disabled={axisDecimals <= 0}
                  onClick={() => setAxisDecimals(Math.max(0, axisDecimals - 1))}
                  className="flex h-full w-7 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <Minus size={12} />
                </button>
                <span className="flex-1 text-center font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100">
                  {axisDecimals}
                </span>
                <button
                  type="button"
                  aria-label="More decimals"
                  disabled={axisDecimals >= 10}
                  onClick={() => setAxisDecimals(Math.min(10, axisDecimals + 1))}
                  className="flex h-full w-7 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-prefix`} className={labelCls}>
                Prefix
              </label>
              <input
                id={`${id}-prefix`}
                type="text"
                value={axisPrefix}
                onChange={(e) => setAxisPrefix(e.target.value)}
                placeholder="$"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-suffix`} className={labelCls}>
                Suffix
              </label>
              <input
                id={`${id}-suffix`}
                type="text"
                value={axisSuffix}
                onChange={(e) => setAxisSuffix(e.target.value)}
                placeholder="m"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div id={`${id}-thousands`} className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Thousands separator
            </div>
            <Switch
              checked={axisThousandsSep}
              onChange={setAxisThousandsSep}
              labelledBy={`${id}-thousands`}
            />
          </div>

          <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

          {/* Notation & Symbols */}
          <div className="space-y-3 pt-0.5">
            <SectionHeading>Axis Notation</SectionHeading>

            {/* Global toggle to enable separate X & Y axes */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <div className="min-w-0">
                <div id={`${id}-separate`} className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Configure X and Y separately
                </div>
                <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Control parity (odd/even) and symbols independently for each axis
                </div>
              </div>
              <Switch
                checked={!!separateAxes}
                onChange={(v) => {
                  setSeparateAxes?.(v);
                  if (v) {
                    if (axisPiSymbolX === undefined) setAxisPiSymbolX?.(Boolean(axisPiSymbol));
                    if (axisPiSymbolY === undefined) setAxisPiSymbolY?.(Boolean(axisPiSymbol));
                    if (axisComplexNotationY === undefined) setAxisComplexNotationY?.(Boolean(axisComplexNotation));
                    if (axisComplexNotationX === undefined) setAxisComplexNotationX?.(false);
                  }
                }}
                labelledBy={`${id}-separate`}
              />
            </div>

            {/* Standard Mode (when separateAxes is false) */}
            {!separateAxes ? (
              <div className="space-y-3">
                {/* Pi symbol toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div id={`${id}-pi-symbol`} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                      <span className="inline-flex size-4 items-center justify-center rounded bg-blue-100 font-serif text-[11px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        π
                      </span>
                      <span>Represent π as symbol</span>
                    </div>
                    <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Format multiples of π as symbols and set step size to π
                    </div>
                  </div>
                  <Switch
                    checked={!!axisPiSymbol}
                    onChange={(v) => {
                      setAxisPiSymbol?.(v);
                      if (v) {
                        setAxisStepStr("pi");
                      }
                    }}
                    labelledBy={`${id}-pi-symbol`}
                  />
                </div>

                {/* Complex notation toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div id={`${id}-complex`} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                      <span className="inline-flex size-4 items-center justify-center rounded bg-purple-100 font-serif italic text-[11px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        i
                      </span>
                      <span>Complex notation (i)</span>
                    </div>
                    <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Apply complex iota notation (i) to Y-axis only
                    </div>
                  </div>
                  <Switch
                    checked={!!axisComplexNotation}
                    onChange={(v) => setAxisComplexNotation?.(v)}
                    labelledBy={`${id}-complex`}
                  />
                </div>
              </div>
            ) : (
              /* Separate X & Y Axes Mode (when separateAxes is true) */
              <div className="space-y-3">
                {/* X-Axis Card */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      X-Axis Configuration
                    </span>
                    {/* Filter buttons: All / Even / Odd / Custom */}
                    <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900 text-[10px]">
                      {(["all", "even", "odd", "custom"] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setAxisFilterX?.(filter)}
                          className={`px-1.5 py-0.5 rounded capitalize font-medium transition-colors ${
                            (axisFilterX || "all") === filter
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {filter === "all" ? "All" : filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom filter equation for X */}
                  {axisFilterX === "custom" && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <label htmlFor={`${id}-custom-x`} className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Filter Equation
                        </label>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">
                          Use <code className="font-mono text-blue-600 dark:text-blue-400">n</code> or <code className="font-mono text-blue-600 dark:text-blue-400">x</code>
                        </span>
                      </div>
                      <input
                        id={`${id}-custom-x`}
                        type="text"
                        value={axisCustomFilterX}
                        onChange={(e) => setAxisCustomFilterX?.(e.target.value)}
                        placeholder="e.g. n % 3 == 0, n > 0, abs(n) <= 4"
                        className="h-7 w-full rounded-md border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/60 px-2 font-mono text-[11px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                      />
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {["n % 3 == 0", "n > 0", "abs(n) <= 3", "n % 5 == 0"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAxisCustomFilterX?.(preset)}
                            className="rounded bg-slate-200/60 dark:bg-slate-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[9px] font-mono px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      <span className="font-serif font-bold text-blue-600 dark:text-blue-400">π</span>
                      <span>Represent π as symbol</span>
                    </div>
                    <Switch
                      checked={!!axisPiSymbolX}
                      onChange={(v) => setAxisPiSymbolX?.(v)}
                      labelledBy={`${id}-pi-x`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      <span className="font-serif italic font-bold text-purple-600 dark:text-purple-400">i</span>
                      <span>Complex notation (i)</span>
                    </div>
                    <Switch
                      checked={!!axisComplexNotationX}
                      onChange={(v) => setAxisComplexNotationX?.(v)}
                      labelledBy={`${id}-complex-x`}
                    />
                  </div>
                </div>

                {/* Y-Axis Card */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Y-Axis Configuration
                    </span>
                    {/* Filter buttons: All / Even / Odd / Custom */}
                    <div className="flex items-center rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900 text-[10px]">
                      {(["all", "even", "odd", "custom"] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setAxisFilterY?.(filter)}
                          className={`px-1.5 py-0.5 rounded capitalize font-medium transition-colors ${
                            (axisFilterY || "all") === filter
                              ? "bg-purple-600 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {filter === "all" ? "All" : filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom filter equation for Y */}
                  {axisFilterY === "custom" && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <label htmlFor={`${id}-custom-y`} className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Filter Equation
                        </label>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">
                          Use <code className="font-mono text-purple-600 dark:text-purple-400">n</code> or <code className="font-mono text-purple-600 dark:text-purple-400">y</code>
                        </span>
                      </div>
                      <input
                        id={`${id}-custom-y`}
                        type="text"
                        value={axisCustomFilterY}
                        onChange={(e) => setAxisCustomFilterY?.(e.target.value)}
                        placeholder="e.g. n % 3 == 0, n > 0, abs(n) <= 4"
                        className="h-7 w-full rounded-md border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/60 px-2 font-mono text-[11px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                      />
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {["n % 3 == 0", "n > 0", "abs(n) <= 3", "n % 5 == 0"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAxisCustomFilterY?.(preset)}
                            className="rounded bg-slate-200/60 dark:bg-slate-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-[9px] font-mono px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      <span className="font-serif font-bold text-blue-600 dark:text-blue-400">π</span>
                      <span>Represent π as symbol</span>
                    </div>
                    <Switch
                      checked={!!axisPiSymbolY}
                      onChange={(v) => setAxisPiSymbolY?.(v)}
                      labelledBy={`${id}-pi-y`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      <span className="font-serif italic font-bold text-purple-600 dark:text-purple-400">i</span>
                      <span>Complex notation (i)</span>
                    </div>
                    <Switch
                      checked={!!axisComplexNotationY}
                      onChange={(v) => setAxisComplexNotationY?.(v)}
                      labelledBy={`${id}-complex-y`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

        {/* Preview */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <SectionHeading>Preview</SectionHeading>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              {(separateAxes
                ? previewAxis === "y"
                  ? axisPiSymbolY
                  : axisPiSymbolX
                : axisPiSymbol) && (
                <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  π symbol
                </span>
              )}
              {(separateAxes
                ? previewAxis === "y"
                  ? axisComplexNotationY
                  : axisComplexNotationX
                : previewAxis === "y" && axisComplexNotation) && (
                <span className="rounded bg-purple-50 px-1 py-0.5 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  complex (i)
                </span>
              )}
              {separateAxes && (previewAxis === "y" ? axisFilterY : axisFilterX) === "custom" && (
                <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  custom
                </span>
              )}
              <div className="flex items-center rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-[10px] ml-1 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewAxis("x")}
                  className={`px-1.5 py-0.5 ${previewAxis === "x" ? "bg-blue-600 text-white font-medium" : "text-slate-500 hover:text-slate-800 dark:text-slate-300"}`}
                  title="Preview X-axis number line"
                >
                  X-axis
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAxis("y")}
                  className={`px-1.5 py-0.5 ${previewAxis === "y" ? "bg-purple-600 text-white font-medium" : "text-slate-500 hover:text-slate-800 dark:text-slate-300"}`}
                  title="Preview Y-axis number line"
                >
                  Y-axis
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-6 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="relative h-9">
              <div className="absolute inset-x-0 top-1.5 h-px bg-slate-300 dark:bg-slate-600" />
              {previewTicks.map((val, i) => {
                const lbl = getAxisLabel(val, parsedAxisStep, previewAxis);
                const isOrigin = val === 0;
                return (
                  <div
                    key={i}
                    className="absolute top-1.5 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${(i / (previewTicks.length - 1)) * 100}%` }}
                  >
                    <div
                      className={`w-px ${isOrigin ? "-mt-1.5 h-3 bg-slate-600 dark:bg-slate-300" : "-mt-1 h-2 bg-slate-400 dark:bg-slate-500"}`}
                    />
                    <span
                      className={`mt-1 whitespace-nowrap font-mono text-[10px] tabular-nums ${isOrigin ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}`}
                    >
                      {lbl === "" ? "—" : lbl}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/40 shrink-0">
        <button
          type="button"
          onClick={resetDefaults}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <RotateCcw size={12} />
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
        >
          Done
        </button>
      </div>
    </div>
  );
};
