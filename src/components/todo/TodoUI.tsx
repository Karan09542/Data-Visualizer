/**
 * Small pieces of todo UI shared by the canvas node, the Todo workspace and the
 * productivity layer, so a task looks and behaves the same everywhere.
 *
 * Colours work on any background: priorities and statuses are translucent tints,
 * and neutral parts use the code workspace palette (--vsc-*) when it's present,
 * falling back to mid greys that read on both light and dark.
 */
import React from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Minus,
} from "lucide-react";
import { PRIORITIES, type TodoPriority, type TodoStatus } from "./todoModel";

const NEUTRAL_BORDER = "border-[color:var(--vsc-border-strong,#94a3b8)]";

// ─── Option tables ─────────────────────────────────────────────────────────────

export const STATUS_OPTIONS: { value: TodoStatus; label: string; icon: typeof Circle; color: string }[] = [
  { value: "Todo", label: "Todo", icon: Circle, color: "text-[var(--vsc-fg-muted,#94a3b8)]" },
  { value: "In Progress", label: "In Progress", icon: Clock, color: "text-amber-500" },
  { value: "Review", label: "Review", icon: Eye, color: "text-blue-500" },
  { value: "Blocked", label: "Blocked", icon: AlertCircle, color: "text-red-500" },
  { value: "Completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-500" },
];

/** Badge colours per priority: tint, text and ring. */
export const PRIORITY_TONE: Record<TodoPriority, string> = {
  Critical: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/25",
  High: "bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/25",
  Medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  Low: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/25",
  Normal:
    "bg-[var(--vsc-hover,rgba(148,163,184,0.12))] text-[var(--vsc-fg-muted,#94a3b8)] ring-[color:var(--vsc-border,rgba(148,163,184,0.3))]",
};

const PRIORITY_ICON: Record<TodoPriority, typeof Minus> = {
  Critical: AlertCircle,
  High: ArrowUp,
  Medium: ArrowRight,
  Low: ArrowDown,
  Normal: Minus,
};

export const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({
  value: p,
  label: p,
  icon: PRIORITY_ICON[p],
  color: PRIORITY_TONE[p].split(" ").filter((c) => c.includes("text-")).join(" "),
  bgColor: PRIORITY_TONE[p],
}));

export const PREDEFINED_TAGS = ["bug", "urgent", "api", "backend", "security"];

export const getTagColorClass = (tag: string) => {
  switch (tag.toLowerCase()) {
    case "bug":
      return "bg-rose-500/10 text-rose-500 border-rose-500/30";
    case "urgent":
      return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "api":
      return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    case "backend":
      return "bg-purple-500/10 text-purple-500 border-purple-500/30";
    case "security":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    default:
      return "bg-[var(--vsc-hover,rgba(148,163,184,0.12))] text-[var(--vsc-fg-muted,#94a3b8)] border-[color:var(--vsc-border,rgba(148,163,184,0.3))]";
  }
};

// ─── Components ────────────────────────────────────────────────────────────────

const BADGE_BASE =
  "inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-semibold leading-none ring-1 ring-inset whitespace-nowrap";

/** A round done/not-done toggle. `blocked` means open subtasks prevent completing it. */
export function TaskCheckbox({
  done,
  blocked = false,
  onToggle,
  onBlocked,
  size = "md",
  className = "",
}: {
  done: boolean;
  blocked?: boolean;
  onToggle: () => void;
  /** Called instead of `onToggle` when a blocked task is clicked. */
  onBlocked?: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  const tick = size === "sm" ? 9 : size === "lg" ? 12 : 10;
  const isBlocked = blocked && !done;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-disabled={isBlocked || undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (isBlocked) onBlocked?.();
        else onToggle();
      }}
      title={isBlocked ? "Complete its subtasks first" : done ? "Mark as not done" : "Mark as done"}
      className={`${box} shrink-0 rounded-full inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        done
          ? "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
          : isBlocked
            ? `border-[1.5px] ${NEUTRAL_BORDER} text-transparent opacity-50 cursor-not-allowed`
            : `border-[1.5px] ${NEUTRAL_BORDER} text-transparent hover:border-emerald-500 hover:text-emerald-500 cursor-pointer`
      } ${className}`}
    >
      <Check size={tick} strokeWidth={3.5} />
    </button>
  );
}

export function PriorityBadge({
  priority,
  onClick,
  title,
  className = "",
}: {
  priority: TodoPriority;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
}) {
  const Icon = PRIORITY_ICON[priority];
  const cls = `${BADGE_BASE} ${PRIORITY_TONE[priority]} ${className}`;
  if (!onClick) {
    return (
      <span className={cls} title={title}>
        <Icon size={10} strokeWidth={2.5} />
        {priority}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? "Change priority"}
      className={`${cls} cursor-pointer hover:brightness-110 transition-[filter]`}
    >
      <Icon size={10} strokeWidth={2.5} />
      {priority}
    </button>
  );
}

/** All priorities as chips; the current one is marked. */
export function PriorityPicker({
  value,
  onChange,
  className = "",
}: {
  value: TodoPriority;
  onChange: (p: TodoPriority) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Priority" className={`flex flex-wrap gap-1 ${className}`}>
      {PRIORITIES.map((p) => {
        const active = p === value;
        const Icon = active ? Check : PRIORITY_ICON[p];
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(e) => {
              e.stopPropagation();
              onChange(p);
            }}
            className={`${BADGE_BASE} ${PRIORITY_TONE[p]} h-6 px-2 cursor-pointer transition-[filter,opacity] hover:brightness-110 ${
              active ? "ring-2" : "opacity-75 hover:opacity-100"
            }`}
          >
            <Icon size={11} strokeWidth={2.5} />
            {p}
          </button>
        );
      })}
    </div>
  );
}

// ─── Menus (canvas node and productivity layer: follow the app theme) ─────────

export const MENU_CLASS =
  "w-52 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/70 rounded-lg shadow-xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden pointer-events-auto";

export function MenuItem({
  icon,
  label,
  hint,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 h-8 text-left text-[12px] transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        danger
          ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
      }`}
    >
      <span className={`shrink-0 ${danger ? "" : "text-slate-400 dark:text-slate-500"}`}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint !== undefined && (
        <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">{hint}</span>
      )}
    </button>
  );
}

export const MenuDivider = () => <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />;

/** "12/200" once a text gets close to its limit; nothing before that. */
export function LengthHint({ length, max, className = "" }: { length: number; max: number; className?: string }) {
  if (length < max * 0.8) return null;
  return (
    <span
      className={`text-[10px] tabular-nums pointer-events-none select-none ${
        length >= max ? "text-rose-500" : "text-[var(--vsc-fg-muted,#94a3b8)]"
      } ${className}`}
    >
      {length}/{max}
    </span>
  );
}
