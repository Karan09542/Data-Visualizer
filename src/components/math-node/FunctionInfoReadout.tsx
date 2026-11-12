import React, { useMemo, useState } from "react";
import katex from "katex";
import { ChevronDown, Info } from "lucide-react";
import { getUsedFunctionsDomainInfo } from "../../lib/math/functionDomainInfo";

const MAX_COLLAPSED_NAMES = 3;

const KatexMath: React.FC<{ tex: string; className?: string; fontSizePx?: number }> = ({
  tex,
  className,
  fontSizePx = 9,
}) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        throwOnError: true,
        strict: "ignore",
        displayMode: false,
      });
    } catch {
      return null;
    }
  }, [tex]);

  // Set em base explicitly because katex.min.css styles `.katex` at 1.21em outside Tailwind layers.
  const style = { fontSize: `${fontSizePx}px`, lineHeight: 1.4 };

  if (html === null) {
    return (
      <span className={className} style={style}>
        {tex}
      </span>
    );
  }
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
};

const FIELD_ROWS = [
  { key: "domain", label: "Domain" },
  { key: "range", label: "Range" },
  { key: "codomain", label: "Codomain" },
] as const;

/**
 * Flat, input-matched per-row toggle displaying KaTeX-typeset Domain, Range, and
 * Codomain metadata for every built-in math function used in the expression.
 */
export const FunctionInfoReadout: React.FC<{ expr: string }> = ({ expr }) => {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => getUsedFunctionsDomainInfo(expr), [expr]);

  if (items.length === 0) return null;

  const previewNames = items.slice(0, MAX_COLLAPSED_NAMES).map((i) => i.name);
  const extraCount = items.length - previewNames.length;
  const summaryNames =
    extraCount > 0 ? `${previewNames.join(", ")} +${extraCount}` : previewNames.join(", ");

  return (
    <div
      className={`mt-1 w-full rounded border transition-colors nodrag ${
        open
          ? "border-slate-200 bg-slate-100/90 dark:border-slate-700/50 dark:bg-slate-900/40"
          : "border-slate-200 bg-slate-100/70 hover:border-slate-300 dark:border-transparent dark:bg-slate-900/40 dark:hover:border-slate-700/50"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={
          open
            ? "Hide domain, range, and codomain info"
            : "Show domain, range, and codomain for functions used in this row"
        }
        className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left focus:outline-none"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
          <Info size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="shrink-0">Domain · Range · Codomain</span>
          {!open && (
            <span className="truncate font-mono text-[10px] text-slate-600 dark:text-slate-300">
              ({summaryNames})
            </span>
          )}
          {open && (
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
              {items.length}
            </span>
          )}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-slate-400 transition-transform duration-150 dark:text-slate-500 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col divide-y divide-slate-200/80 border-t border-slate-200/80 dark:divide-slate-800/70 dark:border-slate-800/70">
          {items.map((item) => (
            <div key={item.name} className="flex flex-col gap-1 px-2 py-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {item.name}
                  </span>
                  <KatexMath
                    tex={item.signature}
                    fontSizePx={10}
                    className="text-slate-800 dark:text-slate-100"
                  />
                </div>
                {item.note && (
                  <span className="text-[9.5px] text-slate-400 dark:text-slate-500">
                    {item.note}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-[58px_1fr] items-baseline gap-x-2 gap-y-0.5">
                {FIELD_ROWS.map((field) => (
                  <React.Fragment key={field.key}>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {field.label}
                    </span>
                    <KatexMath
                      tex={item[field.key]}
                      fontSizePx={9}
                      className="min-w-0 overflow-x-auto overflow-y-hidden py-0.5 text-slate-800 dark:text-slate-200"
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
