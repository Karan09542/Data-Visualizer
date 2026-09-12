import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Shared controls for the per-function settings panel, so fields, dropdowns and
 * toggles share one height, one focus style and one dark/light palette.
 */

export const FIELD_CLASS =
  "h-8 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 px-2.5 text-[11px] font-mono text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

/** Small uppercase heading used above a group of settings. */
export const SettingsLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <span
    className={`text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ${className}`}
  >
    {children}
  </span>
);

export const SettingsField: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ className = "", ...props }) => (
  <input {...props} className={`${FIELD_CLASS} ${className}`} />
);

/** A dropdown with the browser's default arrow replaced by a consistent chevron. */
export const SettingsSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ className = "", children, ...props }) => (
  <div className="relative flex-1 min-w-0">
    <select
      {...props}
      className={`${FIELD_CLASS} appearance-none cursor-pointer pr-7 ${className}`}
    >
      {children}
    </select>
    <ChevronDown
      size={13}
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
    />
  </div>
);

/** Label on the left, switch on the right — matches the Individual Timeline toggle. */
export const SettingsSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ checked, onChange, label, hint }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-300 select-none">
        {label}
      </div>
      {hint && (
        <div className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">{hint}</div>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${checked ? "bg-blue-500" : "bg-slate-200 dark:bg-slate-700"}`}
    >
      <span
        className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  </div>
);
