import React, { useEffect, useId, useMemo } from "react";
import * as mathjs from "mathjs";
import { Minus, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";

interface AxisSettingsPanelProps {
  axisStepStr: string;
  setAxisStepStr: (v: string) => void;
  parsedAxisStep: number;
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
  getAxisLabel: (n: number, adaptiveStep?: number) => React.ReactNode;
  onClose: () => void;
}

const STEP_PRESETS = [
  { label: "1", value: "1" },
  { label: "0.5", value: "0.5" },
  { label: "π/2", value: "pi/2" },
  { label: "π", value: "pi" },
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
  getAxisLabel,
  onClose,
}) => {
  const id = useId();

  const stepValid = useMemo(() => {
    try {
      const v = mathjs.evaluate(axisStepStr);
      return typeof v === "number" && v > 0;
    } catch {
      return false;
    }
  }, [axisStepStr]);

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
  };

  const normalizedStep = axisStepStr.replace(/\s/g, "");
  const previewTicks = [-1, 0, 1, 2, 3].map((k) => k * parsedAxisStep);

  return (
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      data-no-trace
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
            <label htmlFor={`${id}-step`} className={labelCls}>
              Step size
            </label>
            <input
              id={`${id}-step`}
              type="text"
              value={axisStepStr}
              onChange={(e) => setAxisStepStr(e.target.value)}
              placeholder="e.g. 1, 0.5, pi/2"
              aria-invalid={!stepValid}
              className={`${inputCls} font-mono ${stepValid ? "" : "border-red-400 dark:border-red-500/70 focus:border-red-500 focus:ring-red-500/20"}`}
            />
            <div className="flex items-center gap-1">
              {STEP_PRESETS.map((p) => {
                const active = normalizedStep === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setAxisStepStr(p.value)}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${active ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
              {!stepValid && (
                <span className="ml-auto text-[10px] text-red-500 dark:text-red-400">
                  Invalid, using 1
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
        </section>

        <div className="h-px bg-slate-200/80 dark:bg-slate-800" />

        {/* Preview */}
        <section className="space-y-2.5">
          <SectionHeading>Preview</SectionHeading>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-6 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="relative h-9">
              <div className="absolute inset-x-0 top-1.5 h-px bg-slate-300 dark:bg-slate-600" />
              {previewTicks.map((val, i) => {
                const lbl = getAxisLabel(val, parsedAxisStep);
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
