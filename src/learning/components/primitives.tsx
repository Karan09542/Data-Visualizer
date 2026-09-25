import React, { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { MAX_MASTERY, MASTERY_LABEL, masteryLevel } from "../services/VocabularyService";
import type { WordOutcome, WordProgress } from "../types";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-600/50 dark:disabled:bg-indigo-500/40",
  secondary:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
  danger:
    "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25",
};

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "lg" | "icon";
}

/** 44px minimum touch target, matching the app's indigo and slate palette. */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0d1117]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "lg" && "min-h-12 px-5 text-[15px]",
        size === "icon" && "size-11 shrink-0",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
);
ActionButton.displayName = "ActionButton";

export const inputClass =
  "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 " +
  "transition-colors focus:border-indigo-500 focus:outline-none focus:ring-3 focus:ring-indigo-500/15 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400";

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400", className)}>
      {children}
    </h3>
  );
}

/** Five short bars, filled up to the word's mastery. */
export function MasteryMeter({ progress, className }: { progress: WordProgress | undefined; className?: string }) {
  const level = masteryLevel(progress);
  const value = progress?.mastery ?? 0;
  const color =
    level === "mastered" ? "bg-emerald-500" : level === "familiar" ? "bg-sky-500" : level === "learning" ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600";
  return (
    <span
      className={cn("inline-flex items-end gap-[3px]", className)}
      role="img"
      aria-label={`${MASTERY_LABEL[level]}, mastery ${value} of ${MAX_MASTERY}`}
      title={MASTERY_LABEL[level]}
    >
      {Array.from({ length: MAX_MASTERY }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-[5px] rounded-full transition-colors",
            i < value ? color : "bg-slate-200 dark:bg-slate-700",
          )}
          style={{ height: 6 + i * 2 }}
        />
      ))}
    </span>
  );
}

const OUTCOME_STYLE: Record<WordOutcome, { label: string; className: string }> = {
  solved: { label: "Solved", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  assisted: { label: "With hints", className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  revealed: { label: "Revealed", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  missed: { label: "Missed", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

export function OutcomeBadge({ outcome }: { outcome: WordOutcome }) {
  const style = OUTCOME_STYLE[outcome];
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold", style.className)}>
      {style.label}
    </span>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900/60" title={hint}>
      <div className="text-xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{children}</p>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** A row of pill buttons that behaves as a radio group. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              "disabled:cursor-not-allowed disabled:opacity-40",
              selected
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-200"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

export const formatDate = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

export interface ConfirmRequest {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  variant?: "danger" | "primary" | "warning";
}

export const ConfirmContext = createContext<(req: ConfirmRequest) => Promise<boolean>>(async () => true);

/** Asks the user to confirm; resolves true when they do. */
export const useConfirm = () => useContext(ConfirmContext);
