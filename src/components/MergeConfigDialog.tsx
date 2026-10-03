import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, GitMerge, Link2, Pencil, Replace, Tag, X, Copy } from "lucide-react";

export type MergeStrategy = "default" | "url" | "custom";
export type ConflictAction = "replace" | "rename" | "deep-merge";

interface MergeConfigDialogProps {
  /** The fetched data being added. */
  data: unknown;
  /** The key the URL suggests. */
  urlKey: string;
  /** The key the chosen strategy gives. */
  activeKey: string;
  /** The first free key after activeKey (activeKey_2, _3...), used when keeping both. */
  renamedKey: string;
  /** What is already stored under activeKey; undefined when nothing is. */
  existing: unknown;
  hasCollision: boolean;
  strategy: MergeStrategy;
  onStrategyChange: (strategy: MergeStrategy) => void;
  customKey: string;
  onCustomKeyChange: (key: string) => void;
  conflictAction: ConflictAction;
  onConflictActionChange: (action: ConflictAction) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** "Object · 4 keys", "Array · 10 items", "String · 12 chars". */
export function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `Array · ${value.length} item${value.length === 1 ? "" : "s"}`;
  if (isPlainObject(value)) {
    const n = Object.keys(value).length;
    return `Object · ${n} key${n === 1 ? "" : "s"}`;
  }
  if (typeof value === "string") return `String · ${value.length} chars`;
  if (value === null) return "null";
  return `${typeof value} · ${String(value).slice(0, 24)}`;
}

/** A selectable card with a radio mark: the dialog's one control shape. */
function OptionCard({
  selected,
  disabled,
  onSelect,
  icon,
  title,
  description,
  children,
  tone = "blue",
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  tone?: "blue" | "amber";
}) {
  const ring =
    tone === "amber"
      ? "border-amber-400/70 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-500/[0.08]"
      : "border-blue-500/70 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-500/[0.08]";
  const dot = tone === "amber" ? "border-amber-500 bg-amber-500" : "border-blue-500 bg-blue-500";
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group rounded-lg border px-3.5 py-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        disabled
          ? "cursor-not-allowed opacity-50 border-slate-200 dark:border-slate-800"
          : selected
            ? `cursor-pointer ${ring}`
            : "cursor-pointer border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            selected ? dot : "border-slate-300 dark:border-slate-600"
          }`}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="mt-px shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-slate-900 dark:text-slate-100">{title}</div>
          {description && (
            <div className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

const KeyChip = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
    {children}
  </code>
);

/**
 * Where fetched data goes when it is added to the current document: under which key, and what to
 * do when that key is taken. Full screen on phones, a centred dialog from tablet width up.
 */
export default function MergeConfigDialog(props: MergeConfigDialogProps) {
  const {
    data, urlKey, activeKey, renamedKey, existing, hasCollision,
    strategy, onStrategyChange, customKey, onCustomKeyChange,
    conflictAction, onConflictActionChange, onCancel, onConfirm,
  } = props;
  const customInputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const canDeepMerge = hasCollision && isPlainObject(existing) && isPlainObject(data);
  // Deep merge chosen earlier but impossible here: what would really happen is a rename.
  const effectiveAction: ConflictAction = conflictAction === "deep-merge" && !canDeepMerge ? "rename" : conflictAction;
  const customKeyAdjusted = strategy === "custom" && customKey.trim() !== "" && customKey.trim() !== activeKey;

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    if (strategy === "custom") customInputRef.current?.focus();
  }, [strategy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const action =
    !hasCollision ? "add" : effectiveAction === "replace" ? "replace" : effectiveAction === "deep-merge" ? "merge" : "rename";
  const finalKey = action === "rename" ? renamedKey : activeKey;
  const confirmLabel =
    action === "replace" ? "Replace data" : action === "merge" ? "Merge data" : "Add data";

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6 animate-in fade-in duration-150"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-dialog-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-slate-800 dark:bg-[#0f141b] dark:text-slate-200 sm:h-auto sm:max-h-[min(720px,90dvh)] sm:max-w-[520px] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-2xl dark:sm:border-slate-800 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="merge-dialog-title" className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
              Add to existing data
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Choose the key the fetched data is stored under. <span className="text-slate-400 dark:text-slate-500">({describeValue(data)})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="-mr-1.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar px-5 py-5">
          <section aria-labelledby="merge-key-heading">
            <h3 id="merge-key-heading" className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Key
            </h3>
            <div role="radiogroup" aria-labelledby="merge-key-heading" className="flex flex-col gap-2">
              <OptionCard
                selected={strategy === "url"}
                onSelect={() => onStrategyChange("url")}
                icon={<Link2 size={15} />}
                title={<span className="flex flex-wrap items-center gap-2">From the URL <span className="rounded bg-blue-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Recommended</span></span>}
                description={<>Named after the address, so each source gets its own key: <KeyChip>{urlKey}</KeyChip></>}
              />
              <OptionCard
                selected={strategy === "default"}
                onSelect={() => onStrategyChange("default")}
                icon={<Tag size={15} />}
                title="Default key"
                description={<>Always the same key: <KeyChip>fetched_data</KeyChip></>}
              />
              <OptionCard
                selected={strategy === "custom"}
                onSelect={() => onStrategyChange("custom")}
                icon={<Pencil size={15} />}
                title="Custom key"
                description={strategy === "custom" ? undefined : "Type a key of your own."}
              >
                {strategy === "custom" && (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={customInputRef}
                      type="text"
                      value={customKey}
                      onChange={(e) => onCustomKeyChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onConfirm();
                        }
                      }}
                      placeholder="e.g. analytics_data"
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-[13px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {customKey.trim() === ""
                        ? <>Empty uses <KeyChip>fetched_data</KeyChip>.</>
                        : customKeyAdjusted
                          ? <>Letters, digits and _ only — saved as <KeyChip>{activeKey}</KeyChip></>
                          : <>Letters, digits and _.</>}
                    </p>
                  </div>
                )}
              </OptionCard>
            </div>
          </section>

          {hasCollision && (
            <section aria-labelledby="merge-conflict-heading" className="mt-6">
              <div className="mb-3 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/[0.07] dark:text-amber-200">
                <AlertTriangle size={16} className="mt-px shrink-0 text-amber-500" />
                <div className="min-w-0 text-xs leading-relaxed">
                  <span id="merge-conflict-heading" className="font-semibold">
                    <KeyChip>{activeKey}</KeyChip> already exists
                  </span>
                  <span className="text-amber-800/80 dark:text-amber-200/70"> — it holds {describeValue(existing)}. Choose what happens to it.</span>
                </div>
              </div>
              <div role="radiogroup" aria-labelledby="merge-conflict-heading" className="flex flex-col gap-2">
                <OptionCard
                  selected={effectiveAction === "rename"}
                  onSelect={() => onConflictActionChange("rename")}
                  icon={<Copy size={15} />}
                  title="Keep both"
                  description={<>The existing value stays; the new data is added as <KeyChip>{renamedKey}</KeyChip></>}
                />
                <OptionCard
                  selected={effectiveAction === "replace"}
                  onSelect={() => onConflictActionChange("replace")}
                  icon={<Replace size={15} />}
                  title="Replace"
                  description="The existing value is overwritten by the new data."
                  tone="amber"
                />
                <OptionCard
                  selected={effectiveAction === "deep-merge"}
                  disabled={!canDeepMerge}
                  onSelect={() => onConflictActionChange("deep-merge")}
                  icon={<GitMerge size={15} />}
                  title="Merge fields"
                  description={
                    canDeepMerge
                      ? "Fields from both are combined; where both have a field, the new value wins."
                      : "Only possible when both the existing value and the new data are objects."
                  }
                />
              </div>
            </section>
          )}

          {/* Preview */}
          <section className="mt-6">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Result
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 font-mono text-xs leading-6 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-slate-400 dark:text-slate-500">{"{"}</div>
              <div className="pl-4 text-slate-400 dark:text-slate-500">…</div>
              <div className="whitespace-nowrap pl-4">
                <span className={action === "replace" ? "text-amber-600 dark:text-amber-400" : action === "merge" ? "text-violet-600 dark:text-violet-400" : "text-emerald-600 dark:text-emerald-400"}>
                  "{finalKey}"
                </span>
                <span className="text-slate-400 dark:text-slate-500">: </span>
                <span className="text-slate-600 dark:text-slate-300">{describeValue(data)}</span>
                <span className="ml-3 font-sans text-[11px] text-slate-400 dark:text-slate-500">
                  {action === "replace" ? "replaces the existing value" : action === "merge" ? "merged into the existing object" : action === "rename" ? "added next to the existing key" : "new key"}
                </span>
              </div>
              <div className="text-slate-400 dark:text-slate-500">{"}"}</div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex-none sm:py-2"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f141b] sm:flex-none sm:py-2 ${
              action === "replace"
                ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
                : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
            }`}
          >
            <Check size={16} />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
